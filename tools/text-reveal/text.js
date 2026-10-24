/* CT3 — Text/SVG Reveal. Outline draw -> fill.
   Every letter is turned into vector contours (opentype.js for text, own path parser for SVG),
   each contour is stroked progressively ("trim path"), then the letter is filled. */
const FS = 120, MAXL = 20, EXIT = 0.5, FILL_AT = 0.6;
const RATIOS = {"1:1":[1080,1080],"4:5":[1080,1350],"3:4":[1080,1440],"9:16":[1080,1920],"16:9":[1920,1080]};
const $ = id => document.getElementById(id);
const prev = $('preview'), pctx = prev.getContext('2d');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
let ratio = '3:4', letters = [], bounds = [0,0,1,1], srcKind = 'text', playing = true, playMs = 0, last = 0, timer = 0, recording = false;
let CURVE = {x1:0.45, y1:0.05, x2:0.15, y2:1};
let seed = 1, buildTok = 0;

// ---------- Easing ----------
function bezAt(t, a, b){ const u = 1-t; return 3*u*u*t*a + 3*u*t*t*b + t*t*t; }
function ease(x){
  if(x <= 0) return 0; if(x >= 1) return 1;
  const {x1,y1,x2,y2} = CURVE; let lo = 0, hi = 1;
  for(let i = 0; i < 24; i++){ const m = (lo+hi)/2; if(bezAt(m,x1,x2) < x) lo = m; else hi = m; }
  return bezAt((lo+hi)/2, y1, y2);
}
const smooth = x => { x = clamp(x); return x*x*(3-2*x); };

// ---------- Path commands -> polylines ----------
// commands are absolute: {t:'M'|'L'|'C'|'Q'|'Z', x,y,x1,y1,x2,y2}
function arcToCubics(x0, y0, rx, ry, phi, fa, fs, x, y){
  if(rx === 0 || ry === 0) return [{t:'L', x, y}];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x0-x)/2, dy = (y0-y)/2;
  const x1p = cp*dx + sp*dy, y1p = -sp*dx + cp*dy;
  const lam = x1p*x1p/(rx*rx) + y1p*y1p/(ry*ry);
  if(lam > 1){ const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p, den = rx*rx*y1p*y1p + ry*ry*x1p*x1p;
  let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num/den)); if(fa === fs) co = -co;
  const cxp = co*rx*y1p/ry, cyp = -co*ry*x1p/rx;
  const cx = cp*cxp - sp*cyp + (x0+x)/2, cy = sp*cxp + cp*cyp + (y0+y)/2;
  const ang = (ux,uy,vx,vy) => { const a = Math.atan2(ux*vy-uy*vx, ux*vx+uy*vy); return a; };
  let th1 = ang(1,0,(x1p-cxp)/rx,(y1p-cyp)/ry), dth = ang((x1p-cxp)/rx,(y1p-cyp)/ry,(-x1p-cxp)/rx,(-y1p-cyp)/ry);
  if(!fs && dth > 0) dth -= 2*Math.PI; else if(fs && dth < 0) dth += 2*Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth)/(Math.PI/2))), d = dth/n, k = 4/3*Math.tan(d/4), out = [];
  for(let i = 0; i < n; i++){
    const a1 = th1 + i*d, a2 = a1 + d, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const P = (ex,ey) => [cp*rx*ex - sp*ry*ey + cx, sp*rx*ex + cp*ry*ey + cy];
    const p1 = P(c1 - k*s1, s1 + k*c1), p2 = P(c2 + k*s2, s2 - k*c2), p3 = P(c2, s2);
    out.push({t:'C', x1:p1[0], y1:p1[1], x2:p2[0], y2:p2[1], x:p3[0], y:p3[1]});
  }
  return out;
}
function parseD(d){
  const out = []; let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, lc = null, lq = null;
  const ws = () => { while(i < d.length && /[\s,]/.test(d[i])) i++; };
  const num = () => { ws(); const m = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/.exec(d.slice(i)); if(!m) return NaN; i += m[0].length; return parseFloat(m[0]); };
  const flag = () => { ws(); const c = d[i++]; return c === '1' ? 1 : 0; };
  while(true){
    ws(); if(i >= d.length) break;
    if(/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    else if(!cmd || cmd === 'Z' || cmd === 'z') break;
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
    if(C === 'Z'){ out.push({t:'Z'}); cx = sx; cy = sy; lc = lq = null; continue; }
    if(C === 'M'){ const x = num()+ox, y = num()+oy; if(isNaN(x)||isNaN(y)) break; out.push({t:'M',x,y}); cx = sx = x; cy = sy = y; cmd = rel ? 'l' : 'L'; lc = lq = null; }
    else if(C === 'L'){ const x = num()+ox, y = num()+oy; if(isNaN(x)||isNaN(y)) break; out.push({t:'L',x,y}); cx = x; cy = y; lc = lq = null; }
    else if(C === 'H'){ const x = num()+ox; if(isNaN(x)) break; out.push({t:'L',x,y:cy}); cx = x; lc = lq = null; }
    else if(C === 'V'){ const y = num()+oy; if(isNaN(y)) break; out.push({t:'L',x:cx,y}); cy = y; lc = lq = null; }
    else if(C === 'C'){ const x1=num()+ox,y1=num()+oy,x2=num()+ox,y2=num()+oy,x=num()+ox,y=num()+oy; if(isNaN(y)) break; out.push({t:'C',x1,y1,x2,y2,x,y}); lc = [x2,y2]; lq = null; cx = x; cy = y; }
    else if(C === 'S'){ const x2=num()+ox,y2=num()+oy,x=num()+ox,y=num()+oy; if(isNaN(y)) break; const x1 = lc ? 2*cx-lc[0] : cx, y1 = lc ? 2*cy-lc[1] : cy; out.push({t:'C',x1,y1,x2,y2,x,y}); lc = [x2,y2]; lq = null; cx = x; cy = y; }
    else if(C === 'Q'){ const x1=num()+ox,y1=num()+oy,x=num()+ox,y=num()+oy; if(isNaN(y)) break; out.push({t:'Q',x1,y1,x,y}); lq = [x1,y1]; lc = null; cx = x; cy = y; }
    else if(C === 'T'){ const x=num()+ox,y=num()+oy; if(isNaN(y)) break; const x1 = lq ? 2*cx-lq[0] : cx, y1 = lq ? 2*cy-lq[1] : cy; out.push({t:'Q',x1,y1,x,y}); lq = [x1,y1]; lc = null; cx = x; cy = y; }
    else if(C === 'A'){ const rx=num(),ry=num(),rot=num(),fa=flag(),fs=flag(),x=num()+ox,y=num()+oy; if(isNaN(y)) break; out.push(...arcToCubics(cx,cy,rx,ry,rot*Math.PI/180,fa,fs,x,y)); cx = x; cy = y; lc = lq = null; }
    else break;
  }
  return out;
}
function primitiveCmds(el){
  const g = a => parseFloat(el.getAttribute(a)) || 0, tag = el.tagName.toLowerCase();
  if(tag === 'path') return parseD(el.getAttribute('d') || '');
  if(tag === 'rect'){
    const x = g('x'), y = g('y'), w = g('width'), h = g('height'); if(!(w > 0 && h > 0)) return [];
    let rx = g('rx'), ry = g('ry'); if(!rx) rx = ry; if(!ry) ry = rx; rx = Math.min(rx, w/2); ry = Math.min(ry, h/2);
    if(!rx) return [{t:'M',x,y},{t:'L',x:x+w,y},{t:'L',x:x+w,y:y+h},{t:'L',x,y:y+h},{t:'Z'}];
    return parseD(`M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`);
  }
  if(tag === 'circle' || tag === 'ellipse'){
    const cx = g('cx'), cy = g('cy'), rx = tag === 'circle' ? g('r') : g('rx'), ry = tag === 'circle' ? g('r') : g('ry');
    if(!(rx > 0 && ry > 0)) return [];
    return parseD(`M${cx+rx} ${cy}A${rx} ${ry} 0 1 1 ${cx-rx} ${cy}A${rx} ${ry} 0 1 1 ${cx+rx} ${cy}Z`);
  }
  if(tag === 'line') return [{t:'M',x:g('x1'),y:g('y1')},{t:'L',x:g('x2'),y:g('y2')}];
  const n = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number), o = [];
  for(let i = 0; i + 1 < n.length; i += 2) o.push({t: i ? 'L' : 'M', x:n[i], y:n[i+1]});
  if(tag === 'polygon') o.push({t:'Z'});
  return o;
}
const mapCmds = (cmds, f) => cmds.map(c => {
  if(c.t === 'Z') return c;
  const o = {t:c.t}, p = f(c.x, c.y); o.x = p[0]; o.y = p[1];
  if(c.t === 'C' || c.t === 'Q'){ const a = f(c.x1, c.y1); o.x1 = a[0]; o.y1 = a[1]; }
  if(c.t === 'C'){ const b = f(c.x2, c.y2); o.x2 = b[0]; o.y2 = b[1]; }
  return o;
});
// Flatten to contours [{pts:[x0,y0,x1,y1,...], closed}]. `step` = target segment length in layout units.
function flatten(cmds, step){
  const res = []; let cur = null, sx = 0, sy = 0, px = 0, py = 0;
  const push = (x, y) => { const n = cur.pts.length; if(n >= 2 && Math.abs(cur.pts[n-2]-x) < 1e-6 && Math.abs(cur.pts[n-1]-y) < 1e-6) return; cur.pts.push(x, y); px = x; py = y; };
  const fin = () => { if(cur && cur.pts.length >= 4) res.push(cur); cur = null; };
  for(const c of cmds){
    if(c.t === 'M'){ fin(); cur = {pts:[c.x, c.y], closed:false}; sx = px = c.x; sy = py = c.y; }
    else if(c.t === 'Z'){ if(cur){ push(sx, sy); cur.closed = true; fin(); px = sx; py = sy; } }
    else {
      if(!cur){ cur = {pts:[px, py], closed:false}; sx = px; sy = py; }
      if(c.t === 'L') push(c.x, c.y);
      else if(c.t === 'Q'){
        const l = Math.hypot(c.x1-px,c.y1-py) + Math.hypot(c.x-c.x1,c.y-c.y1), n = clamp(Math.ceil(l/step), 4, 60), x0 = px, y0 = py;
        for(let i = 1; i <= n; i++){ const t = i/n, u = 1-t; push(u*u*x0 + 2*u*t*c.x1 + t*t*c.x, u*u*y0 + 2*u*t*c.y1 + t*t*c.y); }
      } else if(c.t === 'C'){
        const l = Math.hypot(c.x1-px,c.y1-py) + Math.hypot(c.x2-c.x1,c.y2-c.y1) + Math.hypot(c.x-c.x2,c.y-c.y2), n = clamp(Math.ceil(l/step), 4, 80), x0 = px, y0 = py;
        for(let i = 1; i <= n; i++){ const t = i/n, u = 1-t;
          push(u*u*u*x0 + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x, u*u*u*y0 + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y); }
      }
    }
  }
  fin(); return res;
}
function shapeFrom(contours, extra){
  const fp = new Path2D();
  for(const c of contours){ fp.moveTo(c.pts[0], c.pts[1]); for(let i = 2; i < c.pts.length; i += 2) fp.lineTo(c.pts[i], c.pts[i+1]); fp.closePath(); }
  return Object.assign({raw:contours, fillPath:fp}, extra);
}
function bbOf(shapes){
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for(const s of shapes) for(const c of s.raw) for(let i = 0; i < c.pts.length; i += 2){
    x0 = Math.min(x0,c.pts[i]); x1 = Math.max(x1,c.pts[i]); y0 = Math.min(y0,c.pts[i+1]); y1 = Math.max(y1,c.pts[i+1]);
  }
  return [x0,y0,x1,y1];
}

// ---------- Fonts ----------
const fontCache = {}; let customFont = null, customName = '';
async function getFont(key){
  if(key === 'custom' && customFont) return customFont;
  if(!fontCache[key]) fontCache[key] = fetch('fonts/' + key).then(r => { if(!r.ok) throw new Error('Font not found'); return r.arrayBuffer(); }).then(b => opentype.parse(b));
  return fontCache[key];
}
function limitText(s){
  let n = 0, out = '';
  for(const ch of s){ if(ch.trim()){ if(n >= MAXL) continue; n++; } out += ch; }
  return {text: out, n};
}
function textLetters(font, text){
  const out = [], lines = text.split('\n'); let missing = 0;
  const widths = lines.map(l => font.getAdvanceWidth(l, FS, {kerning:true}));
  const wmax = Math.max(...widths, 1);
  lines.forEach((line, li) => {
    const x0 = (wmax - widths[li])/2, base = li*FS*1.25 + FS;
    font.forEachGlyph(line, x0, base, FS, {kerning:true}, (glyph, gx, gy, gs) => {
      const cmds = glyph.getPath(gx, gy, gs).commands.map(c => {
        const o = {t:c.type}; for(const k of ['x','y','x1','y1','x2','y2']) if(c[k] !== undefined) o[k] = c[k]; return o; });
      if(!cmds.length){ if(glyph.unicode !== 32 && glyph.index === 0) missing++; return; }
      if(glyph.index === 0){ missing++; return; }
      const cs = flatten(cmds, 1.2); if(!cs.length) return;
      const sh = shapeFrom(cs, {fill:'text', stroke:'text', rule:'nonzero'});
      out.push({shapes:[sh], bb:bbOf([sh])});
    });
  });
  return {letters: out, missing};
}

// ---------- SVG -> letters ----------
const isVis = c => !!c && c !== 'none' && c !== 'transparent' && !/^rgba\(.*,\s*0(\.0+)?\)$/.test(c);
function cmdsPath(cmds){
  const p = new Path2D();
  for(const c of cmds){
    if(c.t === 'M') p.moveTo(c.x, c.y); else if(c.t === 'L') p.lineTo(c.x, c.y);
    else if(c.t === 'C') p.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else if(c.t === 'Q') p.quadraticCurveTo(c.x1, c.y1, c.x, c.y); else p.closePath();
  }
  return p;
}
function groupOf(shapes){
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for(const s of shapes){ x0=Math.min(x0,s.box[0]); y0=Math.min(y0,s.box[1]); x1=Math.max(x1,s.box[2]); y1=Math.max(y1,s.box[3]); }
  return {shapes, bb:[x0,y0,x1,y1]};
}
function alphaMask(r, T, w, h, grow){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', {willReadFrequently:true});
  x.setTransform(T.multiply(r.M)); x.fillStyle = '#000'; x.fill(r.path, r.rule);
  if(grow){ x.strokeStyle = '#000'; x.lineWidth = grow; x.lineJoin = 'round'; x.stroke(r.path); }
  return x.getImageData(0,0,w,h).data;
}
// Two strokes are joined only if their pixels touch (overlapping boxes are not enough for italic or kerned type)
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
      const M = inv.multiply(ctm), local = primitiveCmds(el);
      if(!local.length) return;
      const cmds = mapCmds(local, (x,y) => { const q = new DOMPoint(x,y).matrixTransform(M); return [q.x, q.y]; });
      const cs2 = flatten(cmds, 4); if(!cs2.length) return;
      let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
      for(const c of cs2) for(let i = 0; i < c.pts.length; i += 2){ x0=Math.min(x0,c.pts[i]); x1=Math.max(x1,c.pts[i]); y0=Math.min(y0,c.pts[i+1]); y1=Math.max(y1,c.pts[i+1]); }
      recs.push({M:new DOMMatrix(), path:cmdsPath(cmds), cmds, box:[x0,y0,x1,y1],
        fill: hasFill ? cs.fill : null, stroke: hasStroke ? cs.stroke : null,
        rule: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'});
    });
  } finally { host.remove(); }
  if(!recs.length) return {letters:[], warning};

  // drop a background: a shape covering the whole logo
  if(recs.length > 3){
    const gx0 = Math.min(...recs.map(r=>r.box[0])), gy0 = Math.min(...recs.map(r=>r.box[1]));
    const gx1 = Math.max(...recs.map(r=>r.box[2])), gy1 = Math.max(...recs.map(r=>r.box[3]));
    const W0 = gx1-gx0, H0 = gy1-gy0;
    recs = recs.filter(r => !((r.box[2]-r.box[0]) >= 0.96*W0 && (r.box[3]-r.box[1]) >= 0.96*H0));
  }
  // group shapes that touch (one letter = connected pieces)
  const n = recs.length, par = Array.from({length:n}, (_,i) => i);
  const find = i => { while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  const hit = (a,b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++)
    if(hit(recs[i].box, recs[j].box) && touches(recs[i], recs[j])) par[find(i)] = find(j);
  const gm = new Map();
  recs.forEach((r,i) => { const k = find(i); if(!gm.has(k)) gm.set(k, []); gm.get(k).push(r); });
  let groups = [...gm.values()].map(groupOf);
  // dots and accents (small pieces above a letter) join their letter
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
  // normalise the logo to ~500 layout units and re-flatten with the right smoothness
  const ux0 = Math.min(...groups.map(g=>g.bb[0])), uy0 = Math.min(...groups.map(g=>g.bb[1]));
  const ux1 = Math.max(...groups.map(g=>g.bb[2])), uy1 = Math.max(...groups.map(g=>g.bb[3]));
  const k = 500 / Math.max(ux1-ux0, uy1-uy0, 1e-6);
  const out = groups.map(g => {
    const shapes = g.shapes.map(r => {
      const cs = flatten(mapCmds(r.cmds, (x,y) => [(x-ux0)*k, (y-uy0)*k]), 1.5);
      return shapeFrom(cs, {fill:r.fill, stroke:r.stroke, rule:r.rule});
    }).filter(s => s.raw.length);
    return {shapes, bb:bbOf(shapes)};
  }).filter(l => l.shapes.length);
  return {letters: out, warning};
}

// ---------- Letters, order, geometry ----------
function ranks(n){
  const order = $('order').value;
  let r = Array.from({length:n}, (_,i) => i);
  if(order === 'rtl') r = r.map(i => n-1-i);
  else if(order === 'center'){ const c = (n-1)/2; const d = r.map(i => Math.abs(i-c)); const mx = Math.max(...d, 1e-9); r = d.map(v => v/mx*(n-1)); }
  else if(order === 'rand'){
    let s = seed*9301 + 49297; const rnd = () => (s = (s*16807) % 2147483647) / 2147483647;
    const idx = r.slice(); for(let i = n-1; i > 0; i--){ const j = Math.floor(rnd()*(i+1)); [idx[i],idx[j]] = [idx[j],idx[i]]; }
    r = idx;
  }
  return r.map(v => n > 1 ? v/(n-1) : 0);
}
function area(p){ let a = 0; for(let i = 0, n = p.length; i < n-2; i += 2) a += p[i]*p[i+3] - p[i+2]*p[i+1]; return a/2; }
function prepare(){
  const cw = $('dir').value === 'cw';
  letters.forEach(L => {
    L.strokes = [];
    for(const sh of L.shapes) for(const c of sh.raw){
      let p = c.pts.slice();
      if(c.closed){
        if(((area(p) > 0) !== cw)){ const q = []; for(let i = p.length-2; i >= 0; i -= 2) q.push(p[i], p[i+1]); p = q; }
        // start at the topmost point (then leftmost)
        const m = p.length/2 - 1; let b = 0;
        for(let i = 1; i < m; i++) if(p[2*i+1] < p[2*b+1] - 1e-6 || (Math.abs(p[2*i+1]-p[2*b+1]) < 1e-6 && p[2*i] < p[2*b])) b = i;
        if(b){ const q = []; for(let i = 0; i < m; i++){ const j = (i+b) % m; q.push(p[2*j], p[2*j+1]); } q.push(q[0], q[1]); p = q; }
      }
      const cum = new Float32Array(p.length/2); for(let i = 1; i < cum.length; i++) cum[i] = cum[i-1] + Math.hypot(p[2*i]-p[2*i-2], p[2*i+1]-p[2*i-1]);
      L.strokes.push({pts:p, cum, len:cum[cum.length-1], closed:c.closed, sh});
    }
    for(const sh of L.shapes) sh.strokes = L.strokes.filter(x => x.sh === sh);
  });
  const rk = ranks(letters.length); letters.forEach((L,i) => L.rank = rk[i]);
}
function setLetters(list, kind){
  letters = list; srcKind = kind;
  bounds = bbOf(letters.flatMap(L => L.shapes).length ? letters.flatMap(L => L.shapes) : []);
  if(!isFinite(bounds[0])) bounds = [0,0,1,1];
  prepare();
}

// ---------- Timing ----------
function timing(){
  const Dr = +$('dr').value, Sg = +$('sg').value, Fd = +$('fd').value, Hold = +$('hold').value;
  const fillOn = $('fillm').value !== 'none', fadeOut = $('outm').value === 'fade' && fillOn;
  const fa = $('fillat').value === 'after' ? 1 : FILL_AT, fillStart = fa*Dr;
  const fillEnd = fillOn ? fillStart + Fd : 0, end = Math.max(Dr, fillEnd + (fadeOut ? 0.4 : 0));
  return {Dr, Sg, Fd, Hold, fillStart, fillOn, fadeOut, fillEnd, end, total: Sg + end + Hold + EXIT};
}

// ---------- Render ----------
function strokePartial(ctx, s, f){
  const p = s.pts, cum = s.cum, target = s.len*f; let lo = 0, hi = cum.length-1;
  while(hi - lo > 1){ const m = (lo+hi) >> 1; if(cum[m] <= target) lo = m; else hi = m; }
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  for(let i = 1; i <= lo; i++) ctx.lineTo(p[2*i], p[2*i+1]);
  if(f >= 1){ if(s.closed) ctx.closePath(); }
  else { const seg = cum[hi]-cum[lo] || 1, u = (target-cum[lo])/seg; ctx.lineTo(p[2*lo]+(p[2*hi]-p[2*lo])*u, p[2*lo+1]+(p[2*hi+1]-p[2*lo+1])*u); }
  ctx.stroke();
}
function renderFrame(ctx, W, H, t){
  const T = timing(), keep = $('keep').checked, lc = $('lc').value, fc = $('fc').value, lw = +$('lw').value, align = $('align').value;
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1;
  ctx.fillStyle = $('bg').value; ctx.fillRect(0,0,W,H);
  if(!letters.length) return;
  const bw = Math.max(bounds[2]-bounds[0], 1), bh = Math.max(bounds[3]-bounds[1], 1);
  const pad = lw*2, s = Math.min(W*0.8/(bw+pad), H*0.8/(bh+pad));
  const ox = W/2 - (bounds[0]+bounds[2])/2*s, oy = H/2 - (bounds[1]+bounds[3])/2*s;
  const exit = t > T.total - EXIT ? clamp(1 - (t - (T.total - EXIT))/EXIT) : 1;
  ctx.setTransform(s,0,0,s,ox,oy); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw;
  const mode = $('fillm').value;
  for(const L of letters){
    const lt = t - L.rank*T.Sg; if(lt <= 0) continue;
    const pDraw = ease(lt / T.Dr);
    let fillA = 0, outA = 1;
    if(T.fillOn){ fillA = smooth((lt - T.fillStart)/T.Fd); if(T.fadeOut) outA = 1 - smooth((lt - T.fillEnd)/0.4); }
    // fill
    if(fillA > 0){
      ctx.globalAlpha = exit;
      for(const sh of L.shapes){
        if(!sh.fill) continue;
        ctx.fillStyle = keep && sh.fill !== 'text' ? sh.fill : fc;
        if(mode === 'wipe'){
          ctx.save();
          const y1 = L.bb[3] + lw, y0 = y1 - (L.bb[3]-L.bb[1]+2*lw)*fillA;
          ctx.beginPath(); ctx.rect(L.bb[0]-lw*2, y0, L.bb[2]-L.bb[0]+lw*4, y1-y0+lw*2); ctx.clip();
          ctx.fill(sh.fillPath, sh.rule); ctx.restore();
        } else { ctx.globalAlpha = exit*fillA; ctx.fill(sh.fillPath, sh.rule); }
      }
    }
    // outline (center / inside / outside the letter edge, like Figma)
    if(outA > 0 && pDraw > 0){
      for(const sh of L.shapes){
        const al = sh.fill ? align : 'center';
        ctx.globalAlpha = exit * (sh.fill ? outA : 1);   // stroke-only shapes keep their line
        ctx.strokeStyle = keep && sh.fill !== 'text' ? (sh.stroke || sh.fill || lc) : lc;
        ctx.lineWidth = al === 'center' ? lw : lw*2;
        if(al !== 'center'){
          ctx.save();
          if(al === 'inside') ctx.clip(sh.fillPath, sh.rule);
          else { const q = new Path2D(); q.rect(L.bb[0]-lw*4, L.bb[1]-lw*4, L.bb[2]-L.bb[0]+lw*8, L.bb[3]-L.bb[1]+lw*8); q.addPath(sh.fillPath); ctx.clip(q, 'evenodd'); }
        }
        for(const st of sh.strokes) strokePartial(ctx, st, pDraw);
        if(al !== 'center') ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1; ctx.setTransform(1,0,0,1,0,0);
}

// ---------- Preview ----------
function resizePreview(){
  const [W,H] = RATIOS[ratio];
  prev.width = W/2; prev.height = H/2;
  $('art').style.setProperty('--ar', W/H);
}
function frame(now){
  const dt = last ? now-last : 0; last = now;
  if(playing) playMs += dt;
  const T = timing();
  renderFrame(pctx, prev.width, prev.height, (playMs/1000) % T.total);
  requestAnimationFrame(frame);
}

// ---------- Inputs ----------
async function rebuildText(){
  const tok = ++buildTok;
  $('clearSvg').style.display = 'none'; $('keepRow').style.display = 'none'; $('svgNote').textContent = '';
  const {text, n} = limitText($('text').value);
  if(text !== $('text').value) $('text').value = text;
  $('count').textContent = `${n}/${MAXL} letters`;
  let key = $('font').value;
  if(key === 'custom' && !customFont){ key = $('font').options[0].value; $('font').value = key; }
  try{
    const font = await getFont(key);
    if(tok !== buildTok) return;
    const res = textLetters(font, text);
    setLetters(res.letters, 'text');
    $('svgNote').textContent = res.missing ? `${res.missing} character${res.missing===1?'':'s'} not available in this typeface and skipped.` : '';
  } catch(err){ if(tok === buildTok) $('svgNote').textContent = 'Could not load the typeface.'; }
}
function scheduleText(){ clearTimeout(timer); timer = setTimeout(rebuildText, 200); }
$('text').addEventListener('input', scheduleText);
$('font').addEventListener('change', () => { if(srcKind === 'text') rebuildText(); });
$('fontFile').onchange = async e => {
  const f = e.target.files[0]; if(!f) return;
  try{
    customFont = opentype.parse(await f.arrayBuffer()); customName = f.name.replace(/\.[^.]+$/, '');
    let o = [...$('font').options].find(x => x.value === 'custom');
    if(!o){ o = document.createElement('option'); o.value = 'custom'; $('font').appendChild(o); }
    o.textContent = 'Your font: ' + customName; $('font').value = 'custom';
    if(srcKind === 'svg') $('clearSvg').click(); else rebuildText();
  } catch(err){ $('svgNote').textContent = 'That font file could not be read.'; }
};
['order','dir'].forEach(id => $(id).addEventListener('change', prepare));
document.querySelectorAll('.menu input[type=range]').forEach(r => {
  const o = r.closest('.block').querySelector('output');
  const u = () => { if(o) o.textContent = (+r.value).toFixed(r.id === 'lw' ? 1 : 2) + (r.id === 'lw' ? '' : ' s'); };
  r.addEventListener('input', u); u();
});
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
$('reshuffle').onclick = () => { seed = (seed*7 + 13) % 9973; $('order').value = 'rand'; prepare(); playMs = 0; if(window.CTPersist) CTPersist.save(); };
$('svgFile').onchange = async e => {
  const file = e.target.files[0]; if(!file) return;
  try{
    const res = parseSvgLetters(await file.text());
    if(!res.letters.length) throw new Error('No vector shapes found in the SVG.');
    ++buildTok; setLetters(res.letters, 'svg');
    $('clearSvg').style.display = ''; $('keepRow').style.display = ''; $('count').textContent = '';
    const n = res.letters.length;
    $('svgNote').textContent = [
      `${n} letter${n===1?'':'s'} detected.`,
      n === 1 ? 'Could not separate them: they animate as a single block.' : '',
      res.warning
    ].filter(Boolean).join(' ');
    playMs = 0;
  } catch(err){ $('svgNote').textContent = err.message; }
};
$('clearSvg').onclick = () => { $('svgFile').value = ''; rebuildText(); };

// ---------- Curve editor ----------
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
  drawCurve(); if(window.CTPersist) CTPersist.save();
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

// ---------- Formats and export ----------
const rb = $('ratios');
function setRatio(r){
  if(!RATIOS[r]) return; ratio = r;
  document.querySelectorAll('#ratios button').forEach(x => x.classList.toggle('on', x.dataset.r === r));
  resizePreview();
}
for(const r of Object.keys(RATIOS)){
  const b = document.createElement('button'); b.textContent = r; b.dataset.r = r;
  if(r === ratio) b.classList.add('on');
  b.onclick = () => setRatio(r);
  rb.appendChild(b);
}
$('dl').onclick = async () => {
  if(recording || !letters.length) return;
  const [W,H] = RATIOS[ratio], ec = document.createElement('canvas');
  ec.width = W; ec.height = H; const ectx = ec.getContext('2d');
  const total = timing().total, FPS = +$('fps').value || 60, status = t => $('status').textContent = t;
  recording = true; $('dl').disabled = true;
  try{
    const out = await VideoExport.run({canvas: ec, renderAt: t => renderFrame(ectx, W, H, t), period: total, fps: FPS, width: W, height: H, status});
    const name = `text-reveal-${ratio.replace(':','x')}.${out.ext}`;
    const r = await VideoExport.save(name, out.blob);
    const msgs = {saved: 'Done', declined: 'Download cancelled', unavailable: 'Downloads are not available in this view', too_large: 'The file is too large'};
    status(`${msgs[r] || 'Could not save'}: ${name} · ${W}×${H} · ${total.toFixed(1)} s loop · ${out.note}`);
  }catch(err){ status(err && err.message || 'Export failed'); }
  finally { recording = false; $('dl').disabled = false; }
};

// ---------- Start ----------
resizePreview();
if(window.CTPersist) CTPersist.init('text-reveal', {
  get: () => ({curve:CURVE, ratio, seed}),
  set: x => { if(x.curve) CURVE = x.curve; if(x.ratio) setRatio(x.ratio); if(x.seed) seed = x.seed; drawCurve(); }
});
rebuildText();
requestAnimationFrame(frame);
