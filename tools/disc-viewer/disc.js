const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const linearHex = h => new THREE.Color(h).convertSRGBToLinear();

// Medidas reales en mm (CD: 120 mm, 1,2 mm, agujero 15 mm · LP 12": 300 mm, ~1,5 mm, agujero 7,2 mm, etiqueta ~100 mm)
const CD = {R: 60,  T: 1.2, HOLE: 7.5,  HUB: 11.5, HUB_H: 0.6};
const LP = {R: 150, T: 1.5, HOLE: 3.62, LABEL: 50};
$('specs').textContent = 'Real sizes: CD 120 mm × 1.2 mm (hole 15 mm) · 12" LP 300 mm × ~1.5 mm (hole 7.2 mm, label ~100 mm).';

const RATIOS = {'1:1': [1080,1080], '3:4': [1080,1440], '4:5': [1080,1350], '9:16': [1080,1920], '16:9': [1920,1080]};
const PERIOD = {frontal: 4, girar: 3.5, 'volteo-y': 6, 'volteo-x': 6, balanceo: 5};
let RATIO_KEY = '3:4';

// ---------- Escena ----------
const viewer = $('viewer'), stage = $('stage'), canvas = $('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.LinearToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 14);
camera.position.set(0, 0, 5.4);

// Entorno sin rectángulos: los destellos son manchas redondas y suaves (no se ven como cuadrados)
function envCanvas(dark){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  if(dark){ g.addColorStop(0, '#2a2d35'); g.addColorStop(0.5, '#0c0d11'); g.addColorStop(1, '#050507'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.42, '#dfe4ec'); g.addColorStop(0.55, '#8d939e'); g.addColorStop(1, '#3b3f48'); }
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for(const u of [0.16, 0.38, 0.62, 0.84]){   // centros a >0.107 del borde: ningún destello queda cortado en la costura del mapa
    const cx = u*1024, cy = 150, rg = x.createRadialGradient(cx, cy, 0, cx, cy, 110);
    const a = dark ? 0.85 : 1;
    rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(0.5, `rgba(255,255,255,${a*0.6})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.fillRect(cx - 110, cy - 110, 220, 220);
  }
  return c;
}
const pmrem = new THREE.PMREMGenerator(renderer);
function envFrom(dark){
  const t = new THREE.CanvasTexture(envCanvas(dark)); t.mapping = THREE.EquirectangularReflectionMapping;
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return {tex: t, map: pmrem.fromEquirectangular(t).texture};
}
const envBright = envFrom(false), envDark = envFrom(true);

// Luces: ambiente, principal, contraluz y dos focales (superior e inferior), ambas con sombra
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(2, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.4); rim.position.set(-3, 1, -2); scene.add(rim);
function makeSpot(){
  const s = new THREE.SpotLight(0xffffff, 1.5, 0, Math.PI/5, 0.6, 1);
  scene.add(s); scene.add(s.target); s.target.position.set(0, 0, 0);
  return s;
}
const spots = [makeSpot(), makeSpot(), makeSpot()];

// ---------- Texturas ----------
function placeholderCover(back){
  // same grays as the plain-colors disc: #d9d9d9 body, #eaeaea label, gray SIDE A / SIDE B text
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  x.clearRect(0,0,1024,1024);
  x.fillStyle = '#cdcdcd'; x.beginPath(); x.arc(512,512,505,0,Math.PI*2); x.fill();
  x.fillStyle = '#dedede'; x.beginPath(); x.arc(512,512,0.35*512,0,Math.PI*2); x.fill();
  x.fillStyle = '#929292'; x.font = 'bold 76px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(back ? 'SIDE B' : 'SIDE A', 512, 650);   // below the hub (drawn a touch darker: the lights brighten it ~5%)
  return c;
}
function placeholderLabel(back){
  // drawn darker on purpose: the default lights brighten it by ~1.42x, so it reads as the plain-colors label gray (#eaeaea) with gray text
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#a4a4a4'; x.beginPath(); x.arc(256,256,250,0,Math.PI*2); x.fill();
  x.fillStyle = '#6c6c6c'; x.font = 'bold 64px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(back ? 'SIDE B' : 'SIDE A', 256, 372);   // below the spindle hole
  return c;
}
function grooveCanvas(){
  const c = document.createElement('canvas'); c.width = c.height = 2048; const x = c.getContext('2d');
  x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, 2048, 2048);
  for(let r = 340; r < 1024; r += 0.8){
    const v = Math.round(120 + Math.random()*20);
    x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = 0.5;
    x.beginPath(); x.arc(1024, 1024, r, 0, Math.PI*2); x.stroke();
  }
  return c;
}
// Detalle del vinilo en coordenadas polares (u = ángulo, v = radio), en DOS texturas:
//  - anillos finos (emisiva, suave, iguales en todo el ángulo)
//  - polvo y rayones (capa aparte con su propio deslizador): NO son iguales en todo el ángulo, y por eso se ve girar el disco
// No hay relieve ni mapa de rugosidad: esos dos generaban destellos blancos que dependían del tamaño de pantalla.
function dataTex(data, WT, HT){
  const t = new THREE.DataTexture(data, WT, HT, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.needsUpdate = true;
  return t;
}
function detailTextures(){
  const WT = 1024, HT = 2048, ring = new Uint8Array(WT*HT*4), dust = new Uint8Array(WT*HT*4);
  const inner = LP.HOLE, outer = LP.R, r0 = LP.LABEL, r1 = outer - 2, RINGS = 170, mmRow = (outer - inner)/HT;
  const hash = n => { const v = Math.sin(n*127.1 + 311.7)*43758.5453; return v - Math.floor(v); };
  const vnoise = x => { const k = Math.floor(x), f = x - k, w = f*f*(3 - 2*f); return hash(k)*(1 - w) + hash(k + 1)*w; };   // transición suave entre anillos
  let seed = 20261015; const rnd = () => (seed = (seed*1664525 + 1013904223) >>> 0)/4294967296;   // determinista: el disco siempre es el mismo
  for(let j = 0; j < HT; j++){
    const r = inner + (j + 0.5)*mmRow; let v = 0;
    if(r > r0 && r < r1){ const q = (r - r0)/(r1 - r0); v = 255*(0.06 + 0.18*(0.65*vnoise(q*RINGS) + 0.35*vnoise(q*RINGS/4 + 91.7))); }
    for(let i = 0; i < WT; i++){ const o = (j*WT + i)*4; ring[o] = ring[o+1] = ring[o+2] = v; ring[o+3] = 255; dust[o+3] = 255; }
  }
  const put = (i, j, val) => {
    if(j < 0 || j >= HT) return;
    i = ((i % WT) + WT) % WT; const o = (j*WT + i)*4, nv = Math.max(dust[o], val);
    dust[o] = dust[o+1] = dust[o+2] = nv;
  };
  for(let n = 0; n < 420; n++){                                      // polvo: motas redondas de 0.4-2 mm
    const r = r0 + 4 + rnd()*(r1 - r0 - 6), a = rnd()*WT, s = 0.2 + rnd()*rnd()*0.8;   // radio de la mota en mm
    const rx = Math.max(0.9, s/(2*Math.PI*r/WT)), ry = Math.max(0.9, s/mmRow), peak = 255*(0.45 + 0.55*rnd()), j0 = Math.round((r - inner)/mmRow);
    for(let dj = -Math.ceil(ry); dj <= Math.ceil(ry); dj++) for(let di = -Math.ceil(rx); di <= Math.ceil(rx); di++){
      const d = (di/rx)**2 + (dj/ry)**2; if(d <= 1) put(Math.round(a) + di, j0 + dj, peak*(1 - d*0.6));
    }
  }
  for(let n = 0; n < 12; n++){                                       // rayones: arcos finos y tenues
    const r = r0 + 6 + rnd()*(r1 - r0 - 12), a0 = rnd()*WT, L = (14 + rnd()*56)/(2*Math.PI*r/WT), drift = (rnd() - 0.5)*30;
    const j0 = Math.round((r - inner)/mmRow), val = 255*(0.2 + 0.25*rnd());
    for(let k = 0; k < L; k++){ const j = j0 + Math.round(drift*k/L); for(let t = 0; t < 4; t++) put(Math.round(a0) + k, j + t, val); }
  }
  return {ring: dataTex(ring, WT, HT), dust: dataTex(dust, WT, HT)};
}
const detailTexs = detailTextures(), detailTex = detailTexs.ring, dustTex = detailTexs.dust;
const coverFrontTex = new THREE.CanvasTexture(placeholderCover(false));
const coverBackTex  = new THREE.CanvasTexture(placeholderCover(true));
function labelTex(back){ const t = new THREE.CanvasTexture(placeholderLabel(back)); t.encoding = THREE.sRGBEncoding; return t; }
function loadTexture(file, done, srgb){
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); if(srgb) t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; done(t); }; img.src = r.result; };
  r.readAsDataURL(file);
}

// ---------- CD: plata con arcoíris difractivo ----------
const U = {
  uEnv: {value: envBright.tex}, uIri: {value: 0.9}, uTrans: {value: 0.3}, uExp: {value: 1},
  uLight: {value: new THREE.Vector3(2, 4, 5).normalize()}, uCam: {value: new THREE.Vector3()}
};
const FACE_VS = `
  varying vec2 vUv; varying vec2 vL; varying vec3 vN; varying vec3 vW;
  void main(){
    vUv = uv; vL = position.xy;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FACE_FS = `
  uniform sampler2D uMap; uniform sampler2D uEnv;
  uniform float uIri, uTrans, uExp; uniform vec3 uLight, uCam;
  varying vec2 vUv; varying vec2 vL; varying vec3 vN; varying vec3 vW;
  vec3 pal(float t){ return 0.5 + 0.5*cos(6.28318*(t + vec3(0.0, 0.33, 0.67))); }
  vec3 env(vec3 r){
    float u = atan(r.z, r.x)/6.28318 + 0.5;
    float v = asin(clamp(r.y, -1.0, 1.0))/3.14159 + 0.5;
    return texture2D(uEnv, vec2(u, v)).rgb;
  }
  void main(){
    vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
    vec3 V = normalize(uCam - vW);
    vec3 R = reflect(-V, n);
    float nv = clamp(dot(n, V), 0.0, 1.0);
    float rn = clamp(length(vL)/60.0, 0.0, 1.0);
    float ang = atan(vL.y, vL.x);
    float ph = ang*0.95 + nv*1.1 + R.x*0.9 + R.y*0.35 + rn*0.35;
    float streak = 0.6 + 0.4*pow(abs(cos(3.0*ang + 2.0*R.y)), 3.0);
    vec3 film = mix(pal(ph), vec3(1.0), 0.32);
    vec3 e = env(R);
    vec3 silver = vec3(0.72, 0.75, 0.80) * (0.5 + 0.45*e);
    vec3 foil = mix(silver, film*streak*(0.8 + 0.35*e), uIri*0.7);
    float spec = pow(max(dot(R, uLight), 0.0), 40.0);
    // the artwork is scaled to fit inside 96% of the radius: a thin outer ring always stays bare, so the rainbow shows
    vec4 t = texture2D(uMap, (vUv - 0.5)/0.96 + 0.5);
    t.a *= 1.0 - smoothstep(0.956, 0.964, rn);
    vec3 cover = t.rgb*(0.9 + 0.2*e) + spec*0.3;
    float fres = pow(1.0 - nv, 2.0);
    vec3 col = mix(foil + spec*0.6, cover, t.a);
    float alpha = mix(1.0 - uTrans*(1.0 - fres), 1.0, t.a);
    gl_FragColor = vec4(col*uExp, alpha);
  }`;
function faceMat(map){
  return new THREE.ShaderMaterial({
    uniforms: {...U, uMap: {value: map}}, side: THREE.DoubleSide,
    transparent: true, vertexShader: FACE_VS, fragmentShader: FACE_FS
  });
}
const cdFrontMat = faceMat(coverFrontTex), cdBackMat = faceMat(coverBackTex);
const cdBodyMat = new THREE.MeshStandardMaterial({color: 0xdfe3ea, metalness: 1, roughness: 0.2, envMap: envBright.map, side: THREE.DoubleSide});

// ---------- Vinilo ----------
const vColorLin = linearHex($('vColor').value);
const vinylBodyMat = new THREE.MeshPhysicalMaterial({color: vColorLin, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMap: envDark.map, envMapIntensity: 1.0, side: THREE.DoubleSide});
const vinylFaceMat = new THREE.MeshPhysicalMaterial({color: vColorLin, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMap: envDark.map, envMapIntensity: 1.0, emissive: new THREE.Color(1, 1, 1), emissiveMap: detailTex, emissiveIntensity: 0.05, bumpMap: detailTex, bumpScale: 0.003, side: THREE.DoubleSide});
const dustMat = new THREE.MeshBasicMaterial({map: dustTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.07, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide});
const labelFrontMat = new THREE.MeshStandardMaterial({map: labelTex(false), transparent: false, alphaTest: 0.5, roughness: 0.55, metalness: 0, envMap: envDark.map, envMapIntensity: 0.5, side: THREE.DoubleSide});
const labelBackMat  = new THREE.MeshStandardMaterial({map: labelTex(true),  transparent: false, alphaTest: 0.5, roughness: 0.55, metalness: 0, envMap: envDark.map, envMapIntensity: 0.5, side: THREE.DoubleSide});

// ---------- Geometría ----------
function lathe(profile){
  const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), 192);
  g.rotateX(Math.PI/2);
  return g;
}
function annulus(inner, outer, seg = 256, mirror = false, polar = false){
  const pos = [], uv = [], idx = [];
  for(let i = 0; i <= seg; i++){
    const a = i/seg*Math.PI*2, c = Math.cos(a), s2 = Math.sin(a);
    pos.push(inner*c, inner*s2, 0, outer*c, outer*s2, 0);
    const u1 = (inner*c/outer + 1)/2, v1 = (inner*s2/outer + 1)/2, u2 = (c + 1)/2, v2 = (s2 + 1)/2;
    if(polar) uv.push(i/seg, 0, i/seg, 1); else uv.push(mirror ? 1-u1 : u1, v1, mirror ? 1-u2 : u2, v2);
  }
  for(let i = 0; i < seg; i++){ const a = i*2, b = a+1, c2 = a+2, d = a+3; idx.push(a, b, c2, b, d, c2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function face(geo, mat, z, back){
  const m = new THREE.Mesh(geo, mat); m.position.z = z; if(back) m.rotation.y = Math.PI; return m;
}
function buildCD(){
  const g = new THREE.Group(), {R, T, HOLE, HUB, HUB_H} = CD, h = T/2;
  g.add(new THREE.Mesh(lathe([[R, -h], [R, h]]), cdBodyMat));
  g.add(new THREE.Mesh(lathe([[HUB, h], [HUB, h + HUB_H], [HOLE, h + HUB_H]]), cdBodyMat));
  g.add(new THREE.Mesh(lathe([[HOLE, -h - HUB_H], [HUB, -h - HUB_H], [HUB, -h]]), cdBodyMat));
  g.add(face(annulus(HUB, R), cdFrontMat, h + 0.02, false));
  g.add(face(annulus(HUB, R, 256, false), cdBackMat, -h - 0.02, true));
  g.scale.setScalar(1/R);
  return g;
}
function buildVinyl(){
  const g = new THREE.Group(), {R, T, HOLE, LABEL} = LP, h = T/2;
  g.add(new THREE.Mesh(lathe([[R, -h], [R, h]]), vinylBodyMat));
  g.add(face(annulus(HOLE, R, 256, false, true), vinylFaceMat, h + 0.02, false));
  g.add(face(annulus(HOLE, R, 256, false, true), vinylFaceMat, -h - 0.02, true));
  g.add(face(annulus(HOLE, R, 256, false, true), dustMat, h + 0.06, false));
  g.add(face(annulus(HOLE, R, 256, false, true), dustMat, -h - 0.06, true));
  g.add(face(annulus(HOLE, LABEL), labelFrontMat, h + 0.2, false));
  g.add(face(annulus(HOLE, LABEL, 256, false), labelBackMat, -h - 0.2, true));
  g.scale.setScalar(1/R);
  return g;
}
// Plain colors: flat, unlit, same colors as the cover of this tool (disc + lighter label, hole through)
const plainBodyMat = new THREE.MeshBasicMaterial({color: linearHex('#d9d9d9'), side: THREE.DoubleSide, toneMapped: false});
const plainEdgeMat = new THREE.MeshBasicMaterial({color: linearHex('#d9d9d9'), side: THREE.DoubleSide, toneMapped: false});
const plainLabelFrontMat = new THREE.MeshBasicMaterial({color: linearHex('#eaeaea'), side: THREE.DoubleSide, toneMapped: false});
const plainLabelBackMat = new THREE.MeshBasicMaterial({color: linearHex('#eaeaea'), side: THREE.DoubleSide, toneMapped: false});
function buildPlain(T, R, holeF){
  const g = new THREE.Group(), h = T/R/2;
  g.add(new THREE.Mesh(lathe([[1, -h], [1, h]]), plainEdgeMat));
  g.add(face(annulus(holeF, 1), plainBodyMat, h + 0.002, false));
  g.add(face(annulus(holeF, 1), plainBodyMat, -h - 0.002, true));
  g.add(face(annulus(holeF, 0.35), plainLabelFrontMat, h + 0.004, false));
  g.add(face(annulus(holeF, 0.35), plainLabelBackMat, -h - 0.004, true));
  return g;
}
const plainVinyl = buildPlain(LP.T, LP.R, 0.061), plainCD = buildPlain(CD.T, CD.R, 0.061);
const cdGroup = buildCD(), vinylGroup = buildVinyl();
const disc = new THREE.Group();
disc.add(cdGroup, vinylGroup, plainVinyl, plainCD);
scene.add(disc);

// ---------- Estado ----------
let mode = 'vinyl', style = 'plain', animName = 'frontal', animPlaying = true, tAnim = 0, lastT = performance.now(), exporting = false;
let userRx = 0, userRy = 0, dragging = false, lx = 0, ly = 0, recenter = false;
const BASE = {x: 0, y: 0};   // always seen from the front

function setOff(id, off){
  const g = $(id); g.classList.toggle('off', off);
  g.querySelectorAll('input, select, button').forEach(el => el.disabled = off);
}
function refresh(){
  const real = style === 'real';
  cdGroup.visible = real && mode === 'cd'; vinylGroup.visible = real && mode === 'vinyl';
  plainCD.visible = !real && mode === 'cd'; plainVinyl.visible = !real && mode === 'vinyl';
  $('tCD').classList.toggle('on', mode === 'cd'); $('tVN').classList.toggle('on', mode === 'vinyl');
  $('sReal').classList.toggle('on', real); $('sPlain').classList.toggle('on', !real);
  $('optCD').hidden = mode !== 'cd'; $('optVN').hidden = mode !== 'vinyl';   // by disc type
  // the options of the style that is not active stay visible but switched off
  setOff('optCD', !real); setOff('optVN', !real); setOff('optLights', !real); setOff('optPlain', real);
}
const setMode = m => { mode = m; refresh(); };
$('tCD').onclick = () => setMode('cd');
$('tVN').onclick = () => setMode('vinyl');
$('sReal').onclick = () => { style = 'real'; refresh(); };
$('sPlain').onclick = () => { style = 'plain'; refresh(); };
$('pBody').oninput = e => { const c = linearHex(e.target.value); plainBodyMat.color.copy(c); plainEdgeMat.color.copy(c); };
$('pLabel').oninput = e => { for(const m of [plainLabelFrontMat, plainLabelBackMat]) if(!m.map) m.color.copy(linearHex(e.target.value)); };   // the color is only for labels without an image
refresh();

// Cada animación es periódica: su último fotograma enlaza con el primero
function pose(name, t){
  const P = PERIOD[name] || 4, ph = 2*Math.PI*(t/P);
  switch(name){
    case 'girar':    return {x: BASE.x, y: BASE.y, z: ph};
    case 'volteo-y': return {x: BASE.x, y: BASE.y + ph, z: 0};
    case 'volteo-x': return {x: BASE.x + ph, y: BASE.y, z: 0};
    case 'balanceo': return {x: BASE.x + 0.12*Math.sin(ph*2), y: BASE.y + 0.8*Math.sin(ph), z: 0};
    default:         return {x: BASE.x, y: BASE.y, z: 0};
  }
}
document.querySelectorAll('#anims button').forEach(b => b.onclick = () => {
  animName = b.dataset.a; tAnim = 0;
  document.querySelectorAll('#anims button').forEach(x => x.classList.toggle('on', x === b));
});
document.querySelectorAll('#ratios button').forEach(b => b.onclick = () => {
  RATIO_KEY = b.dataset.r;
  document.querySelectorAll('#ratios button').forEach(x => x.classList.toggle('on', x === b));
  layoutStage();
});
$('center').onclick = () => {   // ease back to the front, taking the shortest way round
  userRy = ((userRy + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; recenter = true;
};
$('pause').onclick = () => { animPlaying = !animPlaying; $('pause').textContent = animPlaying ? 'Pause' : 'Resume'; };


// Ajustes
$('vColor').oninput = e => { const c = linearHex(e.target.value); vinylBodyMat.color.copy(c); vinylFaceMat.color.copy(c); };
// reflectividad: más alta = más brillo de entorno y barniz; más baja = superficie mate
function applyGloss(v){
  for(const m of [vinylBodyMat, vinylFaceMat]){
    m.envMapIntensity = v*1.67;
    m.clearcoat = Math.min(1, v*1.4);
  }
  vinylBodyMat.roughness = 0.5 - 0.25*v;
  vinylFaceMat.roughness = 0.45 - 0.25*v;
  for(const m of [labelFrontMat, labelBackMat]){ m.envMapIntensity = 0.1 + v*0.6; m.roughness = 0.75 - 0.2*v; m.needsUpdate = true; }
  vinylBodyMat.needsUpdate = vinylFaceMat.needsUpdate = true;
}
$('dust').oninput = e => { $('dustv').textContent = (+e.target.value).toFixed(2); dustMat.opacity = 0.14*(+e.target.value); };
$('refl').oninput = e => { $('reflv').textContent = (+e.target.value).toFixed(2); applyGloss(+e.target.value); };
applyGloss(0.5);
$('iri').oninput = e => U.uIri.value = +e.target.value;
$('trans').oninput = e => U.uTrans.value = +e.target.value;
function setBg(hex){ if(window.setFrameBg) window.setFrameBg(hex); renderer.setClearColor(new THREE.Color(hex), 1); }
$('bg').oninput = e => setBg(e.target.value);
setBg($('bg').value);

// Luces
$('bright').oninput = e => $('brv').textContent = (+e.target.value).toFixed(2);
// ---------- Lights: up to 3, placed on a "dome" pad ----------
// A light is a point (x, y) inside the unit circle as seen from the camera; z comes from the sphere, in front of the disc or behind it.
const LIGHT_DIST = 7;
const mkLight = (x, y, back, i, soft, on) => ({x, y, back: !!back, i, soft, on: on !== false, color: '#ffffff'});
const PRESETS = {
  studio: [mkLight(.5, .6, 0, 1.5, .6), mkLight(-.7, -.1, 0, .7, .8), mkLight(0, .2, 1, 1.2, .5)],
  top:    [mkLight(0, .9, 0, 2, .5), mkLight(0, 0, 0, 1, .5, false), mkLight(0, 0, 1, 1, .5, false)],
  side:   [mkLight(.9, .1, 0, 2, .4), mkLight(0, 0, 0, 1, .5, false), mkLight(0, 0, 1, 1, .5, false)],
  rim:    [mkLight(-.5, .3, 1, 2.5, .3), mkLight(.5, .3, 1, 2.5, .3), mkLight(0, 0, 0, 1, .5, false)],
  drama:  [mkLight(.85, -.3, 0, 3, .1), mkLight(0, 0, 0, 1, .5, false), mkLight(-.6, .3, 1, 1, .4)]
};
const lights = [mkLight(.52, .68, 0, 1.5, .6), mkLight(-.52, -.68, 1, 1, .6, false), mkLight(-.7, .1, 0, 1, .6, false)];
let sel = 0, aimMode = false;
const pad = $('pad'), PAD_R = 0.42;   // the unit circle has a radius of 42% of the pad width
const lz = l => Math.sqrt(Math.max(0, 1 - l.x*l.x - l.y*l.y))*(l.back ? -1 : 1);
const dots = lights.map((l, k) => {
  const d = document.createElement('div'); d.className = 'lp-dot'; d.textContent = k + 1; pad.appendChild(d);
  d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); selectLight(k); d.setPointerCapture(e.pointerId); d._drag = true; });
  d.addEventListener('pointermove', e => { if(d._drag) moveDot(k, e); });
  d.addEventListener('pointerup', () => { d._drag = false; CTPersist.save(); });
  return d;
});
function moveDot(k, e){
  const r = pad.getBoundingClientRect(), R = r.width*PAD_R;
  let x = (e.clientX - (r.left + r.width/2))/R, y = -(e.clientY - (r.top + r.height/2))/R;
  const m = Math.hypot(x, y); if(m > 1){ x /= m; y /= m; }
  lights[k].x = x; lights[k].y = y; drawPad();
}
function drawPad(){
  lights.forEach((l, k) => {
    const d = dots[k];
    d.style.left = (50 + l.x*PAD_R*100) + '%'; d.style.top = (50 - l.y*PAD_R*100) + '%';
    d.style.background = l.color; d.classList.toggle('back', l.back); d.classList.toggle('off', !l.on); d.classList.toggle('sel', k === sel);
  });
}
function syncLightUI(){
  const l = lights[sel];
  $('lOn').checked = l.on; $('lBack').checked = l.back; $('lColor').value = l.color;
  $('lInt').value = l.i; $('liv').textContent = l.i.toFixed(2); $('lSoft').value = l.soft; $('lsv').textContent = l.soft.toFixed(2);
  document.querySelectorAll('#lsel button').forEach((b, k) => b.classList.toggle('on', k === sel));
  drawPad();
}
function selectLight(k){ sel = k; syncLightUI(); }
document.querySelectorAll('#lsel button').forEach(b => b.onclick = () => selectLight(+b.dataset.l));
document.querySelectorAll('#lpre button').forEach(b => b.onclick = () => { PRESETS[b.dataset.p].forEach((l, k) => Object.assign(lights[k], l)); syncLightUI(); });
$('lOn').onchange = e => { lights[sel].on = e.target.checked; drawPad(); };
$('lBack').onchange = e => { lights[sel].back = e.target.checked; drawPad(); };
$('lColor').oninput = e => { lights[sel].color = e.target.value; drawPad(); };
$('lInt').oninput = e => { lights[sel].i = +e.target.value; $('liv').textContent = lights[sel].i.toFixed(2); };
$('lSoft').oninput = e => { lights[sel].soft = +e.target.value; $('lsv').textContent = lights[sel].soft.toFixed(2); };
// dragging on the empty pad moves the selected light there
pad.addEventListener('pointerdown', e => { if(e.target !== pad && !e.target.classList.contains('lp-disc')) return; moveDot(sel, e); pad._drag = true; pad.setPointerCapture(e.pointerId); });
pad.addEventListener('pointermove', e => { if(pad._drag) moveDot(sel, e); });
pad.addEventListener('pointerup', () => { pad._drag = false; CTPersist.save(); });

// "Place by clicking the disc": the highlight lands where you click (mirror reflection of the camera ray)
$('aim').onclick = () => { aimMode = !aimMode; $('aim').classList.toggle('on', aimMode); stage.style.cursor = aimMode ? 'crosshair' : ''; };
const raycaster = new THREE.Raycaster();
function aimAt(cx, cy){
  const r = stage.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((cx - r.left)/r.width)*2 - 1, -(((cy - r.top)/r.height)*2 - 1)), camera);
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(disc.quaternion), o = raycaster.ray.origin, dir = raycaster.ray.direction;
  const den = dir.dot(n); if(Math.abs(den) < 1e-3) return;
  const P = o.clone().addScaledVector(dir, -o.dot(n)/den);
  const V = camera.position.clone().sub(P).normalize(); if(V.dot(n) < 0) n.negate();
  const L = V.clone().negate().reflect(n).normalize();                    // direction from the disc towards the light
  lights[sel].x = L.x; lights[sel].y = L.y; lights[sel].back = L.z < 0; lights[sel].on = true;
  syncLightUI();
}

// ---------- Zoom (slider, +/- buttons, mouse wheel on the artwork) ----------
let zoomV = 1;
function setZoom(v){ zoomV = clamp(v, 0.3, 2.5); $('zoom').value = zoomV; $('zv').textContent = Math.round(zoomV*100) + '%'; }
$('zoom').oninput = e => setZoom(+e.target.value);
$('zIn').onclick = () => setZoom(zoomV*1.12);
$('zOut').onclick = () => setZoom(zoomV/1.12);
stage.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoomV*Math.exp(-e.deltaY*0.0015)); CTPersist.save(); }, {passive: false});

// ---------- Girar manteniendo el clic: se queda donde sueltas ----------
stage.addEventListener('pointerdown', e => {
  if(aimMode && style === 'real'){ dragging = true; aiming = true; aimAt(e.clientX, e.clientY); stage.setPointerCapture(e.pointerId); return; }
  dragging = true; recenter = false; lx = e.clientX; ly = e.clientY; stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if(!dragging) return;
  if(aiming){ aimAt(e.clientX, e.clientY); return; }
  const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
  userRy += dx*0.01;
  userRx = clamp(userRx + dy*0.01, -1.5, 1.5);   // stays exactly where the mouse stopped
});
let aiming = false;
const endDrag = () => { dragging = false; if(aiming){ aiming = false; CTPersist.save(); } };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// ---------- Labels: ONE image per side, used by every version (Realistic and Plain, vinyl and CD) ----------
const labelImgs = {F: null, B: null};   // downscaled data URLs, also what gets remembered
function setLabel(side, url){
  labelImgs[side] = url;
  const img = new Image();
  img.onload = () => {
    const tex = srgb => { const t = new THREE.Texture(img); if(srgb) t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; return t; };
    const real = side === 'F' ? labelFrontMat : labelBackMat, plain = side === 'F' ? plainLabelFrontMat : plainLabelBackMat;
    real.map = tex(true); real.needsUpdate = true;                                     // vinyl label
    (side === 'F' ? cdFrontMat : cdBackMat).uniforms.uMap.value = tex(false);          // CD face
    plain.map = tex(true); plain.color.set(0xffffff); plain.transparent = true; plain.needsUpdate = true;   // plain label
    CTPersist.save();
  };
  img.src = url;
}
function pickLabel(side){
  return e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 1024/Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width*k); c.height = Math.round(im.height*k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setLabel(side, c.toDataURL('image/webp', 0.92));   // keeps transparency; small enough to remember
    }; im.src = r.result; };
    r.readAsDataURL(f);
  };
}
$('fLabF').onchange = pickLabel('F');
$('fLabB').onchange = pickLabel('B');

// ---------- Tamaño del escenario según el formato ----------
function layoutStage(){
  const [W, H] = RATIOS[RATIO_KEY], ar = W/H;
  stage.style.setProperty('--ar', ar);              // CSS sizes the artwork frame to fit the panel
  const w = stage.clientWidth, h = stage.clientHeight;
  if(!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = ar;
  // vertical formats: the disc must fit the width, so the camera moves back
  camera.position.z = Math.max(5.4, 1.4/(Math.tan(15*Math.PI/180)*ar));
  camera.updateProjectionMatrix();
}
new ResizeObserver(() => { if(!exporting) layoutStage(); }).observe(viewer);
layoutStage();

// ---------- Renderizado de un fotograma ----------
function applyLights(){
  const bright = style === 'plain' ? 1 : +$('bright').value;
  renderer.toneMappingExposure = bright; U.uExp.value = bright;
  let first = -1;
  lights.forEach((l, k) => {
    const sp = spots[k]; sp.visible = l.on; sp.intensity = l.i; sp.color.set(l.color);
    sp.penumbra = 0.1 + 0.9*l.soft; sp.position.set(l.x*LIGHT_DIST, l.y*LIGHT_DIST, lz(l)*LIGHT_DIST);
    if(l.on && first < 0) first = k;
  });
  // the CD's glint follows the first light that is on (or the key light if none)
  if(first >= 0) U.uLight.value.copy(spots[first].position).normalize(); else U.uLight.value.set(2, 4, 5).normalize();
}
function renderAt(t){
  const p = pose(animName, t);
  disc.rotation.set(p.x + userRx, p.y + userRy, p.z);
  disc.scale.setScalar(zoomV);
  U.uCam.value.copy(camera.position);
  applyLights();
  renderer.render(scene, camera);
}

// ---------- Bucle de vista previa ----------
function frame(now){
  const dt = Math.min(0.1, (now - lastT)/1000); lastT = now;
  if(!exporting){
    if(animPlaying) tAnim += dt;
    if(recenter){ userRx *= 0.85; userRy *= 0.85; if(Math.abs(userRx) + Math.abs(userRy) < 0.002){ userRx = userRy = 0; recenter = false; } }
    renderAt(tAnim);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

syncLightUI();

// ---------- Remember the settings and the images between visits ----------
CTPersist.init('disc', {
  get: () => ({mode, style, anim: animName, ratio: RATIO_KEY, imgs: labelImgs, lights, sel, zoom: zoomV}),
  set: x => {
    if(x.mode) mode = x.mode; if(x.style) style = x.style; refresh();
    if(x.anim){ const b = document.querySelector(`#anims button[data-a="${x.anim}"]`); if(b) b.click(); }
    if(x.ratio){ const b = document.querySelector(`#ratios button[data-r="${x.ratio}"]`); if(b) b.click(); }
    if(x.lights){ x.lights.forEach((l, k) => { if(lights[k]) Object.assign(lights[k], l); }); selectLight(x.sel || 0); }
    if(x.zoom) setZoom(x.zoom);
    if(x.imgs){ if(x.imgs.F) setLabel('F', x.imgs.F); if(x.imgs.B) setLabel('B', x.imgs.B); }
  }
});

// ---------- Export loop (shared exporter) ----------
$('exp').onclick = async () => {
  if(exporting) return;
  const P = PERIOD[animName] || 4, FPS = +$('fps').value || 60, [W, H] = RATIOS[RATIO_KEY], status = t => $('status').textContent = t;
  exporting = true; $('exp').disabled = true;
  try{
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    camera.aspect = W/H; camera.position.z = Math.max(5.4, 1.4/(Math.tan(15*Math.PI/180)*(W/H))); camera.updateProjectionMatrix();
    const out = await VideoExport.run({canvas, renderAt, period: P, fps: FPS, width: W, height: H, status});
    const name = `${mode}-${style}-${animName}-${RATIO_KEY.replace(':','x')}.${out.ext}`;
    const result = await VideoExport.save(name, out.blob);
    const msgs = {saved: 'Done', declined: 'Download cancelled', unavailable: 'Downloads are not available in this view', rejected_extension: 'Format not allowed', too_large: 'The file is too large'};
    status(`${msgs[result] || 'Could not save'}: ${name} · ${W}×${H} · ${P} s loop · ${out.note}`);
  }catch(err){ status(err && err.message || 'Export failed'); }
  finally {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); layoutStage();
    exporting = false; $('exp').disabled = false;
  }
};
