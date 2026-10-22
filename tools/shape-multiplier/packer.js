/* Empaquetador previo: calcula, antes de que aparezcan, la disposición más compacta de n copias en el marco.
   Trabaja sobre una rejilla (mapa de alturas) con rotaciones discretas; sin física. */
(function (root) {
'use strict';
const TAU=Math.PI*2;

function offsetConvex(poly,d){ // inglete; poly en cualquier orientación
  const n=poly.length;let ar=0;
  for(let i=0;i<n;i++){const q=poly[(i+1)%n];ar+=poly[i][0]*q[1]-q[0]*poly[i][1]}
  const sg=ar>0?1:-1,L=[];
  for(let i=0;i<n;i++){const a=poly[i],b=poly[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=sg*dy/l,ny=-sg*dx/l;L.push({px:a[0]+nx*d,py:a[1]+ny*d,dx,dy})}
  const out=[];
  for(let i=0;i<n;i++){const A=L[(i+n-1)%n],B=L[i],den=A.dx*B.dy-A.dy*B.dx;
    if(Math.abs(den)<1e-9){out.push([B.px,B.py]);continue}
    const t=((B.px-A.px)*B.dy-(B.py-A.py)*B.dx)/den;out.push([A.px+A.dx*t,A.py+A.dy*t])}
  return out;
}

// máscaras (una por ángulo) de la forma a escala s, dilatadas por la holgura; c = tamaño de celda en px
function makeMasks(shape,s,gap,c,A,theta0){
  const m=gap/2+0.71*c;
  const parts=shape.parts.map(p=>offsetConvex(p.map(q=>[q[0]*s,q[1]*s]),m));
  const masks=[];
  for(let k=0;k<A;k++){
    const a=theta0+k*TAU/A,ca=Math.cos(a),sa=Math.sin(a);
    const rp=parts.map(P=>P.map(q=>[q[0]*ca-q[1]*sa,q[0]*sa+q[1]*ca]));
    let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
    rp.forEach(P=>P.forEach(q=>{if(q[0]<minX)minX=q[0];if(q[0]>maxX)maxX=q[0];if(q[1]<minY)minY=q[1];if(q[1]>maxY)maxY=q[1]}));
    const w=Math.ceil((maxX-minX)/c)+1,h=Math.ceil((maxY-minY)/c)+1;
    const cMin=new Int32Array(w).fill(1e9),cMax=new Int32Array(w).fill(-1);
    for(let j=0;j<h;j++){
      const y=minY+(j+0.5)*c;
      for(let pi=0;pi<rp.length;pi++){
        const P=rp[pi];let xl=1e9,xr=-1e9;
        for(let e=0;e<P.length;e++){const p1=P[e],p2=P[(e+1)%P.length];
          if((p1[1]<=y&&p2[1]>y)||(p2[1]<=y&&p1[1]>y)){const t=(y-p1[1])/(p2[1]-p1[1]),x=p1[0]+t*(p2[0]-p1[0]);if(x<xl)xl=x;if(x>xr)xr=x}}
        if(xl>xr)continue;
        let i0=Math.max(0,Math.ceil((xl-minX)/c-0.5)),i1=Math.min(w-1,Math.floor((xr-minX)/c-0.5));
        for(let i=i0;i<=i1;i++){if(j<cMin[i])cMin[i]=j;if(j>cMax[i])cMax[i]=j}
      }
    }
    const occ=[],lo=new Int32Array(w),hi=new Int32Array(w);let hiMax=0;
    for(let i=0;i<w;i++){if(cMax[i]>=0){occ.push(i);lo[i]=h-1-cMax[i];hi[i]=h-1-cMin[i];if(hi[i]>hiMax)hiMax=hi[i]}}
    masks.push({a,minX,minY,w,h,occ:Int32Array.from(occ),lo,hi,hiMax});
  }
  return masks;
}

// coloca n copias con el heurístico de menor hueco; devuelve [{x,y,a}] (origen de la forma en px) o null
function packOnce(masks,n,W,H,c,rnd,wTop){
  const Wc=Math.floor(W/c),Hc=Math.floor(H/c),top=new Int32Array(Wc),items=[];
  for(let k=0;k<n;k++){
    let best=null;
    for(let mi=0;mi<masks.length;mi++){
      const M=masks[mi],occ=M.occ,no=occ.length;
      for(let x=0;x+M.w<=Wc;x++){
        let y0=0;
        for(let q=0;q<no;q++){const i=occ[q],v=top[x+i]-M.lo[i];if(v>y0)y0=v}
        if(y0+M.hiMax+1>Hc)continue;
        let waste=0;
        for(let q=0;q<no;q++){const i=occ[q];waste+=y0+M.lo[i]-top[x+i]}
        const score=waste+wTop*(y0+M.hiMax)+rnd()*0.5;
        if(!best||score<best.score)best={score,M,x,y0};
      }
    }
    if(!best)return null;
    const {M,x,y0}=best;
    for(let q=0;q<M.occ.length;q++){const i=M.occ[q],v=y0+M.hi[i]+1;if(v>top[x+i])top[x+i]=v}
    const bottomPx=H-y0*c,topPx=bottomPx-M.h*c;
    items.push({x:x*c-M.minX,y:topPx-M.minY,a:M.a});
  }
  return items;
}

function pointsOverlap(){return false}

root.StarPlanner={offsetConvex,makeMasks,packOnce};
})(typeof window!=='undefined'?window:globalThis);

/* ======== Empaquetado en retícula (formas alineadas que encajan punta con hueco) ======== */
(function (root) {
'use strict';
const TAU=Math.PI*2;
const OC=StarPlanner.offsetConvex;

function satOverlap(A,B){ // convexos; true si se solapan con profundidad > 0
  for(const P of [A,B]){
    for(let i=0;i<P.length;i++){
      const a=P[i],b=P[(i+1)%P.length];let nx=b[1]-a[1],ny=a[0]-b[0];const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
      let a0=1e18,a1=-1e18,b0=1e18,b1=-1e18;
      for(const q of A){const d=q[0]*nx+q[1]*ny;if(d<a0)a0=d;if(d>a1)a1=d}
      for(const q of B){const d=q[0]*nx+q[1]*ny;if(d<b0)b0=d;if(d>b1)b1=d}
      if(Math.min(a1,b1)-Math.max(a0,b0)<=1e-9)return false;
    }
  }
  return true;
}
function partsOverlap(PA,PB,vx,vy){ // PB trasladado (vx,vy)
  for(const A of PA){
    for(const B0 of PB){
      const B=B0.map(q=>[q[0]+vx,q[1]+vy]);
      if(satOverlap(A,B))return true;
    }
  }
  return false;
}

// Retícula más densa (traslaciones) de la forma en coordenadas unitarias, sin holgura. Cacheable por forma.
function* latticeGen(shape){
  const parts=shape.parts,NA=24,NB=48,ds=0.006,R=1.5;
  const ov=(x,y)=>partsOverlap(parts,parts,x,y);
  // distancia mínima por dirección: se sube hasta que ni ese punto ni sus vecinos inmediatos solapan
  const D=[];
  for(let k=0;k<NA;k++){
    const t=k*Math.PI/NA,dx=Math.cos(t),dy=Math.sin(t);let last=0;
    for(let d=ds;d<R;d+=ds){if(ov(dx*d,dy*d))last=d}
    let d=last+ds;while(d<R&&(ov(dx*d,dy*d)||ov(dx*(d+ds*0.5),dy*(d+ds*0.5))))d+=ds*0.5;
    D.push(d);yield;
  }
  let best=null;
  for(let k1=0;k1<NA;k1++){
    yield;
    const t1=k1*Math.PI/NA,v1=[Math.cos(t1)*D[k1],Math.sin(t1)*D[k1]];
    for(let k2=0;k2<NB;k2++){
      const tt=k2*Math.PI/NB,dx=Math.cos(tt),dy=Math.sin(tt);
      if(Math.abs(Math.sin(tt-t1))<0.2)continue;
      let d=D[Math.round(tt/(Math.PI/NA))%NA]*0.8,v2=null;
      for(let it=0;it<140;it++){
        const c=[dx*d,dy*d];
        if(!ov(c[0],c[1])&&!ov(c[0]-v1[0],c[1]-v1[1])&&!ov(c[0]+v1[0],c[1]+v1[1])&&!ov(2*c[0]-v1[0],2*c[1]-v1[1])&&!ov(2*c[0]+v1[0],2*c[1]+v1[1])){v2=c;break}
        d+=ds;
      }
      if(!v2)continue;
      const cell=Math.abs(v1[0]*v2[1]-v1[1]*v2[0]);
      if(!best||cell<best.cell){
        // verificación final con todos los vecinos próximos de la retícula
        let good=true;
        for(let i=-2;i<=2&&good;i++)for(let j=-2;j<=2;j++){if(!i&&!j)continue;if(ov(i*v1[0]+j*v2[0],i*v1[1]+j*v2[1])){good=false;break}}
        if(good)best={cell,v1,v2};
      }
    }
  }
  best.density=shape.area/best.cell;
  return best;
}
function runSync(g){let r;do{r=g.next()}while(!r.done);return r.value}
function latticeFor(shape){return runSync(latticeGen(shape))}

root.StarLattice={latticeFor,latticeGen,runSync,partsOverlap,satOverlap};
})(typeof window!=='undefined'?window:globalThis);

/* ======== Plan de n copias sobre la retícula ======== */
(function (root) {
'use strict';
const TAU=Math.PI*2,OC=StarPlanner.offsetConvex,{partsOverlap}=StarLattice;

function evalScale(shape,lat,s,n,W,H,gap,NPHI,NOFF,coll){
  const hOff=gap/2+0.5;
  const hp=shape.parts.map(p=>OC(p.map(q=>[q[0]*s,q[1]*s]),hOff));
  const a0=[lat.v1[0]*s,lat.v1[1]*s],b0=[lat.v2[0]*s,lat.v2[1]*s];
  const rel=[];for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){if(i||j)rel.push([i,j])}
  const bad=k=>{for(const r of rel){if(partsOverlap(hp,hp,(r[0]*a0[0]+r[1]*b0[0])*k,(r[0]*a0[1]+r[1]*b0[1])*k))return true}return false};
  if(bad(1.35))return null;
  let lo=1,hi=1.35;if(!bad(1))hi=1;else for(let it=0;it<9;it++){const m=(lo+hi)/2;if(bad(m))lo=m;else hi=m}
  const k=hi,ax=a0[0]*k,ay=a0[1]*k,bx=b0[0]*k,by=b0[1]*k;
  const minL=Math.min(Math.hypot(ax,ay),Math.hypot(bx,by)),I=Math.ceil((W+H)/minL)+2;
  let best=null;
  for(let pi=0;pi<NPHI;pi++){
    const phi=pi*TAU/NPHI,c=Math.cos(phi),sn=Math.sin(phi);
    let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
    hp.forEach(P=>P.forEach(q=>{const x=q[0]*c-q[1]*sn,y=q[0]*sn+q[1]*c;if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y}));
    if(mxx-mnx>W||mxy-mny>H)continue;
    const Ax=ax*c-ay*sn,Ay=ax*sn+ay*c,Bx=bx*c-by*sn,By=bx*sn+by*c;
    for(let u=0;u<NOFF;u++)for(let w=0;w<NOFF;w++){
      const fu=u/NOFF,fw=w/NOFF,bx0=W/2+fu*Ax+fw*Bx,by0=H/2+fu*Ay+fw*By;
      const pts=[];
      for(let i=-I;i<=I;i++)for(let j=-I;j<=I;j++){
        const x=bx0+i*Ax+j*Bx,y=by0+i*Ay+j*By;
        if(x+mnx>=0&&x+mxx<=W&&y+mny>=0&&y+mxy<=H)pts.push([x,y]);
      }
      if(!best||pts.length>best.pts.length)best={pts,phi,mnx,mxx,mny,mxy};
      if(coll&&pts.length>=n){ // muestreo (reservorio) de las disposiciones válidas, para poder variar
        coll.seen=(coll.seen||0)+1;const cand={pts,phi,mnx,mxx,mny,mxy};
        if(coll.length<24)coll.push(cand);else{const j=Math.floor(Math.random()*coll.seen);if(j<24)coll[j]=cand}
      }
    }
  }
  return best;
}

function* planGen(shape,lat,n,W,H,gap,opts){
  opts=opts||{};const NPHI=opts.nphi||72,NOFF=opts.noff||7;
  const hiB=Math.sqrt(W*H/(n*shape.area));
  let lo=hiB*0.1,hi=hiB,bestS=0,bestR=null;
  const tryS=s=>{const r=evalScale(shape,lat,s,n,W,H,gap,NPHI,NOFF);if(r&&r.pts.length>=n){if(s>bestS){bestS=s;bestR=r}return true}return false};
  for(let it=0;it<13;it++){const m=(lo+hi)/2;if(tryS(m))lo=m;else hi=m;yield}
  // el recuento no es monótono: se prueban tamaños algo mayores
  for(let q=1;q<=12;q++){const s=bestS*(1+q*0.004);if(s<=hiB)tryS(s);yield}
  if(!bestR)return null;
  // variantes: a tamaños algo menores (2 %, 4 %, 7 %) hay muchísimas combinaciones válidas de ángulo y desplazamiento
  const variants=[{s:bestS,f:0,phi:bestR.phi,pts:bestR.pts,mnx:bestR.mnx,mxx:bestR.mxx,mny:bestR.mny,mxy:bestR.mxy}];
  for(const f of [0,0.02,0.04,0.07]){
    const coll=[],sL=bestS*(1-f);
    evalScale(shape,lat,sL,n,W,H,gap,NPHI,NOFF,coll);
    coll.forEach(c=>variants.push({s:sL,f,phi:c.phi,pts:c.pts,mnx:c.mnx,mxx:c.mxx,mny:c.mny,mxy:c.mxy}));
    yield;
  }
  return {s:bestS,variants};
}
// elige n posiciones de una variante con algo de azar, la pega al suelo y la desplaza al azar en horizontal
function layoutFrom(v,n,W,H,rnd){
  const rowH=Math.max(1,(v.mxy-v.mny)*0.45);
  const keyed=v.pts.map(p=>({p,k:p[1]+(rnd()-0.5)*rowH*0.8}));
  keyed.sort((a,b)=>b.k-a.k);
  const pts=keyed.slice(0,n).map(o=>o.p);
  let bot=-1e9,left=1e9,right=-1e9;
  pts.forEach(p=>{bot=Math.max(bot,p[1]+v.mxy);left=Math.min(left,p[0]+v.mnx);right=Math.max(right,p[0]+v.mxx)});
  const dy=H-bot,slack=Math.max(0,W-(right-left)),dx=rnd()*slack-left;
  return pts.map(p=>({x:p[0]+dx,y:p[1]+dy,a:v.phi}));
}
function planLattice(shape,lat,n,W,H,gap,opts){const pl=StarLattice.runSync(planGen(shape,lat,n,W,H,gap,opts));if(!pl)return null;const v=pl.variants[0];return {s:pl.s,phi:v.phi,items:layoutFrom(v,n,W,H,Math.random),variants:pl.variants}}
root.StarLattice.planGen=planGen;root.StarLattice.layoutFrom=layoutFrom;
root.StarLattice.planLattice=planLattice;
})(typeof window!=='undefined'?window:globalThis);
