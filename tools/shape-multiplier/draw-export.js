/* Dibujado compartido + exportadores. Sin dependencias del DOM salvo Path2D/ctx en drawScene. */
(function (root) {
'use strict';

/* Estilo de relleno: {mode:'solid'|'gradient', color:'#rrggbb', stops:[{c,p}], angle:grados (0 = arriba→abajo)} */

// Dibuja un fotograma. Autocontenida (se incrusta tal cual en el HTML animado exportado).
function drawScene(ctx, G, poses, k) {
  k = k || 1;
  var W = G.W, H = G.H;
  function paint(g, w, h, cx, cy) {
    if (g.mode === 'solid') return g.color;
    var a = g.angle * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a), L = 0.5 * (Math.abs(dx) * w + Math.abs(dy) * h);
    var gr = ctx.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
    g.stops.forEach(function (s) { gr.addColorStop(Math.min(1, Math.max(0, s.p)), s.c); });
    return gr;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(k, k);
  if (G.bg) { ctx.fillStyle = paint(G.bg, W, H, W / 2, H / 2); ctx.fillRect(0, 0, W, H); }
  if (!G.img && !G._path) {
    var p = new Path2D();
    (G.shape.outers || [G.shape.outer]).concat([G.shape.inner]).forEach(function (poly) {
      if (!poly) return;
      poly.forEach(function (q, i) { if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); });
      p.closePath();
    });
    G._path = p;
  }
  // Uploaded image: drawing the full-size picture for every copy on every frame is slow (Safari above all),
  // so a smaller copy is kept at the next power-of-two size above what is on screen and only redone when that changes.
  var img = G.img, iw = 0, ih = 0;
  if (img) {
    iw = img.naturalWidth || img.width; ih = img.naturalHeight || img.height;
    var need = 0;
    for (var n = 0; n < poses.length; n++) if (poses[n].o > 0 && poses[n].s > need) need = poses[n].s;
    var f = Math.pow(2, Math.ceil(Math.log(Math.max(need / G.shape.u * k, 1e-3)) / Math.LN2));
    if (f < 1 && iw && ih && typeof document !== 'undefined') {
      var m = G._mip;
      if (!m || m.f !== f || m.src !== G.img) {
        var c = G.img, cw = iw, ch = ih, tw = Math.max(1, Math.ceil(iw * f)), th = Math.max(1, Math.ceil(ih * f));
        while (cw > tw || ch > th) {   // halve step by step: smooth result, no shimmer
          var nw = Math.max(tw, Math.ceil(cw / 2)), nh = Math.max(th, Math.ceil(ch / 2)), cv2 = document.createElement('canvas');
          cv2.width = nw; cv2.height = nh; var x2 = cv2.getContext('2d'); x2.imageSmoothingQuality = 'high'; x2.drawImage(c, 0, 0, nw, nh);
          c = cv2; cw = nw; ch = nh;
        }
        m = G._mip = { f: f, src: G.img, c: c };
      }
      img = m.c;
    }
  }
  for (var i = 0; i < poses.length; i++) {
    var q = poses[i];
    if (!(q.o > 0)) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, q.o);
    ctx.translate(q.x, q.y); ctx.rotate(q.a);
    if (img) { var sc = q.s / G.shape.u; ctx.scale(sc, sc); ctx.drawImage(img, -G.shape.cx, -G.shape.cy, iw, ih); }
    else { ctx.scale(q.s, q.s); ctx.fillStyle = paint(G.fill, G.shape.bw, G.shape.bh, 0, 0); ctx.fill(G._path, 'evenodd'); }
    ctx.restore();
  }
  ctx.restore();
}

function rgb01(hex) {
  var h = String(hex).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function gradPts(g, w, h, cx, cy) {
  var a = g.angle * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a), L = 0.5 * (Math.abs(dx) * w + Math.abs(dy) * h);
  return [cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L];
}
const r1 = n => Math.round(n * 10) / 10, r3 = n => Math.round(n * 1000) / 1000, r2 = n => Math.round(n * 100) / 100;

/* ---------- SVG de la forma ---------- */
function buildShapeSVG(G) {
  var sh = G.shape, bw = sh.bw * sh.u, bh = sh.bh * sh.u, x0 = sh.cx - bw / 2, y0 = sh.cy - bh / 2;
  var f = function (poly) { return poly.map(function (q, i) { return (i ? 'L' : 'M') + r1(q[0] * sh.u + sh.cx) + ' ' + r1(q[1] * sh.u + sh.cy); }).join(' ') + 'Z'; };
  var d = (sh.outers || [sh.outer]).map(f).join(' ') + (sh.inner ? ' ' + f(sh.inner) : '');
  var defs = '', fill;
  if (G.fill.mode === 'solid') fill = G.fill.color;
  else {
    var p = gradPts(G.fill, bw, bh, sh.cx, sh.cy);
    defs = '<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="' + r1(p[0]) + '" y1="' + r1(p[1]) + '" x2="' + r1(p[2]) + '" y2="' + r1(p[3]) + '">' +
      G.fill.stops.map(function (s) { return '<stop offset="' + r3(s.p) + '" stop-color="' + s.c + '"/>'; }).join('') + '</linearGradient></defs>';
    fill = 'url(#g)';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r1(x0) + ' ' + r1(y0) + ' ' + r1(bw) + ' ' + r1(bh) + '" width="' + Math.round(bw) + '" height="' + Math.round(bh) + '">' +
    defs + '<path fill="' + fill + '" fill-rule="evenodd" d="' + d + '"/></svg>\n';
}

/* ---------- Lottie (JSON editable en After Effects / LottieFiles / Figma) ---------- */
function buildLottie(bk, G, imgDataURL, opts) {
  opts = opts || {};
  var fps = 30, step = Math.max(1, Math.round(bk.fps / fps)), W = G.W, H = G.H, S0 = 1000;
  var frames = [];
  for (var i = 0; i < bk.frames.length; i += step) frames.push(bk.frames[i]);
  var F = frames.length, per = {};
  frames.forEach(function (fr, f) {
    fr.forEach(function (q) { (per[q.id] = per[q.id] || []).push({ f: f, q: q }); });
  });
  var sh = G.shape;
  var ids = Object.keys(per).map(Number).sort(function (a, b) { return a - b; });
  var ind = 0;
  var tr = function () { return { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }; };
  function fillItem(g, w, h, cx, cy) {
    if (g.mode === 'solid') { var c = rgb01(g.color); return { ty: 'fl', c: { a: 0, k: [r3(c[0]), r3(c[1]), r3(c[2]), 1] }, o: { a: 0, k: 100 }, r: 2, nm: 'Fill' }; }
    var p = gradPts(g, w, h, cx, cy), arr = [];
    g.stops.forEach(function (s) { var c = rgb01(s.c); arr.push(r3(s.p), r3(c[0]), r3(c[1]), r3(c[2])); });
    return { ty: 'gf', o: { a: 0, k: 100 }, r: 2, g: { p: g.stops.length, k: { a: 0, k: arr } }, s: { a: 0, k: [r1(p[0]), r1(p[1])] }, e: { a: 0, k: [r1(p[2]), r1(p[3])] }, t: 1, nm: 'Gradient' };
  }
  function pathItem(poly, scale, nm) {
    var v = poly.map(function (q) { return [r1(q[0] * scale), r1(q[1] * scale)]; });
    return { ty: 'sh', nm: nm, ks: { a: 0, k: { c: true, i: v.map(function () { return [0, 0]; }), o: v.map(function () { return [0, 0]; }), v: v } } };
  }
  // propiedad animada con fotogramas "hold" (solo cuando cambia el valor)
  function prop(samples, getter) {
    var keys = [], last = null;
    samples.forEach(function (s) {
      var val = getter(s.q), key = JSON.stringify(val);
      if (key !== last) { keys.push({ t: s.f, s: val, h: 1 }); last = key; }
    });
    if (keys.length === 1) return { a: 0, k: keys[0].s };
    return { a: 1, k: keys };
  }
  var layers = [], assets = [];
  var unwrapped = {};
  ids.forEach(function (id) {
    var smp = per[id];
    var base = 0;
    var ks = {
      o: prop(smp, function (q) { return [Math.round(q.o * 100)]; }),
      r: prop(smp, function (q) { return [r2(q.a * 180 / Math.PI)]; }),
      p: prop(smp, function (q) { return [r1(q.x), r1(q.y), 0]; }),
      a: { a: 0, k: [0, 0, 0] },
      s: null
    };
    var layer;
    if (imgDataURL) {
      ks.a = { a: 0, k: [r1(sh.cx), r1(sh.cy), 0] };
      ks.s = prop(smp, function (q) { var v = r2(q.s / sh.u * 100); return [v, v, 100]; });
      layer = { ddd: 0, ind: ++ind, ty: 2, nm: 'Shape ' + id, refId: 'img0', sr: 1, ks: ks, ao: 0, ip: smp[0].f, op: smp[smp.length - 1].f + 1, st: 0, bm: 0 };
    } else {
      ks.s = prop(smp, function (q) { var v = r2(q.s / S0 * 100); return [v, v, 100]; });
      var items = (sh.outers || [sh.outer]).map(function (o, i) { return pathItem(o, S0, 'Outline ' + (i + 1)); });
      if (sh.inner) items.push(pathItem(sh.inner, S0, 'Hole'));
      items.push(fillItem(G.fill, sh.bw * S0, sh.bh * S0, 0, 0));
      items.push(tr());
      layer = { ddd: 0, ind: ++ind, ty: 4, nm: 'Shape ' + id, sr: 1, ks: ks, ao: 0, shapes: [{ ty: 'gr', nm: 'Shape', it: items }], ip: smp[0].f, op: smp[smp.length - 1].f + 1, st: 0, bm: 0 };
    }
    layers.push(layer);
  });
  if (imgDataURL) assets.push({ id: 'img0', w: (G.img && G.img.width) || Math.round(sh.bw * sh.u) || 1, h: (G.img && G.img.height) || Math.round(sh.bh * sh.u) || 1, u: '', p: imgDataURL, e: 1 });   // the picture's own size
  if (G.bg) {
    var bgItems = [{ ty: 'rc', d: 1, s: { a: 0, k: [W, H] }, p: { a: 0, k: [W / 2, H / 2] }, r: { a: 0, k: 0 }, nm: 'Rect' }, fillItem(G.bg, W, H, W / 2, H / 2), tr()];
    layers.push({ ddd: 0, ind: ++ind, ty: 4, nm: 'Background', sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, ao: 0, shapes: [{ ty: 'gr', nm: 'Background', it: bgItems }], ip: 0, op: F, st: 0, bm: 0 });
  }
  return { v: '5.7.4', fr: fps, ip: 0, op: F, w: W, h: H, nm: 'Shape multiplier', ddd: 0, assets: assets, layers: layers };
}

/* ---------- HTML animado autónomo (sin librerías, se reproduce en bucle) ---------- */
function buildPlayerHTML(bk, G, imgDataURL) {
  var step = Math.max(1, Math.round(bk.fps / 30)), fr = [];
  for (var i = 0; i < bk.frames.length; i += step) {
    var flat = [];
    bk.frames[i].forEach(function (q) { flat.push(q.id, r1(q.x), r1(q.y), r3(q.a), r1(q.s), r2(q.o)); });
    fr.push(flat);
  }
  var sh = G.shape;
  var data = { W: G.W, H: G.H, fps: bk.fps / step, bg: G.bg, fill: G.fill,
    shape: { outer: sh.outer.map(function (q) { return [r3(q[0]), r3(q[1])]; }), outers: (sh.outers || [sh.outer]).map(function (o) { return o.map(function (q) { return [r3(q[0]), r3(q[1])]; }); }), inner: sh.inner ? sh.inner.map(function (q) { return [r3(q[0]), r3(q[1])]; }) : null, bw: sh.bw, bh: sh.bh, cx: sh.cx, cy: sh.cy, u: sh.u },
    img: imgDataURL || null, frames: fr };
  var json = JSON.stringify(data).replace(/</g, '\\u003c');
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Shape multiplier animation</title>\n' +
    '<style>html,body{margin:0;height:100%;background:#1a1a1a}body{display:flex;align-items:center;justify-content:center}canvas{max-width:100vw;max-height:100vh;width:auto;height:auto}</style></head>\n<body><canvas id="c"></canvas>\n' +
    '<script type="application/json" id="d">' + json + '<\/script>\n<script>\n' + drawScene.toString() + '\n' +
    '(function(){var D=JSON.parse(document.getElementById("d").textContent),cv=document.getElementById("c");cv.width=D.W;cv.height=D.H;var ctx=cv.getContext("2d");\n' +
    'var G={W:D.W,H:D.H,bg:D.bg,fill:D.fill,shape:D.shape,img:null};if(D.img){var im=new Image();im.src=D.img;G.img=im}\n' +
    'var N=D.frames.length,maps=D.frames.map(function(f){var m={};for(var i=0;i<f.length;i+=6)m[f[i]]=i;return m});\n' +
    'function at(t){var fi=t*D.fps,i=((Math.floor(fi)%N)+N)%N,j=(i+1)%N,u=fi-Math.floor(fi),A=D.frames[i],B=D.frames[j],mb=maps[j],out=[];\n' +
    ' for(var k=0;k<A.length;k+=6){var q={id:A[k],x:A[k+1],y:A[k+2],a:A[k+3],s:A[k+4],o:A[k+5]},b=mb[q.id];\n' +
    '  if(b!==undefined){q.x+=(B[b+1]-q.x)*u;q.y+=(B[b+2]-q.y)*u;q.a+=(B[b+3]-q.a)*u;q.s+=(B[b+4]-q.s)*u;q.o+=(B[b+5]-q.o)*u}out.push(q)}return out}\n' +
    'var t0=performance.now(),L=N/D.fps;function loop(){var t=(((performance.now()-t0)/1000)%L+L)%L;drawScene(ctx,G,at(t),1);requestAnimationFrame(loop)}requestAnimationFrame(loop);\n' +
    '})();\n<\/script></body></html>\n';
}

root.StarExport = { drawScene: drawScene, buildLottie: buildLottie, buildPlayerHTML: buildPlayerHTML, buildShapeSVG: buildShapeSVG };
})(typeof window !== 'undefined' ? window : globalThis);
