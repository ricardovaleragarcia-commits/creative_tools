
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var cv=$('cv'),ctx=cv.getContext('2d');
function say(m){$('status').textContent=m}
if(!window.Matter||!window.StarCore||!window.StarExport||!window.VideoExport){say('The physics engine failed to load.');return}

var P={W:750,H:1000,gravity:1.8,bounce:0.12,friction:0.5,gap:2,shake:0,seq:'1,3,5,10',mode:'total',stepDur:2.4,hold:2.5};
var bgStyle={mode:'solid',color:'#000000',stops:[{c:'#2a2a2a',p:0},{c:'#000000',p:1}],angle:0};
var fillStyle={mode:'solid',color:'#eaeaea',stops:[{c:'#ececec',p:0},{c:'#818181',p:1}],angle:0};   // default: the solid color of the cover star
var shape=StarCore.starShape(),custom=null,playing=true,busy=false,dl=null,liveG=null;
/* ---- ajustes persistentes: se guardan en el navegador del usuario y se restauran al abrir ---- */
var STORE_KEY='shape-multiplier-settings-v1',NUM_KEYS=['gravity','bounce','friction','gap','shake','stepDur','hold'];
try{var saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');
  if(saved){
    NUM_KEYS.forEach(function(k){if(saved.P&&saved.P[k]!=null){P[k]=+saved.P[k];$(k).value=saved.P[k]}});
    if(saved.P&&saved.P.seq!=null){P.seq=saved.P.seq;$('seq').value=saved.P.seq}
    if(saved.P&&saved.P.mode){P.mode=saved.P.mode;$('mode').value=saved.P.mode}
    if(saved.fill&&saved.fillv===2)fillStyle=saved.fill;   // fills saved before the new default (no fillv) are dropped once
    if(saved.alpha!=null)$('alpha').checked=!!saved.alpha;
  }
}catch(e){}
function bgCss(st){
  if(st.mode==='solid')return st.color;
  return 'linear-gradient('+st.angle+'deg,'+st.stops.map(function(s){return s.c+' '+Math.round(s.p*100)+'%'}).join(',')+')';
}
function saveSettings(){
  if(window.setFrameBg)window.setFrameBg(bgCss(bgStyle));
  try{localStorage.setItem(STORE_KEY,JSON.stringify({
    P:{gravity:$('gravity').value,bounce:$('bounce').value,friction:$('friction').value,gap:$('gap').value,shake:$('shake').value,stepDur:$('stepDur').value,hold:$('hold').value,seq:$('seq').value,mode:$('mode').value},
    bg:bgStyle,fill:fillStyle,fillv:2,alpha:$('alpha').checked}))}catch(e){}
}

var sim=StarCore.createSim(Matter,shape,P);

function mkG(){var sh=shape;return {W:P.W,H:P.H,bg:bgStyle,fill:fillStyle,shape:{outer:sh.outer,inner:sh.inner,bw:sh.bw,bh:sh.bh,cx:sh.cx,cy:sh.cy,u:sh.u},img:custom?custom.bitmap:null}}
function G(){if(!liveG)liveG=mkG();liveG.bg=bgStyle;liveG.fill=fillStyle;return liveG}
function exportG(transparent){var g=Object.assign({},mkG());g.bg=transparent?null:bgStyle;return g}

/* ---------- fill editors (solid or gradient) ---------- */
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function cssGrad(st){return 'linear-gradient(90deg,'+st.stops.map(function(s){return s.c+' '+Math.round(s.p*100)+'%'}).join(',')+')'}
function makeEditor(root,title,st,note){
  var box=el('div','style-ed'),head=el('div','head'),ttl=el('span','',title),sel=el('select');
  [['solid','Solid'],['gradient','Gradient']].forEach(function(o){var op=el('option','',o[1]);op.value=o[0];sel.appendChild(op)});
  sel.value=st.mode;sel.setAttribute('aria-label',title+' type');head.appendChild(ttl);head.appendChild(sel);box.appendChild(head);
  var solid=el('div','row'),sc=el('input');sc.type='color';sc.value=st.color;sc.setAttribute('aria-label',title+' color');solid.appendChild(sc);box.appendChild(solid);
  var grad=el('div'),bar=el('div','gbar'),list=el('div'),add=el('button','', '+ Add stop'),angRow=el('label'),angLbl=el('span','','Angle'),ang=el('input'),angV=el('span','v');
  grad.style.display='flex';grad.style.flexDirection='column';grad.style.gap='8px';
  ang.type='range';ang.min=0;ang.max=360;ang.step=5;ang.value=st.angle;ang.setAttribute('aria-label',title+' gradient angle');
  angRow.appendChild(angLbl);angRow.appendChild(ang);angRow.appendChild(angV);
  list.style.display='flex';list.style.flexDirection='column';list.style.gap='6px';
  grad.appendChild(bar);grad.appendChild(list);grad.appendChild(add);grad.appendChild(angRow);box.appendChild(grad);
  root.appendChild(box);
  function paintList(){
    list.innerHTML='';
    st.stops.sort(function(a,b){return a.p-b.p});
    st.stops.forEach(function(s,i){
      var r=el('div','stop'),c=el('input'),p=el('input'),pc=el('span','pct',Math.round(s.p*100)+'%'),x=el('button','', '×');
      c.type='color';c.value=s.c;c.setAttribute('aria-label','Stop '+(i+1)+' color');
      p.type='range';p.min=0;p.max=100;p.step=1;p.value=Math.round(s.p*100);p.setAttribute('aria-label','Stop '+(i+1)+' position');
      x.setAttribute('aria-label','Remove stop '+(i+1));x.disabled=st.stops.length<=2;
      c.addEventListener('input',function(){s.c=c.value;bar.style.background=cssGrad(st)});
      p.addEventListener('input',function(){s.p=p.value/100;pc.textContent=p.value+'%';bar.style.background=cssGrad(st)});
      p.addEventListener('change',paintList);
      x.addEventListener('click',function(){if(st.stops.length>2){st.stops.splice(i,1);paintList()}});
      r.appendChild(c);r.appendChild(p);r.appendChild(pc);r.appendChild(x);list.appendChild(r);
    });
    add.disabled=st.stops.length>=6;bar.style.background=cssGrad(st);
  }
  add.addEventListener('click',function(){
    var s=st.stops.slice().sort(function(a,b){return a.p-b.p}),bi=0,bg=-1;
    for(var i=0;i<s.length-1;i++){var g=s[i+1].p-s[i].p;if(g>bg){bg=g;bi=i}}
    st.stops.push({c:s[bi].c,p:(s[bi].p+s[bi+1].p)/2});paintList();
  });
  function show(){var g=st.mode==='gradient';solid.classList.toggle('hidden',g);grad.classList.toggle('hidden',!g);angV.textContent=st.angle+'°'}
  sel.addEventListener('change',function(){st.mode=sel.value;show()});
  sc.addEventListener('input',function(){st.color=sc.value});
  ang.addEventListener('input',function(){st.angle=+ang.value;angV.textContent=st.angle+'°'});
  paintList();show();
}
makeEditor($('bgEd'),'Background',bgStyle);
makeEditor($('fillEd'),'Shape fill',fillStyle);

document.querySelector('.menu').addEventListener('input',saveSettings);
document.querySelector('.menu').addEventListener('change',saveSettings);

/* ---------- loop ---------- */
var last=performance.now(),fc=0;
function frame(now){
  var dt=(now-last)/1000;last=now;
  if(!busy){if(playing||!sim.ready)sim.update(dt);StarExport.drawScene(ctx,G(),sim.poses(),1);if(++fc%10===0){var n=sim.stars.length;if(!sim.ready){$('fillread').textContent='Calculating the tightest layouts… '+Math.round(sim.progress*100)+'%'}else $('fillread').textContent=n?('Current fill: '+Math.round(sim.fill*100)+'% of the frame area with '+n+' cop'+(n===1?'y':'ies')+' ('+Math.round(sim.scale/P.H*100)+'% of the frame height per shape).'):''}}
  requestAnimationFrame(frame);
}

/* ---------- controls ---------- */
var fmt={stepDur:function(v){return (+v).toFixed(2)+' s'},hold:function(v){return (+v).toFixed(1)+' s'},gravity:function(v){return '×'+(+v).toFixed(1)},
  shake:function(v){return (+v).toFixed(1)},bounce:function(v){return (+v).toFixed(2)},friction:function(v){return (+v).toFixed(2)},
  gap:function(v){return (+v).toFixed(1)+' px'}};
var restartKeys=['bounce','friction'],resetKeys=['gap'];
Object.keys(fmt).forEach(function(k){
  var e=$(k),o=$(k+'v');
  function upd(){P[k]=+e.value;o.textContent=fmt[k](e.value)}
  upd();
  e.addEventListener('input',function(){upd();if(k==='gravity')sim.setParams()});
  if(restartKeys.indexOf(k)>=0)e.addEventListener('change',function(){sim.restart()});
  if(resetKeys.indexOf(k)>=0)e.addEventListener('change',function(){sim.reset()});
});
function maxCopies(){var m=0;String($('seq').value).split(/[^0-9]+/).forEach(function(x){if(+x>m)m=+x});return m}
function updWarn(){$('perfwarn').hidden=maxCopies()<=60}
updWarn();
$('seq').addEventListener('input',updWarn);
$('seq').addEventListener('change',function(){updWarn();P.seq=$('seq').value;sim.reset()});
$('mode').addEventListener('change',function(){P.mode=$('mode').value;sim.reset()});
$('ratio').addEventListener('change',function(){
  var ab=$('ratio').value.split(':').map(Number),L=1000,a=ab[0],b=ab[1];
  var w=a>=b?L:Math.round(L*a/b),h=a>=b?Math.round(L*b/a):L;
  P.W=w;P.H=h;cv.width=w;cv.height=h;$('art').style.setProperty('--ar',w/h);liveG=null;sim.setSize(w,h);
});
$('play').onclick=function(){playing=!playing;$('play').textContent=playing?'Pause':'Play'};
$('reset').onclick=function(){sim.restart()};

/* ---------- custom shape: trace the alpha silhouette, split into convex pieces ---------- */
$('pick').onclick=function(){$('file').click()};
$('file').addEventListener('change',function(e){
  var f=e.target.files[0];e.target.value='';if(!f)return;
  var fr=new FileReader();
  fr.onload=function(){
    var im=new Image();
    im.onload=function(){
      try{
        var w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(!w||!h){w=h=512}
        var k=Math.min(1,1024/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
        var bm=document.createElement('canvas');bm.width=w;bm.height=h;bm.getContext('2d').drawImage(im,0,0,w,h);
        var sc=256/Math.max(w,h),gw=Math.max(3,Math.round(w*sc)),gh=Math.max(3,Math.round(h*sc));
        var gc=document.createElement('canvas');gc.width=gw;gc.height=gh;var gx=gc.getContext('2d');gx.drawImage(bm,0,0,gw,gh);
        var d=gx.getImageData(0,0,gw,gh).data,g=new Uint8Array(gw*gh),n=0;
        for(var i=0;i<gw*gh;i++){if(d[i*4+3]>40){g[i]=1;n++}}
        if(!n){say('That image has no visible pixels.');return}
        var outline=StarCore.outlineFromGrid(g,gw,gh,w/gw,70);
        if(!outline||outline.length<3){say('Could not trace that silhouette.');return}
        var sh=StarCore.buildShape(outline,window.decomp);
        custom={bitmap:bm};shape=sh;liveG=null;sim.setShape(sh);
        var opaque=n/(gw*gh)>0.985;
        $('shapenote').textContent='Silhouette traced: '+sh.outer.length+' vertices, '+sh.parts.length+' convex piece(s).'+(opaque?' The image is opaque (no transparency), so it collides as a rectangle.':'')+(sh.hull?' Silhouette too complex: using its convex hull.':'')+' Uploaded images keep their own colors.';
      }catch(err){say('Could not process that image.')}
    };
    im.onerror=function(){say('Could not read that image.')};
    im.src=fr.result;
  };
  fr.readAsDataURL(f);
});

/* ---------- export ---------- */
function saveFile(name,data,mime){
  var blob=data instanceof Blob?data:new Blob([data],{type:mime||'application/octet-stream'});
  return VideoExport.save(name,blob).then(function(r){say(r==='saved'?'Saved '+name:r==='declined'?'Save cancelled.':'Could not save the file.')});
}
var notes={video:'Records one full cycle at 1080 px wide, built to loop: the end cuts straight back to the start. MP4 when your browser supports it, otherwise WebM.',
  html:'A single HTML file that replays one cycle in a loop. No libraries, works offline, easy to embed.',
  lottie:'One cycle as Lottie JSON (30 fps): every shape is its own layer with position, rotation and scale keyframes. Opens in After Effects (Bodymovin), LottieFiles and others.',
  png:'The current frame at 1080 px wide.',svg:'The shape as a vector with the current fill.'};
function fmtNote(){$('fmtnote').textContent=notes[$('fmt').value]||''}
$('fmt').addEventListener('change',fmtNote);fmtNote();

function setBusy(b){busy=b;$('export').disabled=b;$('play').disabled=b;$('reset').disabled=b}
function bake(){
  return new Promise(function(res,rej){
    try{
      var bs=StarCore.createSim(Matter,shape,Object.assign({},P));if(sim.ready)bs.setPlans(sim.getPlans());else bs.prepareAll();var nF=Math.round(bs.total*60),frames=[],i=0;
      (function chunk(){
        try{
          var t0=performance.now();
          while(i<nF&&performance.now()-t0<12){bs.update(1/60);frames.push(bs.poses());i++}
          say('Rendering one cycle… '+Math.round(i/nF*100)+'%');
          if(i<nF)setTimeout(chunk,0);else res({fps:60,frames:frames});
        }catch(e){rej(e)}
      })();
    }catch(e){rej(e)}
  });
}
function bitmapURL(){return custom?custom.bitmap.toDataURL('image/png'):null}
function playVideo(bk){
  var k=1080/P.W,cw=Math.round(P.W*k/2)*2,ch=Math.round(P.H*k/2)*2,oc=document.createElement('canvas');oc.width=cw;oc.height=ch;
  var octx=oc.getContext('2d'),g=exportG(false),n=bk.frames.length;
  return VideoExport.run({canvas:oc,fps:60,period:n/60,width:cw,height:ch,status:say,
    renderAt:function(t){var i=Math.max(0,Math.min(n-1,Math.round(t*60)));StarExport.drawScene(octx,g,bk.frames[i],k)}});
}
$('export').onclick=function(){
  if(busy)return;
  var f=$('fmt').value,tr=$('alpha').checked;
  setBusy(true);
  var job;
  try{
    if(f==='png'){
      var k=1080/P.W,oc=document.createElement('canvas');oc.width=Math.round(P.W*k);oc.height=Math.round(P.H*k);
      StarExport.drawScene(oc.getContext('2d'),exportG(tr),sim.poses(),k);
      job=new Promise(function(res,rej){oc.toBlob(function(b){b?res(b):rej(new Error('Could not create the PNG'))},'image/png')}).then(function(b){return saveFile('shape-multiplier.png',b)});
    }else if(f==='svg'){
      job=saveFile(custom?'silhouette.svg':'star.svg',StarExport.buildShapeSVG(exportG(false)),'image/svg+xml');
    }else{
      job=bake().then(function(bk){
        if(f==='lottie')return saveFile('shape-multiplier.lottie.json',JSON.stringify(StarExport.buildLottie(bk,exportG(tr),bitmapURL())),'application/json');
        if(f==='html')return saveFile('shape-multiplier-animation.html',StarExport.buildPlayerHTML(bk,exportG(tr),bitmapURL()),'text/html');
        return playVideo(bk).then(function(r){return saveFile('shape-multiplier.'+r.ext,r.blob).then(function(){if(r.ext==='webm')say('Saved as WebM (MP4 is not supported by this browser).')})});
      });
    }
  }catch(e){job=Promise.reject(e)}
  job.catch(function(e){say('Export failed: '+(e&&e.message?e.message:e))}).then(function(){setBusy(false)});
};

if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){playing=false;$('play').textContent='Play'}
requestAnimationFrame(frame);
})();
