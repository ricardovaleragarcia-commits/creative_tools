/* Compound Blur Controller.
   A text or an image sits on a flat background. A blur map (a distance field around the controller, with a core,
   a spread that can travel across the whole frame, a falloff curve and grain) decides how much blur each pixel gets.
   WebGL 2: the subject is blurred once into a stack of 12 levels (a texture array); every frame only picks and mixes
   two levels per pixel, so the controller can move at 60 fps and the loop can be rendered frame by frame. */
function blurField(canvas, cfg) {
  const TAU = Math.PI * 2;
  const c = Object.assign({ playing: true, tm: 0 }, cfg);
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL 2 is not available in this browser');

  const LV = [0, 1.5, 3, 5, 8, 12, 18, 27, 40, 60, 90, 135];   // blur levels, in px of a 1080 short side
  const NL = LV.length;

  /* ---------- shaders ---------- */
  const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  const FS_BLUR = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uSrc; uniform float uLod; uniform vec2 uStep; uniform float uSigma; uniform vec2 uRes;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  if (uSigma < 0.01) { o = textureLod(uSrc, uv, uLod); return; }
  float r = ceil(uSigma * 3.0);
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -24; i <= 24; i++) {
    float fi = float(i);
    if (abs(fi) > r) continue;
    float w = exp(-fi * fi / (2.0 * uSigma * uSigma));
    acc += w * textureLod(uSrc, uv + uStep * fi, uLod);
    ws += w;
  }
  o = acc / ws;
}`;

  const FS_COPY = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uSrc; uniform vec2 uRes;
out vec4 o;
void main(){ o = textureLod(uSrc, gl_FragCoord.xy / uRes, 0.0); }`;

  const FS_MAIN = `#version 300 es
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uLv; uniform vec2 uRes; uniform vec2 uC;
uniform float uR; uniform float uS; uniform float uCurve; uniform float uAmt; uniform float uGrain; uniform float uInv;
uniform float uSig[${NL}];
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 fc = gl_FragCoord.xy; vec2 uv = fc / uRes;
  float d = length(fc - uC);
  float m = 1.0 - smoothstep(uR, uR + max(uS, 1.0), d);
  m = pow(clamp(m, 0.0, 1.0), uCurve);
  m = mix(m, 1.0 - m, uInv);
  m = clamp(m + (hash(fc) - 0.5) * uGrain, 0.0, 1.0);
  float sg = m * uAmt;
  float lv = float(${NL - 1});
  for (int i = 1; i < ${NL}; i++) {
    if (sg <= uSig[i]) { lv = float(i - 1) + (sg - uSig[i - 1]) / (uSig[i] - uSig[i - 1]); break; }
  }
  float l0 = floor(lv); float f = lv - l0;
  vec3 a = texture(uLv, vec3(uv, l0)).rgb;
  vec3 b = texture(uLv, vec3(uv, min(l0 + 1.0, float(${NL - 1})))).rgb;
  vec3 col = mix(a, b, f) + (hash(fc + 17.3) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

  function prog(fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; p.u = n => loc[n] || (loc[n] = gl.getUniformLocation(p, n)); return p;
  }
  const pBlur = prog(FS_BLUR), pCopy = prog(FS_COPY), pMain = prog(FS_MAIN);
  const fbo = gl.createFramebuffer();

  /* ---------- textures ---------- */
  const subj = document.createElement('canvas'), sctx = subj.getContext('2d');
  let W = 0, H = 0, base = null, stack = null, scratch = {}, img = null, dirty = true;

  function tex2d(w, h, mips) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, mips ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function freeAll() {
    if (base) gl.deleteTexture(base);
    if (stack) gl.deleteTexture(stack);
    Object.values(scratch).forEach(s => { gl.deleteTexture(s.a); gl.deleteTexture(s.b); });
    base = stack = null; scratch = {};
  }

  function geometry() {
    const ev = x => 2 * Math.round(x / 2);   // even sizes: H.264 needs them
    if (c.ratio === 'custom') { const cl = (v, d) => Math.min(4096, Math.max(64, ev(+v || d))); return { w: cl(c.cw, 1080), h: cl(c.ch, 1350) }; }
    const r = c.ratio.split(':').map(Number), Q = +c.quality;
    return { w: ev(r[0] >= r[1] ? Q * r[0] / r[1] : Q), h: ev(r[0] >= r[1] ? Q : Q * r[1] / r[0]) };
  }

  function allocate() {
    const g = geometry();
    if (g.w === W && g.h === H && base) return;
    freeAll();
    W = canvas.width = subj.width = g.w; H = canvas.height = subj.height = g.h;
    base = tex2d(W, H, true);
    stack = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, stack);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, W, H, NL);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (gl.getError() === gl.OUT_OF_MEMORY) throw new Error('Not enough graphics memory for this quality. Try 1080.');
    dirty = true;
  }

  /* ---------- the subject: a text or an image over a flat background ---------- */
  function drawSubject() {
    const m = Math.min(W, H);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = c.bg; sctx.fillRect(0, 0, W, H);
    if (c.useImage && img) {
      const s = Math.min(W * c.isize / 100 / img.w, H * c.isize / 100 / img.h), dw = img.w * s, dh = img.h * s;
      sctx.drawImage(img.el, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const lines = String(c.text || '').split('\n'), fs = c.tsize / 100 * m;
      sctx.font = `700 ${fs}px "${c.font}", sans-serif`;
      let wide = Math.max.apply(null, lines.map(l => sctx.measureText(l).width));
      const k = wide > W * 0.94 ? W * 0.94 / wide : 1, size = fs * k;   // never let the text run off the frame
      sctx.font = `700 ${size}px "${c.font}", sans-serif`;
      sctx.fillStyle = c.tc; sctx.textAlign = 'center'; sctx.textBaseline = 'alphabetic';
      const lh = size * 1.0, mt = lines.map(l => sctx.measureText(l));
      const asc = mt[0].actualBoundingBoxAscent, desc = mt[mt.length - 1].actualBoundingBoxDescent;
      const total = (lines.length - 1) * lh + asc + desc;
      let y = H / 2 - total / 2 + asc;
      lines.forEach(l => { sctx.fillText(l, W / 2, y); y += lh; });
    }
  }

  /* ---------- blur levels: base -> 12 blurred copies (small blurs at full size, big ones on a mip of the subject) ---------- */
  function pass(p, target, w, h, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    if (target.layer !== undefined) gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, target.tex, 0, target.layer);
    else gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0);
    gl.viewport(0, 0, w, h); gl.useProgram(p); gl.uniform2f(p.u('uRes'), w, h);
    setup(); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const bindSrc = (p, tex, unit) => { gl.activeTexture(gl.TEXTURE0 + (unit || 0)); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(p.u('uSrc'), unit || 0); };

  function buildLevels() {
    drawSubject();
    gl.bindTexture(gl.TEXTURE_2D, base);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, subj);
    gl.generateMipmap(gl.TEXTURE_2D);
    const SC = Math.min(W, H) / 1080;
    for (let k = 0; k < NL; k++) {
      const sigma = LV[k] * SC;
      if (k === 0 || sigma < 0.05) {
        pass(pCopy, { tex: stack, layer: k }, W, H, () => bindSrc(pCopy, base));
        continue;
      }
      const lg = Math.max(0, Math.floor(Math.log2(sigma / 3))), d = 1 << lg;
      const sw = Math.max(1, Math.floor(W / d)), sh = Math.max(1, Math.floor(H / d));
      let s = scratch[d];
      if (!s) s = scratch[d] = { a: tex2d(sw, sh, false), b: tex2d(sw, sh, false), w: sw, h: sh };
      const ss = sigma / d;
      pass(pBlur, { tex: s.a }, sw, sh, () => { bindSrc(pBlur, base); gl.uniform1f(pBlur.u('uLod'), lg); gl.uniform2f(pBlur.u('uStep'), 1 / sw, 0); gl.uniform1f(pBlur.u('uSigma'), ss); });
      pass(pBlur, { tex: s.b }, sw, sh, () => { bindSrc(pBlur, s.a); gl.uniform1f(pBlur.u('uLod'), 0); gl.uniform2f(pBlur.u('uStep'), 0, 1 / sh); gl.uniform1f(pBlur.u('uSigma'), ss); });
      pass(pCopy, { tex: stack, layer: k }, W, H, () => bindSrc(pCopy, s.b));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    dirty = false;
  }

  /* ---------- motion: every path is made of whole harmonics of the loop, so frame N equals frame 0 ---------- */
  function motion(t) {
    const m = Math.min(W, H), A = c.amp / 100 * m, p = TAU * (t / c.T) * (+c.dir || 1);
    let dx = 0, dy = 0, rs = 1, af = 1;
    switch (c.mode) {
      case 'orbit': dx = A * Math.cos(p); dy = A * Math.sin(p); break;
      case 'eight': dx = A * Math.sin(p); dy = A * 0.55 * Math.sin(2 * p); break;
      case 'sweep': dx = A * Math.sin(p); break;
      case 'pendulum': dx = A * Math.sin(p); dy = A * 0.4 * Math.cos(2 * p); break;
      case 'wander':
        dx = A * (0.62 * Math.sin(p + 1.3) + 0.28 * Math.sin(2 * p + 4.1) + 0.18 * Math.sin(3 * p + 0.7));
        dy = A * (0.62 * Math.sin(p + 3.0) + 0.28 * Math.sin(3 * p + 2.2) + 0.18 * Math.sin(2 * p + 5.0)); break;
      case 'breathe': rs = 1 + 0.8 * Math.sin(p); break;
      case 'focus': af = 0.5 + 0.5 * Math.cos(p); break;
    }
    if (c.pulseR) rs *= 1 + c.pulseR / 100 * 0.7 * Math.sin(p);
    if (c.pulseB) af *= 1 - c.pulseB / 100 * (0.5 - 0.5 * Math.cos(p));
    return { dx, dy, rs: Math.max(0.05, rs), af };
  }

  /* where the controller is at time t, in canvas px with the origin at the top-left */
  function state(t) {
    const m = Math.min(W, H), mo = motion(t);
    return { x: c.cx * W + mo.dx, y: c.cy * H + mo.dy, r: c.radius / 100 * m * mo.rs, s: c.spread / 100 * m, dx: mo.dx, dy: mo.dy };
  }

  function render(t) {
    if (dirty) buildLevels();
    const m = Math.min(W, H), SC = m / 1080, mo = motion(t), st = state(t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H); gl.useProgram(pMain);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, stack); gl.uniform1i(pMain.u('uLv'), 0);
    gl.uniform2f(pMain.u('uRes'), W, H);
    gl.uniform2f(pMain.u('uC'), st.x, H - st.y);
    gl.uniform1f(pMain.u('uR'), st.r); gl.uniform1f(pMain.u('uS'), st.s);
    gl.uniform1f(pMain.u('uCurve'), c.falloff);
    gl.uniform1f(pMain.u('uAmt'), c.amount / 100 * LV[NL - 1] * SC * mo.af);
    gl.uniform1f(pMain.u('uGrain'), c.grain / 50);
    gl.uniform1f(pMain.u('uInv'), c.invert ? 1 : 0);
    gl.uniform1fv(pMain.u('uSig[0]'), new Float32Array(LV.map(v => v * SC)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.flush();
  }

  allocate();
  return {
    cfg: c, canvas, state, render,
    update(p) {
      const before = Object.assign({}, c);
      Object.assign(c, p);
      if (['ratio', 'quality', 'cw', 'ch'].some(k => before[k] !== c[k])) allocate();
      if (['text', 'font', 'tsize', 'tc', 'bg', 'useImage', 'isize', 'ratio', 'quality', 'cw', 'ch'].some(k => before[k] !== c[k])) dirty = true;
    },
    setImage(i) { img = i; dirty = true; },
    redraw() { dirty = true; },
    get size() { return { w: W, h: H }; }
  };
}

/* ---------- interface ---------- */
const $ = s => document.querySelector(s), cv = $('#cv'), art = $('#art'), gcv = $('#guideCv'), gctx = gcv.getContext('2d');
const NUM = ['tsize', 'isize', 'amount', 'radius', 'spread', 'falloff', 'grain', 'amp', 'T', 'dir', 'pulseR', 'pulseB', 'quality'];
const FONTS = ['Archivo', 'Inter', 'Space Grotesk', 'Montserrat', 'Roboto', 'Syne', 'Unbounded', 'Playfair Display', 'DM Serif Display', 'Oswald', 'Anton', 'Bebas Neue', 'Tinos', 'Times New Roman'];
FONTS.forEach(f => $('#font').add(new Option(f, f)));

let ctrl;
try {
  ctrl = blurField(cv, {
    text: 'a', font: 'Archivo', tsize: 70, tc: '#FFFFFF', bg: '#000000', useImage: false, isize: 70,
    amount: 45, radius: 14, spread: 35, falloff: 1, grain: 3, invert: false, guide: true, cx: 0.5, cy: 0.5,
    mode: 'orbit', dir: 1, amp: 24, T: 6, pulseR: 0, pulseB: 0, ratio: '3:4', quality: 1080, cw: 1080, ch: 1350
  });
} catch (e) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;padding:8px;background:rgba(0,0,0,.75);color:#fff;font:700 12px/1.3 system-ui,sans-serif;z-index:9';
  d.textContent = 'This tool needs WebGL 2 (' + (e.message || e) + '). Try Chrome, Edge, Firefox or Safari 15 or later.';
  document.querySelector('.stage').appendChild(d);
  throw e;
}
const syncAr = () => { const s = ctrl.size; art.style.setProperty('--ar', s.w / s.h); };   // CSS fits the frame inside the stage
syncAr();

function loadFontCss(name) {
  if (name === 'Times New Roman') return;
  const id = 'gf-' + name.replace(/ /g, '-');
  if (document.getElementById(id)) return;
  const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + ':wght@700&display=swap';
  document.head.appendChild(l);
}
function useFont() {
  const f = ctrl.cfg.font; loadFontCss(f);
  if (document.fonts && document.fonts.load) document.fonts.load(`700 64px "${f}"`, ctrl.cfg.text || 'a').then(() => ctrl.redraw(), () => {});
}

const inputs = [...document.querySelectorAll('[data-k]')];
const read = el => el.type === 'checkbox' ? el.checked : NUM.includes(el.dataset.k) ? +el.value : el.value;
function sync() {
  inputs.forEach(el => { const v = ctrl.cfg[el.dataset.k]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
}
inputs.forEach(el => el.addEventListener('input', () => {
  ctrl.update({ [el.dataset.k]: read(el) });
  if (el.dataset.k === 'font' || el.dataset.k === 'text') useFont();
  syncAr();
}));
sync(); useFont();

/* format buttons (same as the other tools) and the custom size */
const ev2 = v => Math.min(4096, Math.max(64, 2 * Math.round((+v || 1080) / 2)));
const ratioBtns = [...document.querySelectorAll('#ratios button')];
function syncFormat() {
  ratioBtns.forEach(b => b.classList.toggle('on', b.dataset.r === ctrl.cfg.ratio));
  const on = ctrl.cfg.ratio === 'custom';
  $('#customSize').hidden = !on; $('#quality').disabled = on;
  $('#cw').value = ctrl.cfg.cw; $('#ch').value = ctrl.cfg.ch;
}
ratioBtns.forEach(b => b.onclick = () => { ctrl.update({ ratio: b.dataset.r }); syncFormat(); syncAr(); specs(); ToolPersist.save(); });
['cw', 'ch'].forEach(id => $('#' + id).addEventListener('change', () => {
  $('#' + id).value = ev2($('#' + id).value);
  ctrl.update({ cw: +$('#cw').value, ch: +$('#ch').value }); syncAr(); specs(); ToolPersist.save();
}));
syncFormat();

/* readouts next to every slider: the value and its unit, like the other tools */
const FMT = {
  tsize: v => Math.round(v) + '%', isize: v => Math.round(v) + '%', amount: v => Math.round(v) + '%', radius: v => Math.round(v) + '%',
  spread: v => Math.round(v) + '%', falloff: v => '×' + (+v).toFixed(2), grain: v => (+v).toFixed(1) + '%',
  amp: v => Math.round(v) + '%', T: v => (+v).toFixed(1) + ' s', pulseR: v => Math.round(v) + '%', pulseB: v => Math.round(v) + '%'
};
const readouts = [...document.querySelectorAll('.menu input[type=range]')].map(r => [r, r.closest('.block').querySelector('output')]);
function paintReadouts() { readouts.forEach(([r, o]) => { if (o && FMT[r.id]) o.textContent = FMT[r.id](r.value); }); }
document.querySelector('.menu').addEventListener('input', () => { paintReadouts(); specs(); });
document.querySelector('.menu').addEventListener('change', () => { paintReadouts(); specs(); });
setInterval(paintReadouts, 400);   // values set from code (saved settings, random motion)
function specs() {
  const s = ctrl.size, fps = +$('#fps').value, T = ctrl.cfg.T;
  $('#specs').textContent = `Loop: ${T.toFixed(1)} s · ${Math.round(T * fps)} frames at ${fps} fps · ${s.w} × ${s.h} px.`;
}
$('#fps').addEventListener('change', specs);
paintReadouts(); specs();

/* image: PNG, JPG or SVG (picked or dropped). SVG gets explicit width/height so every browser can draw it,
   and its colors can be changed: each distinct color gets a picker, or one color is applied to all. */
const svgSt = { doc: null, w: 0, h: 0, list: [], map: {}, implicit: false, token: 0, url: null };
const nctx = document.createElement('canvas').getContext('2d');
const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'];
const SHAPES = /^(path|rect|circle|ellipse|polygon|polyline|text|tspan|use)$/i;
function normColor(v) {
  v = String(v || '').trim();
  if (!v || /^(none|transparent|inherit|initial|unset|url\(|context-)/i.test(v)) return null;
  if (/^currentcolor$/i.test(v)) v = '#000000';
  nctx.fillStyle = '#123456'; nctx.fillStyle = v;
  const r = nctx.fillStyle;
  if (r === '#123456' && !/123456/.test(v)) return null;   // not a color
  if (r[0] === '#') return r.toLowerCase();
  const m = r.match(/[\d.]+/g); return m ? '#' + [0, 1, 2].map(i => Math.round(+m[i]).toString(16).padStart(2, '0')).join('') : null;
}
const styleProps = el => (el.getAttribute('style') || '').split(';').map(d => d.split(':')).filter(a => a.length >= 2).map(a => [a[0].trim(), a.slice(1).join(':').trim()]);
function svgHasFill(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
    if (n.hasAttribute('fill') || styleProps(n).some(p => p[0] === 'fill')) return true;
  }
  return false;
}
function svgCollect(doc) {
  const found = [], add = v => { const c = normColor(v); if (c && !found.includes(c)) found.push(c); };
  let implicit = false;
  doc.querySelectorAll('*').forEach(el => {
    COLOR_ATTRS.forEach(a => { if (el.hasAttribute(a)) add(el.getAttribute(a)); });
    styleProps(el).forEach(p => { if (COLOR_ATTRS.includes(p[0])) add(p[1]); });
    if (/^style$/i.test(el.nodeName)) (el.textContent.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []).forEach(add);
    if (SHAPES.test(el.nodeName) && !el.closest('defs, clipPath, mask') && !svgHasFill(el)) implicit = true;
  });
  if (implicit && !found.includes('#000000')) found.push('#000000');
  svgSt.implicit = implicit;
  return found;
}
function svgRecolored() {
  const doc = svgSt.doc.cloneNode(true), map = svgSt.map;
  const sw = v => { const c = normColor(v); return c && map[c] ? map[c] : v; };
  doc.querySelectorAll('*').forEach(el => {
    COLOR_ATTRS.forEach(a => { if (el.hasAttribute(a)) el.setAttribute(a, sw(el.getAttribute(a))); });
    if (el.hasAttribute('style')) el.setAttribute('style', styleProps(el).map(p => p[0] + ':' + (COLOR_ATTRS.includes(p[0]) ? sw(p[1]) : p[1])).join(';'));
    if (/^style$/i.test(el.nodeName)) el.textContent = el.textContent.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi, m => sw(m));
  });
  const root = doc.documentElement;
  if (svgSt.implicit && map['#000000'] && !root.hasAttribute('fill')) root.setAttribute('fill', map['#000000']);   // shapes with no fill inherit the root's
  return new XMLSerializer().serializeToString(root);
}
async function svgApply() {
  const tk = ++svgSt.token;
  const url = URL.createObjectURL(new Blob([svgRecolored()], { type: 'image/svg+xml' }));
  const el = new Image(); el.src = url;
  try { await (el.decode ? el.decode() : new Promise((ok, no) => { el.onload = ok; el.onerror = no; })); } catch (e) { URL.revokeObjectURL(url); return; }
  if (tk !== svgSt.token) { URL.revokeObjectURL(url); return; }   // a newer change won
  if (svgSt.url) URL.revokeObjectURL(svgSt.url);
  svgSt.url = url; ctrl.setImage({ el, w: svgSt.w, h: svgSt.h });
}
function svgBuildList() {
  const box = $('#svgList'); box.textContent = '';
  svgSt.list.forEach(c => {
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = svgSt.map[c]; inp.title = 'Original ' + c.toUpperCase();
    inp.setAttribute('aria-label', 'SVG color ' + c.toUpperCase());
    inp.addEventListener('input', () => { svgSt.map[c] = inp.value; svgApply(); });
    box.appendChild(inp);
  });
  $('#svgBlock').hidden = !svgSt.list.length;
  if (window.ctBalance) window.ctBalance();
}
function svgReset() { svgSt.map = {}; svgSt.list.forEach(c => { svgSt.map[c] = c; }); svgBuildList(); svgApply(); }
$('#svgApply').onclick = () => { const v = $('#svgAll').value; svgSt.list.forEach(c => { svgSt.map[c] = v; }); svgBuildList(); svgApply(); };
$('#svgReset').onclick = svgReset;

async function loadImage(file) {
  if (!file) return;
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
  let url, w = 0, h = 0;
  try {
    if (isSvg) {
      const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml'), svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('not an SVG');
      doc.querySelectorAll('script, foreignObject').forEach(n => n.remove());   // only the drawing is used
      const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      const num = a => parseFloat(svg.getAttribute(a));
      w = vb.length === 4 && vb[2] > 0 ? vb[2] : num('width') || 1000;
      h = vb.length === 4 && vb[3] > 0 ? vb[3] : num('height') || 1000;
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      Object.assign(svgSt, { doc, w, h, list: svgCollect(doc) });
      svgSt.map = {}; svgSt.list.forEach(c => { svgSt.map[c] = c; });
      svgBuildList();
      if (svgSt.list[0]) $('#svgAll').value = svgSt.list[0];
      await svgApply(); ctrl.update({ useImage: true }); status('');
      return;
    }
    svgSt.doc = null; svgSt.list = []; svgBuildList();
    url = URL.createObjectURL(file);
    const el = new Image(); el.src = url;
    await (el.decode ? el.decode() : new Promise((ok, no) => { el.onload = ok; el.onerror = no; }));
    w = el.naturalWidth; h = el.naturalHeight;
    if (!w || !h) throw new Error('empty image');
    ctrl.setImage({ el, w, h }); ctrl.update({ useImage: true });
    status('');
  } catch (e) { status('Could not read that file. Use a PNG, JPG or SVG.'); }
}
$('#imgfile').addEventListener('change', e => loadImage(e.target.files[0]));
$('#useText').onclick = () => ctrl.update({ useImage: false });
['dragenter', 'dragover'].forEach(t => art.addEventListener(t, e => { e.preventDefault(); art.classList.add('drop'); }));
['dragleave', 'drop'].forEach(t => art.addEventListener(t, e => { e.preventDefault(); art.classList.remove('drop'); }));
art.addEventListener('drop', e => loadImage(e.dataTransfer.files[0]));

/* drag on the preview to place the controller (the motion is drawn around that point) */
let dragging = false;
function place(e) {
  const r = cv.getBoundingClientRect(), s = ctrl.size, st = ctrl.state(ctrl.cfg.tm);
  const x = (e.clientX - r.left) / r.width * s.w - st.dx, y = (e.clientY - r.top) / r.height * s.h - st.dy;
  ctrl.update({ cx: Math.min(1, Math.max(0, x / s.w)), cy: Math.min(1, Math.max(0, y / s.h)) });
  ToolPersist.save();
}
art.addEventListener('pointerdown', e => { dragging = true; art.setPointerCapture(e.pointerId); place(e); });
art.addEventListener('pointermove', e => { if (dragging) place(e); });
['pointerup', 'pointercancel'].forEach(t => art.addEventListener(t, () => { dragging = false; }));

const rnd = (a, b) => a + Math.random() * (b - a);
$('#rand').onclick = () => {
  const modes = ['orbit', 'eight', 'sweep', 'pendulum', 'wander', 'breathe', 'focus'];
  ctrl.update({
    mode: modes[Math.random() * modes.length | 0], dir: Math.random() < 0.5 ? 1 : -1,
    T: Math.round(rnd(3, 12) * 2) / 2, amp: Math.round(rnd(14, 38)),
    pulseR: Math.random() < 0.4 ? Math.round(rnd(20, 60)) : 0, pulseB: Math.random() < 0.3 ? Math.round(rnd(20, 60)) : 0
  });   // motion only: the subject and the blur look stay as you set them
  sync();
};
$('#play').onclick = () => {
  ctrl.update({ playing: !ctrl.cfg.playing });
  $('#play').textContent = ctrl.cfg.playing ? 'Pause' : 'Play';
};

/* ---------- preview loop + controller guide (the guide is a separate canvas: it never reaches an export) ---------- */
let last = performance.now();
function drawGuide() {
  const cw = Math.round(cv.clientWidth * (devicePixelRatio || 1)), ch = Math.round(cv.clientHeight * (devicePixelRatio || 1));
  if (gcv.width !== cw || gcv.height !== ch) { gcv.width = cw; gcv.height = ch; }
  gctx.clearRect(0, 0, cw, ch);
  if (!ctrl.cfg.guide) return;
  const s = ctrl.size, k = cw / s.w, st = ctrl.state(ctrl.cfg.tm), x = st.x * k, y = st.y * k;
  gctx.save(); gctx.globalCompositeOperation = 'difference'; gctx.strokeStyle = '#fff'; gctx.lineWidth = Math.max(1.5, cw / 600);
  gctx.setLineDash([cw / 120, cw / 160]); gctx.beginPath(); gctx.arc(x, y, Math.max(1, st.r * k), 0, TAU); gctx.stroke();
  gctx.setLineDash([]); const a = cw / 70; gctx.beginPath(); gctx.moveTo(x - a, y); gctx.lineTo(x + a, y); gctx.moveTo(x, y - a); gctx.lineTo(x, y + a); gctx.stroke();
  gctx.restore();
}
const TAU = Math.PI * 2;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (busy) return;
  if (ctrl.cfg.playing) ctrl.cfg.tm += dt;
  ctrl.render(ctrl.cfg.tm); drawGuide();
}
let busy = false;
requestAnimationFrame(frame);

/* ---------- export ---------- */
const status = t => { $('#status').textContent = t; };
$('#png').onclick = () => { ctrl.render(ctrl.cfg.tm); cv.toBlob(b => VideoExport.save('compound-blur.png', b)); };
$('#vid').onclick = async () => {
  const btn = $('#vid'), fps = +$('#fps').value;
  btn.disabled = true; busy = true;
  try {
    const out = await VideoExport.run({ canvas: cv, renderAt: t => ctrl.render(t), period: ctrl.cfg.T, fps, width: cv.width, height: cv.height, status });
    const r = await VideoExport.save('compound-blur-loop.' + out.ext, out.blob);
    status(r === 'saved' ? 'Saved · ' + out.note : 'Could not save the file (' + r + ').');
  } catch (e) { status('Video export failed: ' + (e.message || e)); }
  finally { busy = false; btn.disabled = false; }
};

/* ---------- remember the settings between visits ---------- */
ToolPersist.init('compound-blur', {
  get: () => ({ cx: ctrl.cfg.cx, cy: ctrl.cfg.cy, ratio: ctrl.cfg.ratio, cw: ctrl.cfg.cw, ch: ctrl.cfg.ch }),
  set: x => {
    if (typeof x.cx === 'number' && typeof x.cy === 'number') ctrl.update({ cx: x.cx, cy: x.cy });
    if (x.ratio && (/^\d+:\d+$/.test(x.ratio) || x.ratio === 'custom')) ctrl.update({ ratio: x.ratio, cw: ev2(x.cw), ch: ev2(x.ch) });
    sync(); syncFormat(); syncAr(); useFont(); paintReadouts(); specs();
  }
});
