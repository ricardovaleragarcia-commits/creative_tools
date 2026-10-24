/* Núcleo de física del multiplicador. Sin DOM: se puede probar en node. */
(function (root) {
'use strict';

/* ---------- Forma ---------- */
function polyArea(p){let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return Math.abs(a)/2}

// outer: [[x,y]...] en px; parts opcional (piezas convexas en px). decomp: poly-decomp o null.
function buildShape(outer, decomp, partsPx, innerPx){
  let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
  outer.forEach(p=>{minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1])});
  const cx=(minx+maxx)/2,cy=(miny+maxy)/2,u=(maxy-miny)||1;
  const nrm=p=>[(p[0]-cx)/u,(p[1]-cy)/u];
  const o=outer.map(nrm);
  let parts=null;
  if(partsPx)parts=partsPx.map(q=>q.map(nrm));
  else{
    try{
      if(decomp){
        const poly=o.map(p=>p.slice());decomp.makeCCW(poly);
        if(decomp.isSimple&&!decomp.isSimple(poly))throw new Error('no simple');
        const res=decomp.quickDecomp(poly);
        parts=res.filter(q=>q.length>=3&&polyArea(q)>1e-7);
      }
    }catch(e){parts=null}
    if(!parts||!parts.length)parts=[convexHull(o)];
  }
  let R=0;o.forEach(p=>{R=Math.max(R,Math.hypot(p[0],p[1]))});
  return {cx,cy,u,outer:o,inner:innerPx?innerPx.map(nrm):null,parts,area:polyArea(o),R,bw:(maxx-minx)/u,bh:(maxy-miny)/u,hull:!partsPx&&parts.length===1};
}
function convexHull(pts){
  const p=pts.map(a=>a.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[];for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
  const up=[];for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
  up.pop();lo.pop();return lo.concat(up);
}

/* Default shape = the star of this tool's cover (Figma): 6 points, 12 vertices (tips at even indexes, notches at odd), solid.
   Coordinates are the exact vector from the cover (large star). */
const STAR_OUTER=[[266.413,0],[236.36,119.893],[355.217,153.814],[236.36,187.734],[266.413,307.627],[177.609,221.654],[88.8043,307.627],[118.857,187.734],[0,153.814],[118.857,119.893],[88.8043,0],[177.609,85.9731]];
const STAR_INNER=null;   // solid: no hole
function starShape(){
  const T=[0,2,4,6,8,10].map(i=>STAR_OUTER[i]),C=[1,3,5,7,9,11].map(i=>STAR_OUTER[i]);
  const parts=[C.slice()];                       // hexágono central (convexo)
  for(let i=0;i<6;i++)parts.push([C[(i+5)%6],T[i],C[i]]); // 6 puntas (triángulos)
  return buildShape(STAR_OUTER,null,parts,STAR_INNER);
}


// Expande un polígono convexo d px hacia fuera (esquinas en inglete): garantiza ≥2d de holgura entre formas
function offsetConvex(poly,d){
  const n=poly.length;let ar=0;
  for(let i=0;i<n;i++){const q=poly[(i+1)%n];ar+=poly[i][0]*q[1]-q[0]*poly[i][1]}
  const sg=ar>0?1:-1; // orientación
  const L=[];
  for(let i=0;i<n;i++){
    const a=poly[i],b=poly[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;
    const nx=sg*dy/l,ny=-sg*dx/l; // normal exterior
    L.push({px:a[0]+nx*d,py:a[1]+ny*d,dx,dy});
  }
  const out=[];
  for(let i=0;i<n;i++){
    const A=L[(i+n-1)%n],B=L[i],den=A.dx*B.dy-A.dy*B.dx;
    if(Math.abs(den)<1e-9){out.push([B.px,B.py]);continue}
    const t=((B.px-A.px)*B.dy-(B.py-A.py)*B.dx)/den;
    out.push([A.px+A.dx*t,A.py+A.dy*t]);
  }
  return out;
}


/* ---------- Contorno desde una máscara (para PNG/SVG propios) ---------- */
function traceOuter(g,w,h){ // Moore-neighbour; g[y*w+x]=1 si hay forma. Devuelve centros de píxel del borde exterior.
  let sx=-1,sy=-1;
  outer:for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(g[y*w+x]){sx=x;sy=y;break outer}
  if(sx<0)return null;
  const D=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const fill=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&g[y*w+x]===1;
  const pts=[];let px=sx,py=sy,bi=4,guard=0,limit=w*h*4;
  do{
    pts.push([px,py]);let moved=false;
    for(let k=1;k<=8;k++){
      const di=(bi+k)%8,nx=px+D[di][0],ny=py+D[di][1];
      if(fill(nx,ny)){
        const pv=(di+7)%8,vx=px+D[pv][0]-nx,vy=py+D[pv][1]-ny;
        bi=D.findIndex(d=>d[0]===vx&&d[1]===vy);if(bi<0)bi=4;
        px=nx;py=ny;moved=true;break;
      }
    }
    if(!moved)break;
  }while(!(px===sx&&py===sy)&&++guard<limit);
  return pts;
}
function rdp(pts,eps){ // Douglas-Peucker sobre polilínea abierta
  if(pts.length<3)return pts.slice();
  const a=pts[0],b=pts[pts.length-1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;
  let md=-1,mi=0;
  for(let i=1;i<pts.length-1;i++){const d=Math.abs((pts[i][0]-a[0])*dy-(pts[i][1]-a[1])*dx)/l;if(d>md){md=d;mi=i}}
  if(md<=eps)return [a,b];
  const L=rdp(pts.slice(0,mi+1),eps),R=rdp(pts.slice(mi),eps);
  return L.slice(0,-1).concat(R);
}
function simplifyClosed(pts,eps){
  if(pts.length<4)return pts;
  let i0=0,j0=0,best=-1; // dos puntos lejanos para partir el lazo
  for(let i=0;i<pts.length;i+=Math.max(1,pts.length>>6))for(let j=i+1;j<pts.length;j+=Math.max(1,pts.length>>6)){
    const d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]);if(d>best){best=d;i0=i;j0=j}}
  const A=pts.slice(i0,j0+1),B=pts.slice(j0).concat(pts.slice(0,i0+1));
  return rdp(A,eps).slice(0,-1).concat(rdp(B,eps).slice(0,-1));
}
// grid: máscara w×h. scale: píxeles de imagen por píxel de rejilla. Devuelve contorno simplificado en px de imagen.
function outlineFromGrid(g,w,h,scale,maxVerts){
  const tr=traceOuter(g,w,h);if(!tr||tr.length<3)return null;
  let eps=0.9,poly=simplifyClosed(tr,eps);
  while(poly.length>(maxVerts||70)&&eps<12){eps*=1.4;poly=simplifyClosed(tr,eps)}
  // el borde por centros de píxel queda ~0,5 px por dentro: se expande 0,5 px desde el centroide
  let cx=0,cy=0;poly.forEach(p=>{cx+=p[0];cy+=p[1]});cx/=poly.length;cy/=poly.length;
  return poly.map(p=>{const dx=p[0]-cx,dy=p[1]-cy,l=Math.hypot(dx,dy)||1;return [(p[0]+dx/l*0.5+0.5)*scale,(p[1]+dy/l*0.5+0.5)*scale]});
}

/* ---------- Simulación ---------- */
function createSim(Matter, shape0, P){
  const {Engine,Bodies,Body,Composite,Query,Vertices}=Matter;
  let shape=shape0,W=P.W,H=P.H;
  let engine,world,stars,walls;
  let t,stepIdx,phase,fadeT,scale,alpha,cool=0,lastSpawn=-9;
  let memo={},curStep=null,uid=0;
  let plans={},lat=null,job=null,ready=false;
  const SUB=1/480;let asleep=false,restTime=0;
  function tune(n){ // con muchas copias se bajan las iteraciones (los subpasos a 480 Hz se mantienen: menos los vuelve inestable)
    engine.positionIterations=n>200?10:n>100?14:20;engine.velocityIterations=n>200?8:n>100?10:14;
  }
  const SHRINKF=0.985, TAU=Math.PI*2;

  const MAXN=100;
  const seq=()=>{const s=String(P.seq).split(/[^0-9]+/).map(Number).filter(n=>n>=1).map(n=>Math.min(n,MAXN));return s.length?s:[1]};
  const targets=()=>{ // copias totales en cada paso ("total" o "nuevas por paso")
    const raw=seq();
    if(P.mode==='new'){let c=0;return raw.map(n=>(c=Math.min(c+n,MAXN)))}
    return raw.map(n=>Math.min(n,MAXN));
  };
  const kInfl=s=>1+P.gap/(0.9*shape.R*s);
  const rnd=()=>Math.random();

  const GROW=1.035; // tras aparecer solo se permite un +3,5 % (imperceptible)
  const sMaxFor=()=>P.maxSize*Math.min(W/shape.bw,H/shape.bh);
  function sizeFor(n){ // cota superior: las n copias ocupando el 100 % del marco; la búsqueda baja hasta lo que realmente cabe
    return Math.max(Math.min(Math.sqrt(W*H/(n*shape.area)),sMaxFor()),4);
  }
  function build(s){
    const k=1,pr={friction:P.friction,frictionStatic:P.friction*1.6,restitution:P.bounce,frictionAir:0.0015,density:0.001,slop:0.02};
    const parts=shape.parts.map(poly=>{
      const v=offsetConvex(poly.map(p=>[p[0]*s,p[1]*s]),P.gap/2).map(p=>({x:p[0],y:p[1]})),c=Vertices.centre(v);
      return Bodies.fromVertices(c.x,c.y,[v],Object.assign({},pr),false);
    });
    const b=parts.length>1?Body.create(Object.assign({parts},pr)):parts[0];
    b.plugin={s,k,com:{x:b.position.x,y:b.position.y}};
    return b;
  }
  function makeWalls(){
    const T=400,o={isStatic:true,friction:P.friction,frictionStatic:P.friction*1.6,restitution:P.bounce*.5};
    return [Bodies.rectangle(W/2,H+T/2,W+2*T,T,o),Bodies.rectangle(-T/2,H/2,T,H+2*T,o),
            Bodies.rectangle(W+T/2,H/2,T,H+2*T,o),Bodies.rectangle(W/2,-T/2,W+2*T,T,o)];
  }
  function init(){
    engine=Engine.create({positionIterations:20,velocityIterations:14,enableSleeping:true});
    world=engine.world;stars=[];walls=makeWalls();Composite.add(world,walls);
    applyGravity();restart();
  }
  function applyGravity(){engine.gravity.x=0;engine.gravity.y=1;engine.gravity.scale=0.001*P.gravity}
  function restart(){
    stars.forEach(b=>Composite.remove(world,b));stars=[];
    t=0;stepIdx=-1;phase='run';fadeT=0;alpha=1;cool=0;lastSpawn=-9;curStep=null;asleep=false;restTime=0;
    scale=(plans[targets()[0]]||{s:4}).s;
  }
  function worldPoly(b,pts){ // contorno en px de pantalla (para dibujar / comprobar)
    const {s,com}=b.plugin,c=Math.cos(b.angle),sn=Math.sin(b.angle);
    return pts.map(p=>{const x=p[0]*s-com.x,y=p[1]*s-com.y;return [b.position.x+x*c-y*sn,b.position.y+x*sn+y*c]});
  }
  function rescale(sNew){ // encoge al instante (nunca crece); mantiene posición, giro y velocidad
    const old=stars.slice();stars=[];
    old.forEach(o=>{
      if(o.plugin.s<=sNew+1e-6){stars.push(o);return}
      const n=build(sNew);
      Body.setPosition(n,{x:o.position.x,y:o.position.y});Body.setAngle(n,o.angle);
      Body.setVelocity(n,{x:o.velocity.x,y:o.velocity.y});Body.setAngularVelocity(n,o.angularVelocity);
      n.plugin.born=o.plugin.born;n.plugin.id=o.plugin.id;
      Composite.remove(world,o);Composite.add(world,n);stars.push(n);
    });
    scale=sNew;
  }

  // ¿hay hueco libre para una copia en (x,y,ang)? (excl: cuerpos que se ignoran)
  function freeAt(test,x,y,ang,excl){
    Body.setPosition(test,{x,y});Body.setAngle(test,ang);
    const bs=test.bounds;if(bs.min.x<0||bs.max.x>W||bs.min.y<0||bs.max.y>H)return false;
    const list=excl?stars.filter(o=>o!==excl):stars;
    return Query.collides(test,list).length===0;
  }
  // desliza la copia contra el muro más cercano y hacia abajo hasta tocar (empaquetado compacto)
  function compact(test,x,y,ang,excl){
    const sx=x<W/2?-1:1;let moved=true,it=0;
    while(moved&&it++<40){
      moved=false;
      for(const [dx,dy] of [[sx,0],[0,1]]){
        for(const st of [24,12,6,3,1]){
          let guard=0;
          while(guard++<60&&freeAt(test,x+dx*st,y+dy*st,ang,excl)){x+=dx*st;y+=dy*st;moved=true}
        }
      }
    }
    return {x,y};
  }
  // busca un hueco libre, lo compacta y devuelve la mejor opción (la más baja y pegada al muro); null si no cabe
  function findSpot(test,excl){
    let best=null,found=0;
    for(let i=0;i<260&&found<5;i++){
      const ang=rnd()*TAU;Body.setAngle(test,ang);Body.setPosition(test,{x:W/2,y:H/2});
      const hb=test.bounds,hw=(hb.max.x-hb.min.x)/2,hh=(hb.max.y-hb.min.y)/2;
      const dx=test.position.x-(hb.min.x+hb.max.x)/2,dy=test.position.y-(hb.min.y+hb.max.y)/2;
      const x=hw+1+rnd()*Math.max(W-2*hw-2,0)+dx,y=hh+1+dy+rnd()*Math.max(H-2*hh-2,0);
      if(!freeAt(test,x,y,ang,excl))continue;
      found++;
      const c=compact(test,x,y,ang,excl),score=c.y+0.15*Math.min(c.x,W-c.x);
      if(!best||score>best.score)best={x:c.x,y:c.y,ang,score,hh};
    }
    return best;
  }
  // sube la copia por el camino libre (hasta el techo) para que caiga desde arriba
  function liftUp(test,b){
    let y=b.position.y;const ang=b.angle,x=b.position.x;
    for(let d=8;d<=H;d+=8){if(freeAt(test,x,b.position.y-d,ang,b))y=b.position.y-d;else break}
    return y;
  }
  function placeMany(K,s){ // las K copias aparecen de golpe; si no caben todas se deshace y se devuelve false
    const test=build(s),added=[];
    const undo=()=>{added.forEach(x=>{Composite.remove(world,x);const i=stars.indexOf(x);if(i>=0)stars.splice(i,1)})};
    for(let k=0;k<K;k++){
      const sp=findSpot(test,null);
      if(!sp){undo();return false}
      const b=build(s);Body.setAngle(b,sp.ang);Body.setPosition(b,{x:sp.x,y:sp.y});
      b.plugin.born=t;b.plugin.id=++uid;Composite.add(world,b);stars.push(b);added.push(b);
    }
    // segunda pasada: cada copia sube por su camino libre y empieza a caer
    added.slice().sort((a,b)=>a.position.y-b.position.y).forEach(b=>{
      const y=liftUp(test,b);Body.setPosition(b,{x:b.position.x,y});
      Body.setVelocity(b,{x:(rnd()-.5)*2,y:0});Body.setAngularVelocity(b,(rnd()-.5)*0.04*P.spin);
    });
    return true;
  }
  function placeOne(test,s){ // último recurso (una sola copia)
    const sp=findSpot(test,null);if(!sp)return null;
    const b=build(s);Body.setAngle(b,sp.ang);Body.setPosition(b,{x:sp.x,y:sp.y});
    b.plugin.born=t;b.plugin.id=++uid;Composite.add(world,b);stars.push(b);
    const y=liftUp(test,b);Body.setPosition(b,{x:b.position.x,y});return b;
  }
  // Paso: todo se encoge un poco Y las copias nuevas aparecen a la vez; el tamaño baja hasta que quepan todas
  function finishStep(){curStep=null}
  function originOf(b){const cm=b.plugin.com,c=Math.cos(b.angle),sn=Math.sin(b.angle);return {x:b.position.x-cm.x*c+cm.y*sn,y:b.position.y-cm.x*sn-cm.y*c}}

  /* ---- cálculo previo: retícula de la forma + una disposición por cada número de copias ---- */
  const now=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  function neededN(){const seen={},out=[];targets().forEach(n=>{if(!plans[n]&&!seen[n]){seen[n]=1;out.push(n)}});return out}
  function gridPlan(n){ // plan de emergencia: cuadrícula simple
    const cols=Math.max(1,Math.ceil(Math.sqrt(n*W/H))),rows=Math.ceil(n/cols),cw=W/cols,ch=H/rows;
    const sz=0.8*Math.min(cw/shape.bw,ch/shape.bh),items=[];
    for(let i=0;i<n;i++)items.push({x:(i%cols+0.5)*cw,y:H-(Math.floor(i/cols)+0.5)*ch,a:0});
    return {s:sz,phi:0,items};
  }
  function prepare(ms){ // avanza el cálculo previo durante ~ms milisegundos; deja de ser "no listo" al terminar
    const t0=now();
    while(!ready&&now()-t0<ms){
      if(!lat||!lat.v1){
        if(!job)job={gen:StarLattice.latticeGen(shape)};
        const r=job.gen.next();if(r.done){lat=r.value;job=null}
        continue;
      }
      const need=neededN();
      if(!need.length){ready=true;break}
      const n=need[0];
      if(!job)job={gen:StarLattice.planGen(shape,lat,n,W,H,P.gap,{}),n};
      const r=job.gen.next();
      if(r.done){plans[n]=r.value||gridPlan(n);job=null}
    }
    if(!ready&&lat&&!job&&!neededN().length)ready=true;
    return ready;
  }
  function prepareAll(){while(!prepare(1e9)){}restart()}
  function progress(){
    const tot=1+new Set(targets()).size,done=(lat?1:0)+Object.keys(plans).filter(k=>targets().indexOf(+k)>=0).length;
    return Math.min(1,done/tot);
  }

  /* ---- aparición: todas las copias del paso se colocan de golpe en su disposición precalculada ---- */
  function appear(n){
    finishStep();
    const plan=plans[n];if(!plan)return;
    let slots,sz=plan.s;
    if(plan.variants){ // cada vez una disposición distinta (el control "Variation" decide cuánto más pequeña puede ser)
      // Aleatoriedad fija al 100 %: cualquier variante (incluidas las algo más pequeñas) y posición distinta en cada aparición
      const v=plan.variants[Math.floor(rnd()*plan.variants.length)];
      slots=StarLattice.layoutFrom(v,n,W,H,rnd);sz=v.s;
    }else slots=plan.items;
    tune(n);
    const old=stars.slice(),pairs=[];
    old.forEach((b,i)=>{const o=originOf(b);slots.forEach((sl,j)=>pairs.push([Math.hypot(o.x-sl.x,o.y-sl.y),i,j]))});
    pairs.sort((x,y)=>x[0]-y[0]);
    const uI={},uJ={},assign={};
    pairs.forEach(pr=>{if(uI[pr[1]]||uJ[pr[2]])return;uI[pr[1]]=1;uJ[pr[2]]=1;assign[pr[2]]=old[pr[1]]});
    old.forEach(b=>Composite.remove(world,b));stars=[];
    slots.forEach((sl,j)=>{
      const nb=build(sz),c=Math.cos(sl.a),sn=Math.sin(sl.a),cm=nb.plugin.com,ex=assign[j];
      Body.setAngle(nb,sl.a);Body.setPosition(nb,{x:sl.x+cm.x*c-cm.y*sn,y:sl.y+cm.x*sn+cm.y*c});
      Body.setVelocity(nb,{x:0,y:0});Body.setAngularVelocity(nb,0);
      nb.plugin.id=ex?ex.plugin.id:++uid;nb.plugin.born=ex?ex.plugin.born:t;
      Composite.add(world,nb);stars.push(nb);
    });
    scale=sz;curStep=null;lastSpawn=t;asleep=false;restTime=0;
    if(+P.shake>0)shake();
  }

  function tick(h){
    t+=h;
    if(phase==='run'){
      const sq=seq(),idx=Math.min(Math.floor(t/P.stepDur),sq.length-1);
      while(stepIdx<idx){stepIdx++;appear(targets()[stepIdx]);lastSpawn=t}
      if(t>=sq.length*P.stepDur+P.hold){finishStep();restart();return}
    }
    if(!asleep)Engine.update(engine,h*1000);
  }

  /* ---- Garantía final sobre la geometría DIBUJADA (no la del casco de colisión) ---- */
  function satMTV(A,B){ // polígonos convexos; devuelve {nx,ny,d} (empuja A→B) o null si no se tocan
    let best=1e18,bx=0,by=0;
    for(const P_ of [A,B]){
      for(let i=0;i<P_.length;i++){
        const a=P_[i],b=P_[(i+1)%P_.length];let nx=b[1]-a[1],ny=a[0]-b[0];const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
        let a0=1e18,a1=-1e18,b0=1e18,b1=-1e18;
        for(const q of A){const d=q[0]*nx+q[1]*ny;if(d<a0)a0=d;if(d>a1)a1=d}
        for(const q of B){const d=q[0]*nx+q[1]*ny;if(d<b0)b0=d;if(d>b1)b1=d}
        const o=Math.min(a1,b1)-Math.max(a0,b0);
        if(o<=0)return null;
        if(o<best){best=o;bx=nx;by=ny}
      }
    }
    const ca=A.reduce((m,q)=>[m[0]+q[0]/A.length,m[1]+q[1]/A.length],[0,0]),cb=B.reduce((m,q)=>[m[0]+q[0]/B.length,m[1]+q[1]/B.length],[0,0]);
    if((cb[0]-ca[0])*bx+(cb[1]-ca[1])*by<0){bx=-bx;by=-by}
    return {nx:bx,ny:by,d:best};
  }
  const partsOf=b=>b.parts.length>1?b.parts.slice(1):[b];
  function infoOf(b){
    const ps=partsOf(b).map(q=>q.vertices.map(v=>[v.x,v.y]));let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    ps.forEach(poly=>poly.forEach(q=>{if(q[0]<x0)x0=q[0];if(q[0]>x1)x1=q[0];if(q[1]<y0)y0=q[1];if(q[1]>y1)y1=q[1]}));
    return {b,ps,x0,y0,x1,y1};
  }
  function project(maxIt){ // empuja fuera cualquier solape y mete en el marco; true si el resultado queda limpio
    maxIt=maxIt||24;const EPS=0.03,n=stars.length,TOL=Math.max(0,+P.gap||0)*0.75; // el casco ya incluye la holgura: se tolera rozarla (las formas dibujadas siguen separadas)
    if(!n)return true;
    const info=stars.map(infoOf);
    for(let it=0;it<maxIt;it++){
      let moved=false;
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        const A=info[i],B=info[j];
        if(A.x1<B.x0||B.x1<A.x0||A.y1<B.y0||B.y1<A.y0)continue;
        let w=null;
        for(const pa of A.ps)for(const pb of B.ps){const m=satMTV(pa,pb);if(m&&(!w||m.d>w.d))w=m}
        if(w&&w.d>TOL){
          const d=(w.d-TOL+EPS)/2;
          Body.setPosition(A.b,{x:A.b.position.x-w.nx*d,y:A.b.position.y-w.ny*d});
          Body.setPosition(B.b,{x:B.b.position.x+w.nx*d,y:B.b.position.y+w.ny*d});
          info[i]=infoOf(A.b);info[j]=infoOf(B.b);moved=true;
        }
      }
      for(let i=0;i<n;i++){
        const X=info[i];let dx=0,dy=0;
        if(X.x0<0)dx=-X.x0+EPS;else if(X.x1>W)dx=W-X.x1-EPS;
        if(X.y0<0)dy=-X.y0+EPS;else if(X.y1>H)dy=H-X.y1-EPS;
        if(dx||dy){Body.setPosition(X.b,{x:X.b.position.x+dx,y:X.b.position.y+dy});info[i]=infoOf(X.b);moved=true}
      }
      if(!moved)return true;
    }
    return false;
  }

  /* ---- Presión: tras aparecer las copias, todo se hincha hasta quedar encajado (llenar el marco) ---- */
  function snapshot(){return stars.map(b=>({x:b.position.x,y:b.position.y,a:b.angle,vx:b.velocity.x,vy:b.velocity.y,w:b.angularVelocity,born:b.plugin.born,id:b.plugin.id}))}
  function setAll(sNew,snap){
    const old=stars;stars=[];
    old.forEach((o,i)=>{
      const q=snap?snap[i]:{x:o.position.x,y:o.position.y,a:o.angle,vx:o.velocity.x,vy:o.velocity.y,w:o.angularVelocity,born:o.plugin.born,id:o.plugin.id};
      const n=build(sNew);Body.setPosition(n,{x:q.x,y:q.y});Body.setAngle(n,q.a);
      Body.setVelocity(n,{x:q.vx,y:q.vy});Body.setAngularVelocity(n,q.w);n.plugin.born=q.born;n.plugin.id=q.id;
      Composite.remove(world,o);Composite.add(world,n);stars.push(n);
    });
    scale=sNew;
  }
  let gStep=0.012,shakeCool=0,inflAcc=0;
  function shake(){ // agitación suave: abre holguras para que la pila siga compactándose
    const A=+P.shake||0;if(!(A>0))return;asleep=false;restTime=0;wakeAll();
    stars.forEach(b=>{
      Body.setVelocity(b,{x:b.velocity.x+(rnd()-.5)*A,y:b.velocity.y-rnd()*A*0.7});
      Body.setAngularVelocity(b,b.angularVelocity+(rnd()-.5)*A*0.03);
    });
  }
  function inflateStep(dt){
    if(phase!=='run'||!stars.length||!(P.press>0))return;
    shakeCool-=dt;
    if(cool>0){cool-=dt;return}
    if(t-lastSpawn<(+P.pressDelay||0.25)){gStep=0.012;inflAcc=0;return} // deja respirar justo después de aparecer
    if(stars.length<targets()[Math.max(stepIdx,0)])return;
    if(!curStep||scale>=curStep.cap-1e-6)return; // el tamaño ya está definido: sin cambios visibles
    inflAcc+=dt;
    const jammed=gStep<=0.0009;
    if(inflAcc<(jammed?0.05:0.025))return; // atascada: se reintenta menos a menudo (ahorra CPU)
    const step=inflAcc;inflAcc=0;
    const maxStep=Math.min(P.press*step,0.04),sOld=scale,snap=snapshot();
    gStep=Math.min(gStep,maxStep,curStep.cap/sOld-1);
    if(gStep<=1e-5)return;
    setAll(sOld*(1+gStep));
    if(project(140)){gStep=Math.min(gStep*1.25,maxStep)}
    else{ // no cabe: se queda como estaba (tensión); paso más fino y, si ya es mínimo, agitar
      setAll(sOld,snap);gStep=Math.max(gStep*0.5,0.0006);
      if(gStep<=0.0009&&shakeCool<=0){shake();shakeCool=0.25}
    }
  }

  function update(dt){ // dt en s, tiempo real
    if(!ready){if(!prepare(12))return;restart()}
    dt=Math.min(dt,0.05);
    let n=Math.max(1,Math.round(dt/SUB));
    for(let i=0;i<n;i++)tick(dt/n);
    if(!asleep){
      if(!project(stars.length>100?12:24))project(40); // si no se resolvió, segundo intento con más iteraciones
      inflateStep(dt);
      // reposo: si nada se mueve durante un rato se detiene el motor (ahorra CPU) hasta el siguiente paso
      let mv=0;for(const b of stars){const v=b.velocity,m=Math.abs(v.x)+Math.abs(v.y)+Math.abs(b.angularVelocity)*60;if(m>mv)mv=m}
      if(stars.length&&stars.every(b=>b.isSleeping)){if(project(150))asleep=true} // solo se detiene el motor si no queda ningún solape
      else if(mv<0.06){restTime+=dt;if(restTime>0.5&&project(150))asleep=true}else restTime=0;
    }
  }
  function poses(){
    return stars.map(b=>{
      const {s,com}=b.plugin,c=Math.cos(b.angle),sn=Math.sin(b.angle),x=-com.x,y=-com.y;
      const age=t-(b.plugin.born==null?-9:b.plugin.born);
      return {id:b.plugin.id,x:b.position.x+x*c-y*sn,y:b.position.y+x*sn+y*c,a:b.angle,s,o:alpha};
    });
  }
  function wakeAll(){stars.forEach(b=>Matter.Sleeping.set(b,false))}
  function setParams(){engine.gravity.scale=0.001*P.gravity;asleep=false;restTime=0;wakeAll()}
  function reset(){memo={};plans={};job=null;ready=false;restart()}
  function setShape(sh){shape=sh;lat=null;reset()}
  function setSize(w,h){W=w;H=h;Composite.remove(world,walls);walls=makeWalls();Composite.add(world,walls);reset()}

  init();
  return {update,restart,reset,setParams,setShape,setSize,worldPoly,poses,prepareAll,
    get ready(){return ready},get progress(){return progress()},getPlans(){return JSON.parse(JSON.stringify(plans))},setPlans(o){plans=Object.assign({},o);if(!lat)lat={};ready=neededN().length===0;restart()},
    getLearn(){return JSON.parse(JSON.stringify(memo))},setLearn(o){memo=Object.assign({},o)},
    get stars(){return stars},get fill(){return stars.length?stars.length*shape.area*scale*scale/(W*H):0},get alpha(){return alpha},get scale(){return scale},get shape(){return shape},
    get time(){return t},get dbg(){return {ph:phase,si:stepIdx}},get total(){return seq().length*P.stepDur+P.hold},get W(){return W},get H(){return H}};
}

root.StarCore={createSim,buildShape,starShape,outlineFromGrid,STAR_OUTER,STAR_INNER,polyArea};
})(typeof window!=='undefined'?window:globalThis);
