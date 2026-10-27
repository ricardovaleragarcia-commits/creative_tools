/* Text on sphere: type a text and it wraps around a sphere. Engine (sphereLoop) ported as is from the
   "Text on sphere" artifact; the interface uses the platform blocks and the shared MP4 exporter. */
function sphereLoop(canvas, cfg) {
  const TW = 2048, TH = 1024, TAU = Math.PI * 2;
  const BOUNCE = [[1, 1, 1, 0.37], [1, 2, 3, 0], [1, 3, 2, 0.5], [2, 3, 5, 0.13], [2, 1, 2, 0.25], [3, 5, 4, 0.6], [1, 4, 4, 0], [2, 7, 5, 0.3], [3, 2, 7, 0.8], [1, 5, 1, 0.5]];
  const tex = document.createElement('canvas'); tex.width = TW; tex.height = TH;
  const tctx = tex.getContext('2d', { willReadFrequently: true });
  const sph = document.createElement('canvas'); const sctx = sph.getContext('2d');
  const ctx = canvas.getContext('2d');
  const c = Object.assign({ playing: true, tm: 0 }, cfg);
  const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  let G, ta, sd, raf, last = performance.now();

  function loadFontCss(name) {
    if (name === 'Times New Roman') return;
    const id = 'gf-' + name.replace(/ /g, '-');
    if (document.getElementById(id)) return;
    const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + '&display=swap';
    document.head.appendChild(l);
  }

  function buildGeom() {
    const ev = x => 2 * Math.round(x / 2);   // even sizes: H.264 needs them
    const cl = (v, d) => Math.min(4096, Math.max(64, ev(+v || d)));
    let W, H;
    if (c.ratio === 'custom') { W = cl(c.cw, 1080); H = cl(c.ch, 1350); }
    else {
      const r = c.ratio.split(':').map(Number), Q = c.quality;
      W = ev(r[0] >= r[1] ? Q * r[0] / r[1] : Q);
      H = ev(r[0] >= r[1] ? Q : Q * r[1] / r[0]);
    }
    canvas.width = W; canvas.height = H;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * c.size / 200;
    const x0 = Math.floor(cx - R) - 2, y0 = Math.floor(cy - R) - 2, S = Math.ceil(2 * R) + 5;
    sph.width = S; sph.height = S; sd = sctx.createImageData(S, S);
    const d = sd.data, a = c.tilt * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const idx = [], bu = [], vr = [];
    for (let by = 0; by < S; by++) for (let bx = 0; bx < S; bx++) {
      const px = x0 + bx + 0.5 - cx, py = y0 + by + 0.5 - cy;
      const cov = Math.min(1, Math.max(0, R - Math.hypot(px, py) + 0.5));
      if (cov <= 0) continue;
      const dx = px / R, dy = -py / R, z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      const y2 = dy * ca - z * sa, z2 = dy * sa + z * ca;
      const lon = Math.atan2(dx, z2), lat = Math.asin(Math.max(-1, Math.min(1, y2)));
      const p = (by * S + bx) * 4;
      d[p + 3] = cov * 255;
      idx.push(p); bu.push((lon / TAU + 0.5) * TW);
      vr.push(Math.min(TH - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * TH))));
    }
    G = { W, H, cx, cy, R, x0, y0, idx: Int32Array.from(idx), bu: Float32Array.from(bu), vr: Int32Array.from(vr) };
  }

  function buildTex() {
    const lines = c.text.split('\n').filter(s => s.trim());
    const n = Math.max(1, lines.length), fs = TH * 0.32 * (c.tsize / 100) / n;
    tctx.clearRect(0, 0, TW, TH); tctx.fillStyle = '#fff';
    tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
    tctx.font = `400 ${fs}px "${c.font}", sans-serif`;
    lines.forEach((ln, i) => {
      const y = TH / 2 + (i - (n - 1) / 2) * fs * 0.92, w = tctx.measureText(ln).width;
      const m = c.repeat ? Math.max(1, Math.round(TW / (w + fs * 0.9))) : 1;
      for (let k = 0; k < m; k++) tctx.fillText(ln, (k + 0.5) * TW / m, y);
    });
    const d = tctx.getImageData(0, 0, TW, TH).data;
    ta = new Uint8Array(TW * TH);
    for (let i = 0; i < ta.length; i++) ta[i] = d[i * 4 + 3];
  }

  function draw() {
    const d = sd.data, { idx, bu, vr } = G, n = idx.length;
    const sc = hex(c.sc), tc = hex(c.tc);
    const ph = (c.tm / c.T) % 1;
    let f;
    switch (c.mode) {
      case 'vaiven': f = 0.15 * Math.sin(TAU * ph); break;
      case 'pulso': f = ph + 0.035 * Math.sin(TAU * ph); break;
      case 'rebote': f = 0.25 * (1 - Math.abs(2 * ph - 1)); break;
      default: f = ph;
    }
    const off = (((c.dir * f * TW) % TW) + TW) % TW;
    if (c.eje) {
      const th = -TAU * c.tm / (c.spin || 6), phi = c.axis * Math.PI / 180;
      const nx = Math.cos(phi), ny = -Math.sin(phi), cc = Math.cos(th), ss = Math.sin(th), t = 1 - cc;
      const M = [cc + t * nx * nx, t * nx * ny, ss * ny, t * nx * ny, cc + t * ny * ny, -ss * nx, -ss * ny, ss * nx, cc];
      const a = c.tilt * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const Tx = [1, 0, 0, 0, ca, -sa, 0, sa, ca], A = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i * 3 + j] = Tx[i * 3] * M[j] + Tx[i * 3 + 1] * M[3 + j] + Tx[i * 3 + 2] * M[6 + j];
      const S = sph.width, R = G.R, cx = G.cx, cy = G.cy;
      for (let k = 0; k < n; k++) {
        const p = idx[k], bi = p >> 2, bx = bi % S, by = (bi - bx) / S;
        const dx = (G.x0 + bx + 0.5 - cx) / R, dy = -(G.y0 + by + 0.5 - cy) / R;
        const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
        const qx = A[0] * dx + A[1] * dy + A[2] * z, qy = A[3] * dx + A[4] * dy + A[5] * z, qz = A[6] * dx + A[7] * dy + A[8] * z;
        let u = (Math.atan2(qx, qz) / TAU + 0.5) * TW + off; u %= TW; if (u < 0) u += TW;
        let v = Math.floor((0.5 - Math.asin(Math.max(-1, Math.min(1, qy))) / Math.PI) * TH);
        v = v < 0 ? 0 : v >= TH ? TH - 1 : v;
        const a2 = ta[v * TW + (u | 0)] / 255;
        d[p] = sc[0] + (tc[0] - sc[0]) * a2; d[p + 1] = sc[1] + (tc[1] - sc[1]) * a2; d[p + 2] = sc[2] + (tc[2] - sc[2]) * a2;
      }
    } else for (let k = 0; k < n; k++) {
      let u = bu[k] + off; if (u >= TW) u -= TW;
      const a = ta[vr[k] * TW + (u | 0)] / 255, p = idx[k];
      d[p] = sc[0] + (tc[0] - sc[0]) * a;
      d[p + 1] = sc[1] + (tc[1] - sc[1]) * a;
      d[p + 2] = sc[2] + (tc[2] - sc[2]) * a;
    }
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, G.W, G.H);
    sctx.putImageData(sd, 0, 0);
    let sx = G.cx, sy = G.cy, rot = 0;
    const R = G.R, tri = x => { const f = x - Math.floor(x); return 1 - Math.abs(2 * f - 1); };
    if (c.fx === 'rebote') {
      const lx = Math.min(R, G.cx), hx = Math.max(G.W - R, G.cx), ly = Math.min(R, G.cy), hy = Math.max(G.H - R, G.cy);
      const B = BOUNCE[c.bseed | 0] || BOUNCE[0], u = (c.tm / (c.T * B[0])) % 1;
      sx = lx + (hx - lx) * tri(B[1] * u); sy = ly + (hy - ly) * tri(B[2] * u + B[3]);
    } else if (c.fx === 'orbita') {
      const r = Math.max(0, (Math.min(G.W, G.H) - 2 * R) / 2);
      sx = G.cx + r * Math.cos(TAU * ph); sy = G.cy + r * Math.sin(TAU * ph);
    } else if (c.fx === 'pendulo') {
      const a = 0.5 * Math.sin(TAU * ph), L = G.cy;
      sx = G.cx - L * Math.sin(a); sy = L * Math.cos(a); rot = a;
    }
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
    // spin on axis: resolved in the pixel loop
    ctx.drawImage(sph, G.x0 - G.cx, G.y0 - G.cy);
    if (c.border) {
      ctx.beginPath(); ctx.arc(0, 0, R - c.bw / 2, 0, TAU);
      ctx.lineWidth = c.bw; ctx.strokeStyle = c.bc; ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now) {
    if (c.playing) c.tm += (now - last) / 1000;
    last = now;
    if (G && ta) draw();
    raf = requestAnimationFrame(frame);
  }

  function update(p) {
    const before = Object.assign({}, c);
    Object.assign(c, p);
    const geo = ['ratio', 'quality', 'size', 'tilt', 'cw', 'ch'].some(k => before[k] !== c[k]);
    const tx = ['text', 'font', 'tsize', 'repeat'].some(k => before[k] !== c[k]);
    if (geo || !G) buildGeom();
    if (tx || !ta) {
      loadFontCss(c.font); buildTex();
      if (document.fonts) document.fonts.load(`100px "${c.font}"`).then(buildTex, () => {});
    }
  }

  update({});
  raf = requestAnimationFrame(frame);
  return { update, cfg: c, bounce: BOUNCE, restart() { c.tm = 0; }, render(t) { c.tm = t; if (G && ta) draw(); }, stop() { cancelAnimationFrame(raf); } };
}

/* ---------- interface ---------- */
const $ = s => document.querySelector(s), cv = $('#cv'), art = $('#art');
const NUM = ['tsize', 'size', 'tilt', 'T', 'quality', 'cw', 'ch', 'bw', 'dir', 'axis', 'spin', 'bseed'];
const FONTS = ['Archivo', 'Inter', 'Space Grotesk', 'Montserrat', 'Roboto', 'Syne', 'Unbounded', 'Playfair Display', 'DM Serif Display', 'Oswald', 'Anton', 'Bebas Neue', 'Tinos', 'Times New Roman'];
const RATIOS = { '1:1': 'Square 1:1', '4:5': 'Portrait 4:5', '3:4': 'Portrait 3:4', '9:16': 'Vertical 9:16', '16:9': 'Horizontal 16:9' };
FONTS.forEach(f => $('#font').add(new Option(f, f)));
Object.entries(RATIOS).forEach(([k, v]) => $('#ratio').add(new Option(v, k)));
$('#ratio').add(new Option('Custom size…', 'custom'));

const ctrl = sphereLoop(cv, {
  text: 'your text here', font: 'Archivo', tsize: 30, size: 72, tilt: -30, repeat: true,
  mode: 'giro', dir: 1, T: 6, ratio: '3:4', quality: 1080, cw: 1080, ch: 1350,
  bg: '#000000', sc: '#FFFFFF', tc: '#000000', border: false, bc: '#000000', bw: 1.5, playing: true, fx: '', axis: 0, spin: 6, bseed: 0
});
const syncAr = () => art.style.setProperty('--ar', cv.width / cv.height);   // CSS fits the frame inside the stage
syncAr();

const inputs = [...document.querySelectorAll('[data-k]')];
const read = el => el.type === 'checkbox' ? el.checked : NUM.includes(el.dataset.k) ? +el.value : el.value;
function sync() {
  inputs.forEach(el => { const v = ctrl.cfg[el.dataset.k]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
}
inputs.forEach(el => el.addEventListener(el.type === 'number' ? 'change' : 'input', () => {   // numbers apply when committed, not on every keystroke
  if (el.type === 'number') el.value = Math.min(4096, Math.max(64, 2 * Math.round((+el.value || 1080) / 2)));
  ctrl.update({ [el.dataset.k]: read(el) }); syncAr(); syncCustom();
}));
function syncCustom() { const on = ctrl.cfg.ratio === 'custom'; $('#customSize').hidden = !on; document.querySelector('[data-k=quality]').disabled = on; }
sync(); syncCustom();

const rnd = (a, b) => a + Math.random() * (b - a);
$('#rand').onclick = () => {
  const modes = ['giro', 'vaiven', 'pulso', 'rebote'];
  ctrl.update({
    mode: modes[Math.random() * 4 | 0], dir: Math.random() < 0.5 ? 1 : -1,
    T: Math.round(rnd(3, 12) * 2) / 2   // motion only: text size, tilt and the rest of the look stay as you set them
  });
  sync();
};

const fxBtns = [...document.querySelectorAll('[data-fx]')];
function setFx(v) { ctrl.update({ fx: v }); fxBtns.forEach(b => b.classList.toggle('on', b.dataset.fx === v)); }
fxBtns.forEach(b => b.onclick = () => setFx(ctrl.cfg.fx === b.dataset.fx ? '' : b.dataset.fx));
$('#eje').onclick = () => { const on = !ctrl.cfg.eje; ctrl.update({ eje: on }); $('#eje').classList.toggle('on', on); };
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * cv.width / r.width - cv.width / 2;
  const y = (e.clientY - r.top) * cv.height / r.height - cv.height / 2;
  ctrl.update({ axis: Math.round(Math.atan2(y, x) * 180 / Math.PI + 360) % 360 });
  sync(); ToolPersist.save();
});

$('#play').onclick = () => {
  ctrl.update({ playing: !ctrl.cfg.playing });
  $('#play').textContent = ctrl.cfg.playing ? 'Pause' : 'Play';
};

/* ---------- export ---------- */
const status = t => { $('#status').textContent = t; };
$('#png').onclick = () => cv.toBlob(b => VideoExport.save('text-orbit.png', b));

function loopLength() {
  const c = ctrl.cfg;
  const m = c.fx === 'rebote' ? ctrl.bounce[c.bseed | 0][0] : 1;
  const L = c.T * m;
  if (!c.eje) return L;
  const g = (x, y) => y ? g(y, x % y) : x;
  const a = Math.round(L * 2), b = Math.round((c.spin || 6) * 2);
  return Math.min((a * b / g(a, b)) / 2, 60);
}
$('#vid').onclick = async () => {
  const btn = $('#vid'), fps = +$('#fps').value, wasPlaying = ctrl.cfg.playing;
  btn.disabled = true; ctrl.update({ playing: false });
  try {
    const out = await VideoExport.run({ canvas: cv, renderAt: t => ctrl.render(t), period: loopLength(), fps, width: cv.width, height: cv.height, status });
    const r = await VideoExport.save('text-orbit-loop.' + out.ext, out.blob);
    status(r === 'saved' ? 'Saved · ' + out.note : 'Could not save the file (' + r + ').');
  } catch (e) { status('Video export failed: ' + (e.message || e)); }
  finally { ctrl.update({ playing: wasPlaying }); btn.disabled = false; }
};

$('#code').onclick = () => {
  const cfgJs = JSON.stringify(Object.assign({}, ctrl.cfg, { tm: 0, playing: true }));
  $('#src').value = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Text on sphere</title>\n<style>html,body{margin:0;height:100%;background:#111}body{display:flex;align-items:center;justify-content:center}canvas{max-width:100vw;max-height:100vh;width:auto;height:auto}</style></head>\n<body><canvas id="c"></canvas>\n<script>\n${sphereLoop.toString()}\nsphereLoop(document.getElementById("c"), ${cfgJs});\n<\/script></body></html>`;
  $('#dlg').showModal();
};
$('#cp').onclick = () => navigator.clipboard.writeText($('#src').value);
$('#dl').onclick = () => VideoExport.save('text-orbit.html', new Blob([$('#src').value], { type: 'text/html' }));
$('#close').onclick = () => $('#dlg').close();

/* ---------- remember the settings between visits ---------- */
const SAVED = ['text', 'font', 'tsize', 'size', 'tilt', 'repeat', 'mode', 'dir', 'T', 'ratio', 'quality', 'cw', 'ch', 'bg', 'sc', 'tc', 'border', 'bc', 'bw', 'fx', 'eje', 'axis', 'spin', 'bseed'];
ToolPersist.init('text-orbit', {
  get: () => Object.fromEntries(SAVED.map(k => [k, ctrl.cfg[k]])),
  set: x => {
    const c = {}; SAVED.forEach(k => { if (k in x && x[k] !== undefined) c[k] = x[k]; });
    ctrl.update(c); sync(); syncAr();
    fxBtns.forEach(b => b.classList.toggle('on', b.dataset.fx === ctrl.cfg.fx));
    $('#eje').classList.toggle('on', !!ctrl.cfg.eje);
  }
});
