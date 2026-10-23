const FS = 120, MAXL = 20, BASE = 3.4, HOLD = 1.0;
const RATIOS = {"1:1":[1080,1080],"4:5":[1080,1350],"3:4":[1080,1440],"9:16":[1080,1920],"16:9":[1920,1080]};
const $ = id => document.getElementById(id);
const prev = $('preview'), pctx = prev.getContext('2d');
const octx = document.createElement('canvas').getContext('2d');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
let ratio = '3:4', letters = [], bounds = null, srcKind = 'text', playing = true, playMs = 0, last = 0, timer = 0, recording = false;
let CURVE = {x1:0.45, y1:0.05, x2:0.15, y2:1};
const layerCanvases = {};

// ---------- Curva de Bézier (easing) ----------
function bezAt(t, a, b){ const u = 1-t; return 3*u*u*t*a + 3*u*t*t*b + t*t*t; }
function ease(x){
  if(x <= 0) return 0; if(x >= 1) return 1;
  const {x1,y1,x2,y2} = CURVE; let lo = 0, hi = 1;
  for(let i = 0; i < 24; i++){ const m = (lo+hi)/2; if(bezAt(m,x1,x2) < x) lo = m; else hi = m; }
  return bezAt((lo+hi)/2, y1, y2);
}

// ---------- Texto -> letras ----------
function limitText(s){
  let n = 0, out = '';
  for(const ch of s){ if(ch.trim()){ if(n >= MAXL) continue; n++; } out += ch; }
  return {text: out, n};
}
function buildTextLetters(text){
  const fam = $('font').value, out = [];
  octx.font = `bold ${FS}px ${fam}`;
  text.split('\n').forEach((line, li) => {
    const base = li*FS*1.25 + FS; let x = 0;
    for(const ch of line){
      const m = octx.measureText(ch);
      if(ch.trim()) out.push({text:true, ch, fam, x, y:base,
        bb:[x - m.actualBoundingBoxLeft, base - m.actualBoundingBoxAscent, x + m.actualBoundingBoxRight, base + m.actualBoundingBoxDescent]});
      x += m.width;
    }
  });
  return out;
}

// ---------- SVG -> letras vectoriales ----------
const isVis = c => !!c && c !== 'none' && c !== 'transparent' && !/,\s*0(\.0+)?\)$/.test(c);
function localPath(el){
  const g = a => parseFloat(el.getAttribute(a)) || 0, p = new Path2D(), tag = el.tagName.toLowerCase();
  switch(tag){
    case 'path': return new Path2D(el.getAttribute('d') || '');
    case 'rect': p.rect(g('x'), g('y'), g('width'), g('height')); break;
    case 'circle': p.arc(g('cx'), g('cy'), g('r'), 0, Math.PI*2); break;
    case 'ellipse': p.ellipse(g('cx'), g('cy'), g('rx'), g('ry'), 0, 0, Math.PI*2); break;
    case 'line': p.moveTo(g('x1'), g('y1')); p.lineTo(g('x2'), g('y2')); break;
    default: {
      const n = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      for(let i = 0; i + 1 < n.length; i += 2){ if(i === 0) p.moveTo(n[0], n[1]); else p.lineTo(n[i], n[i+1]); }
      if(tag === 'polygon') p.closePath();
    }
  }
  return p;
}
function groupOf(shapes){
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for(const s of shapes){ x0=Math.min(x0,s.box[0]); y0=Math.min(y0,s.box[1]); x1=Math.max(x1,s.box[2]); y1=Math.max(y1,s.box[3]); }
  return {shapes, bb:[x0,y0,x1,y1]};
}
// Dos trazos están unidos solo si sus píxeles se tocan (cajas solapadas no bastan en tipografía cursiva o con kerning)
function alphaMask(r, T, w, h, grow){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', {willReadFrequently:true});
  x.setTransform(T.multiply(r.M)); x.fillStyle = '#000'; x.fill(r.path, r.rule);
  if(grow){ x.strokeStyle = '#000'; x.lineWidth = grow; x.lineJoin = 'round'; x.stroke(r.path); }
  return x.getImageData(0,0,w,h).data;
}
function touches(a, b){
  const x0 = Math.max(a.box[0],b.box[0])-4, y0 = Math.max(a.box[1],b.box[1])-4;
  const x1 = Math.min(a.box[2],b.box[2])+4, y1 = Math.min(a.box[3],b.box[3])+4;
  if(x1 <= x0 || y1 <= y0) return false;
  const sc = 600 / Math.max(x1-x0, y1-y0), w = Math.ceil((x1-x0)*sc)+2, h = Math.ceil((y1-y0)*sc)+2;
  const T = new DOMMatrix([sc,0,0,sc,-x0*sc,-y0*sc]);
  const A = alphaMask(a, T, w, h, 0), B = alphaMask(b, T, w, h, 3);
  for(let i = 3; i < A.length; i += 4) if(A[i] > 0 && B[i] > 0) return true;
  return false;
}
function parseSvgLetters(text){
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const src = doc.documentElement;
  if(!src || src.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length)
    throw new Error('That file is not a valid SVG.');
  const svg = document.importNode(src, true);
  svg.querySelectorAll('script').forEach(n => n.remove());
  if(!svg.getAttribute('viewBox')){
    const w = parseFloat(svg.getAttribute('width')) || 1000, h = parseFloat(svg.getAttribute('height')) || 1000;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  svg.setAttribute('width', '1000'); svg.setAttribute('height', '1000');
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-20000px;top:0;width:1000px;height:1000px;opacity:0;pointer-events:none';
  host.appendChild(svg); document.body.appendChild(host);
  let recs = [], warning = '';
  try{
    if(svg.querySelector('text')) warning = 'The SVG has live text (<text>): convert it to outlines in your editor so it animates properly.';
    const inv = svg.getScreenCTM().inverse();
    svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line').forEach(el => {
      if(el.closest('defs,clipPath,mask,symbol,pattern,marker')) return;
      const cs = getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden') return;
      const hasFill = isVis(cs.fill), hasStroke = isVis(cs.stroke) && parseFloat(cs.strokeWidth) > 0;
      if(!hasFill && !hasStroke) return;
      const ctm = el.getScreenCTM(); if(!ctm) return;
      const M = inv.multiply(ctm), bb = el.getBBox();
      if(bb.width === 0 && bb.height === 0) return;
      const pts = [[bb.x,bb.y],[bb.x+bb.width,bb.y],[bb.x,bb.y+bb.height],[bb.x+bb.width,bb.y+bb.height]]
        .map(([x,y]) => { const q = new DOMPoint(x,y).matrixTransform(M); return [q.x, q.y]; });
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      recs.push({M, path: localPath(el), box:[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        fill: hasFill ? cs.fill : null, stroke: hasStroke ? cs.stroke : null, sw: parseFloat(cs.strokeWidth) || 0,
        rule: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
        alpha: (parseFloat(cs.opacity) || 1) * (parseFloat(cs.fillOpacity) || 1)});
    });
  } finally { host.remove(); }
  if(!recs.length) return {letters:[], warning};

  // quitar fondo: una forma que cubre todo el logotipo
  if(recs.length > 3){
    const gx0 = Math.min(...recs.map(r=>r.box[0])), gy0 = Math.min(...recs.map(r=>r.box[1]));
    const gx1 = Math.max(...recs.map(r=>r.box[2])), gy1 = Math.max(...recs.map(r=>r.box[3]));
    const W0 = gx1-gx0, H0 = gy1-gy0;
    recs = recs.filter(r => !((r.box[2]-r.box[0]) >= 0.96*W0 && (r.box[3]-r.box[1]) >= 0.96*H0));
  }
  // agrupar formas que se tocan (una letra = piezas conectadas)
  const n = recs.length, par = Array.from({length:n}, (_,i) => i);
  const find = i => { while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  const hit = (a,b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++)
    if(hit(recs[i].box, recs[j].box) && touches(recs[i], recs[j])) par[find(i)] = find(j);
  const gm = new Map();
  recs.forEach((r,i) => { const k = find(i); if(!gm.has(k)) gm.set(k, []); gm.get(k).push(r); });
  let groups = [...gm.values()].map(groupOf);
  // unir puntos e acentos (piezas pequeñas sobre una letra) con su letra
  let merged = true;
  while(merged){
    merged = false;
    outer: for(let a=0;a<groups.length;a++) for(let b=a+1;b<groups.length;b++){
      const A = groups[a].bb, B = groups[b].bb;
      const ox = Math.min(A[2],B[2]) - Math.max(A[0],B[0]);
      const minW = Math.min(A[2]-A[0], B[2]-B[0]);
      const hA = A[3]-A[1], hB = B[3]-B[1];
      if(ox > 0.6*minW && minW > 0 && Math.min(hA,hB) < 0.5*Math.max(hA,hB)){
        groups[a] = groupOf([...groups[a].shapes, ...groups[b].shapes]);
        groups.splice(b,1); merged = true; break outer;
      }
    }
  }
  groups.sort((a,b) => (a.bb[0]+a.bb[2]) - (b.bb[0]+b.bb[2]));
  return {letters: groups.map(g => ({svg:true, shapes:g.shapes, bb:g.bb})), warning};
}

// ---------- Letras, escena y ajuste ----------
function setLetters(list, kind){
  letters = list; srcKind = kind;
  const n = letters.length;
  letters.forEach((L,i) => { L.order = n > 1 ? i/(n-1) : 0; });
  bounds = n ? [Math.min(...letters.map(L=>L.bb[0])), Math.min(...letters.map(L=>L.bb[1])),
                Math.max(...letters.map(L=>L.bb[2])), Math.max(...letters.map(L=>L.bb[3]))] : null;
  randomize();
}
function randomize(){
  for(const L of letters){
    const [x0,y0,x1,y1] = L.bb;
    L.sx = x0 + Math.random()*(x1-x0); L.sy = y0 + Math.random()*(y1-y0);
    L.angle = Math.random()*Math.PI*2; L.ver = (L.ver||0)+1;
  }
}
function fitFor(W,H){
  const [X0,Y0,X1,Y1] = bounds, w = Math.max(X1-X0,1), h = Math.max(Y1-Y0,1);
  const s = Math.min(0.84*W/w, 0.84*H/h);
  return {s, ox: W/2 - ((X0+X1)/2)*s, oy: H/2 - ((Y0+Y1)/2)*s};
}
function layerFor(W,H){
  const k = W+'x'+H;
  if(!layerCanvases[k]){ const c = document.createElement('canvas'); c.width = W; c.height = H; layerCanvases[k] = c; }
  return layerCanvases[k];
}

// ---------- Dibujo de una letra (vector o texto) ----------
function drawLetter(c, L, f, fg, keep){
  if(!L.svg){
    c.setTransform(f.s,0,0,f.s,f.ox,f.oy);
    c.font = `bold ${FS}px ${L.fam}`; c.textBaseline = 'alphabetic'; c.fillStyle = fg;
    c.fillText(L.ch, L.x, L.y);
    c.setTransform(1,0,0,1,0,0); return;
  }
  const T = new DOMMatrix([f.s,0,0,f.s,f.ox,f.oy]);
  for(const sh of L.shapes){
    c.setTransform(T.multiply(sh.M)); c.globalAlpha = sh.alpha;
    if(sh.fill){ c.fillStyle = keep ? sh.fill : fg; c.fill(sh.path, sh.rule); }
    if(sh.stroke){ c.strokeStyle = keep ? sh.stroke : fg; c.lineWidth = sh.sw; c.stroke(sh.path); }
  }
  c.globalAlpha = 1; c.setTransform(1,0,0,1,0,0);
}

// ---------- Recorrido: el frente de revelado avanza por la forma de cada letra ----------
function dijkstra(m, W, H, s, dist){
  dist[s] = 0;
  const hk = [0], hv = [s];
  while(hk.length){
    const u = hv[0], uk = hk[0], lk = hk.pop(), lv = hv.pop();
    if(hk.length){
      let i = 0; const n = hk.length;
      while(true){
        let c = 2*i+1; if(c >= n) break;
        if(c+1 < n && hk[c+1] < hk[c]) c++;
        if(hk[c] >= lk) break;
        hk[i] = hk[c]; hv[i] = hv[c]; i = c;
      }
      hk[i] = lk; hv[i] = lv;
    }
    if(uk > dist[u]) continue;
    const ux = u % W, uy = (u/W) | 0;
    for(let dy=-1; dy<2; dy++) for(let dx=-1; dx<2; dx++){
      if(!dx && !dy) continue;
      const nx = ux+dx, ny = uy+dy;
      if(nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const v = ny*W + nx; if(!m[v]) continue;
      const nd = dist[u] + (dx && dy ? 1.4142 : 1);
      if(nd < dist[v]){
        dist[v] = nd;
        let i = hk.length; hk.push(nd); hv.push(v);
        while(i > 0){ const q = (i-1) >> 1; if(hk[q] <= nd) break; hk[i] = hk[q]; hv[i] = hv[q]; i = q; }
        hk[i] = nd; hv[i] = v;
      }
    }
  }
}
// Tiempo de aparición de cada píxel = distancia recorrida dentro de la forma desde un inicio aleatorio por pieza
function geodesicTimes(m, w, h){
  const N = w*h, time = new Float32Array(N).fill(-1), dist = new Float64Array(N).fill(Infinity);
  const seen = new Uint8Array(N), stack = [];
  for(let s0 = 0; s0 < N; s0++){
    if(!m[s0] || seen[s0]) continue;
    const comp = []; seen[s0] = 1; stack.push(s0);
    while(stack.length){
      const p = stack.pop(); comp.push(p);
      const x = p % w, y = (p/w) | 0;
      if(x+1 < w && m[p+1] && !seen[p+1]){ seen[p+1] = 1; stack.push(p+1); }
      if(x > 0 && m[p-1] && !seen[p-1]){ seen[p-1] = 1; stack.push(p-1); }
      if(y+1 < h && m[p+w] && !seen[p+w]){ seen[p+w] = 1; stack.push(p+w); }
      if(y > 0 && m[p-w] && !seen[p-w]){ seen[p-w] = 1; stack.push(p-w); }
    }
    dijkstra(m, w, h, comp[(Math.random()*comp.length) | 0], dist);
    let maxD = 0; for(const p of comp) if(dist[p] > maxD) maxD = dist[p];
    for(const p of comp) time[p] = maxD > 0 ? dist[p]/maxD : 0;
  }
  return time;
}
function dilate(m, W, H, k){
  let cur = m;
  for(let r = 0; r < k; r++){
    const o = cur.slice();
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      if(!cur[y*W+x]) continue;
      for(let dy=-1;dy<2;dy++) for(let dx=-1;dx<2;dx++){
        const nx=x+dx, ny=y+dy;
        if(nx>=0 && ny>=0 && nx<W && ny<H) o[ny*W+nx] = 1;
      }
    }
    cur = o;
  }
  return cur;
}
// Caché por letra: región de la letra en el lienzo, su relleno y los tiempos del recorrido
function letterCache(L, W, H){
  const f = fitFor(W,H), exp = Math.max(1, Math.round(W/1080));
  const fg = $('fg').value, keep = $('keep').checked;
  const sig = [W,H,L.ver,exp,fg,keep,$('font').value,srcKind].join('|');
  if(L.cache && L.cache.sig === sig) return L.cache;
  const sb = [L.bb[0]*f.s+f.ox, L.bb[1]*f.s+f.oy, L.bb[2]*f.s+f.ox, L.bb[3]*f.s+f.oy];
  const pad = exp + 6;
  const rx = Math.max(0, Math.floor(sb[0]-pad)), ry = Math.max(0, Math.floor(sb[1]-pad));
  const rw = Math.min(W, Math.ceil(sb[2]+pad)) - rx, rh = Math.min(H, Math.ceil(sb[3]+pad)) - ry;
  const mk = () => { const c = document.createElement('canvas'); c.width = rw; c.height = rh; return c; };
  const src = mk(), sctx = src.getContext('2d');
  drawLetter(sctx, L, {s:f.s, ox:f.ox-rx, oy:f.oy-ry}, fg, keep);
  const N = rw*rh, a = sctx.getImageData(0,0,rw,rh).data;
  let m = new Uint8Array(N);
  for(let i=0;i<N;i++) m[i] = a[i*4+3] > 8 ? 1 : 0;
  m = dilate(m, rw, rh, exp);
  const mcv = mk(), work = mk();
  L.cache = {sig, rx, ry, rw, rh, src, mcv, mctx: mcv.getContext('2d'), work, wctx: work.getContext('2d'),
             time: geodesicTimes(m, rw, rh), mImg: mcv.getContext('2d').createImageData(rw, rh)};
  return L.cache;
}

// t: progreso lineal global 0..1
function renderFrame(ctx, W, H, t){
  const bg = $('bg').value, fg = $('fg').value, keep = $('keep').checked;
  if(window.setFrameBg) window.setFrameBg(bg);
  const F = Math.max(0.02, +$('suav').value), stag = +$('st').value;
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
  if(!letters.length || !bounds) return;
  const f = fitFor(W,H);
  for(const L of letters){
    const p = ease(clamp((t - stag*L.order) / (1 - stag)));
    if(p >= 1){ drawLetter(ctx, L, f, fg, keep); continue; }
    if(p <= 0) continue;
    const C = letterCache(L, W, H), N = C.rw*C.rh, d = C.mImg.data, T = C.time;
    // frente con borde suave: a p=0 nada, a p=1 todo visible
    const k = p*(1+2*F) - F;
    for(let i=0;i<N;i++){
      const ti = T[i];
      if(ti < 0){ d[(i<<2)+3] = 0; continue; }
      const v = (k - ti) / F;
      d[(i<<2)+3] = v >= 1 ? 255 : v <= 0 ? 0 : (v*255) | 0;
    }
    C.mctx.putImageData(C.mImg, 0, 0);
    C.wctx.globalCompositeOperation = 'source-over'; C.wctx.clearRect(0,0,C.rw,C.rh); C.wctx.drawImage(C.src, 0, 0);
    C.wctx.globalCompositeOperation = 'destination-in'; C.wctx.drawImage(C.mcv, 0, 0);
    C.wctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(C.work, C.rx, C.ry);
  }
}

// ---------- Vista previa ----------
function resizePreview(){
  const [W,H] = RATIOS[ratio];
  prev.width = W/2; prev.height = H/2;
  $('art').style.setProperty('--ar', W/H);   // CSS fits the frame inside the panel
}
function frame(now){
  const dt = last ? now-last : 0; last = now;
  if(playing) playMs += dt;
  const D = BASE/(+$('sp').value), cyc = D + HOLD;
  renderFrame(pctx, prev.width, prev.height, clamp(((playMs/1000) % cyc) / D));
  requestAnimationFrame(frame);
}

// ---------- Entradas ----------
function rebuildText(){
  $('clearSvg').style.display = 'none'; $('keepRow').style.display = 'none'; $('svgNote').textContent = '';
  const {text, n} = limitText($('text').value);
  if(text !== $('text').value) $('text').value = text;
  $('count').textContent = `${n}/${MAXL} letters`;
  setLetters(buildTextLetters(text), 'text');
}
function scheduleText(){ clearTimeout(timer); timer = setTimeout(rebuildText, 250); }
$('text').addEventListener('input', scheduleText);
$('font').addEventListener('change', async () => {
  try { await document.fonts.load(`bold 120px ${$('font').value}`); } catch(e) {}
  if(srcKind === 'text') rebuildText();
});
$('suav').addEventListener('input', e => $('suv').textContent = (+e.target.value).toFixed(2));
$('st').addEventListener('input', e => $('stv').textContent = (+e.target.value).toFixed(2));
$('sp').addEventListener('input', e => $('spv').textContent = (+e.target.value).toFixed(2));
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
$('reshuffle').onclick = () => randomize();
$('svgFile').onchange = async e => {
  const file = e.target.files[0]; if(!file) return;
  try{
    const res = parseSvgLetters(await file.text());
    if(!res.letters.length) throw new Error('No vector shapes found in the SVG.');
    setLetters(res.letters, 'svg');
    $('clearSvg').style.display = ''; $('keepRow').style.display = ''; $('count').textContent = '';
    const n = res.letters.length;
    $('svgNote').textContent = [
      `${n} letter${n===1?'':'s'} detected.`,
      n === 1 ? 'Could not separate them: they animate as a single block.' : '',
      res.warning
    ].filter(Boolean).join(' ');
  } catch(err){ $('svgNote').textContent = err.message; }
};
$('clearSvg').onclick = () => { $('svgFile').value = ''; rebuildText(); };

// ---------- Editor de curva ----------
const cv = $('curve'), cc = cv.getContext('2d'), PAD = 14, S = cv.width - 2*PAD;
const toC = (x,y) => [PAD + x*S, PAD + (1-y)*S];
function drawCurve(){
  cc.clearRect(0,0,cv.width,cv.height);
  cc.strokeStyle = '#ddd'; cc.lineWidth = 1; cc.strokeRect(PAD, PAD, S, S);
  const P0 = toC(0,0), P1 = toC(CURVE.x1,CURVE.y1), P2 = toC(CURVE.x2,CURVE.y2), P3 = toC(1,1);
  cc.strokeStyle = '#aaa'; cc.beginPath(); cc.moveTo(...P0); cc.lineTo(...P1); cc.moveTo(...P3); cc.lineTo(...P2); cc.stroke();
  cc.strokeStyle = '#111'; cc.lineWidth = 2.5; cc.beginPath(); cc.moveTo(...P0); cc.bezierCurveTo(...P1, ...P2, ...P3); cc.stroke();
  cc.fillStyle = '#111'; for(const P of [P1,P2]){ cc.beginPath(); cc.arc(P[0], P[1], 6, 0, Math.PI*2); cc.fill(); }
}
let drag = 0;
const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX-r.left)*cv.width/r.width, (e.clientY-r.top)*cv.height/r.height]; };
function moveHandle(e){
  if(!drag) return;
  const [px,py] = pos(e);
  const x = clamp((px-PAD)/S), y = clamp(1-(py-PAD)/S);
  if(drag === 1){ CURVE.x1 = x; CURVE.y1 = y; } else { CURVE.x2 = x; CURVE.y2 = y; }
  drawCurve();
}
cv.addEventListener('pointerdown', e => {
  const [px,py] = pos(e), A = toC(CURVE.x1,CURVE.y1), B = toC(CURVE.x2,CURVE.y2);
  const dA = Math.hypot(A[0]-px, A[1]-py), dB = Math.hypot(B[0]-px, B[1]-py);
  drag = Math.min(dA,dB) > 30 ? 0 : (dA < dB ? 1 : 2);
  if(drag){ cv.setPointerCapture(e.pointerId); moveHandle(e); }
});
cv.addEventListener('pointermove', moveHandle);
cv.addEventListener('pointerup', () => drag = 0);
cv.addEventListener('pointercancel', () => drag = 0);
document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
  const v = b.dataset.c.split(',').map(Number);
  CURVE = {x1:v[0], y1:v[1], x2:v[2], y2:v[3]}; drawCurve();
});
drawCurve();

// ---------- Formatos y exportación ----------
const rb = $('ratios');
for(const r of Object.keys(RATIOS)){
  const b = document.createElement('button'); b.textContent = r; b.dataset.r = r;
  if(r === ratio) b.classList.add('on');
  b.onclick = () => {
    ratio = r;
    document.querySelectorAll('#ratios button').forEach(x => x.classList.toggle('on', x.dataset.r === r));
    resizePreview();
  };
  rb.appendChild(b);
}
$('dl').onclick = async () => {
  if(recording || !letters.length) return;
  const [W,H] = RATIOS[ratio], ec = document.createElement('canvas');
  ec.width = W; ec.height = H; const ectx = ec.getContext('2d');
  layerFor(W,H);
  const D = BASE/(+$('sp').value), total = D + HOLD, FPS = +$('fps').value || 60, status = t => $('status').textContent = t;
  recording = true; $('dl').disabled = true;
  try{
    const out = await VideoExport.run({canvas: ec, renderAt: t => renderFrame(ectx, W, H, clamp(t/D)), period: total, fps: FPS, width: W, height: H, status});
    const name = `text-reveal-${ratio.replace(':','x')}.${out.ext}`;
    const r = await VideoExport.save(name, out.blob);
    const msgs = {saved: 'Done', declined: 'Download cancelled', unavailable: 'Downloads are not available in this view', too_large: 'The file is too large'};
    status(`${msgs[r] || 'Could not save'}: ${name} · ${W}×${H} · ${total.toFixed(1)} s loop · ${out.note}`);
  }catch(err){ status(err && err.message || 'Export failed'); }
  finally { recording = false; $('dl').disabled = false; }
};

// ---------- Start ----------
rebuildText();
resizePreview();
requestAnimationFrame(frame);
