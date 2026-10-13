/* Humano ↔ IA: o retrato se desfaz em partículas e se reconstrói, em loop contínuo. */
(()=>{
 'use strict';
 const root=document.querySelector('[data-evo-morph]')||document.querySelector('#editor-evolution');
 if(!root)return;
 const canvas=root.querySelector('canvas');
 const section=root.closest('section')||root;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');

 // Entrada suave dos textos da seção (só quando há movimento).
 const lines=section.querySelectorAll('.evo-reveal');
 if(lines.length&&'IntersectionObserver' in window&&!reduce.matches){
  section.classList.add('evo-js');
  const reveal=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){reveal.disconnect();section.classList.add('evo-in')}},{rootMargin:'0px 0px -12% 0px'});
  reveal.observe(section);
 }

 if(!canvas)return;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx){canvas.style.display='none';return}
 root.querySelectorAll('[data-evolution-toggle],[data-evolution-replay]').forEach(el=>{el.hidden=true});

 // 4 s de transformação, pausa curta em cada estado.
 const HOLD=1600,MORPH=4000,CYCLE=2*(HOLD+MORPH),START=HOLD-900;
 // SETTLE: a peça assenta com 80% do trajeto, então a última termina junto com os 4 s.
 const SPAN=.42,REACH=.9,SETTLE=.8,BG='#0b0b0b';
 const small=matchMedia('(max-width: 760px)');
 const clamp=(n,a=0,b=1)=>n<a?a:n>b?b:n;
 const smooth=x=>x*x*(3-2*x);
 const glide=x=>.9*x+.1*(1-Math.cos(Math.PI*x))/2;
 // A varredura se concentra na figura (faixa central do quadro): rosto e tronco
 // levam os 4 s inteiros; as bordas escuras passam rápido, mas na mesma ordem.
 const FIG=.3,FIGW=.4,EDGE=.12;
 const sweep=nx=>(1-EDGE)*clamp((nx-FIG)/FIGW)+EDGE*nx;
 // Posição da luz: inverso linear da varredura, contínuo também fora da figura.
 const lightX=v=>(v+(1-EDGE)*FIG/FIGW)/((1-EDGE)/FIGW+EDGE);

 let W=0,H=0,tiles=[],human=null,robot=null,ready=false,variant='',token=0;
 const ease={fwd:{to:v=>v/.9,from:u=>u*.9},back:{to:v=>v/.9,from:u=>u*.9}};
 let clock=START,last=null,raf=0,timer=0,running=false,inView=false,drawn='',cost=0,lastDraw=0;

 const cache=new Map();
 function loadImage(src){
  if(!cache.has(src))cache.set(src,new Promise((res,rej)=>{const im=new Image();im.decoding='async';im.onload=()=>res(im);im.onerror=rej;im.src=src}));
  return cache.get(src);
 }
 function sources(){const d=root.dataset;return small.matches&&d.humanSm&&d.robotSm?[d.humanSm,d.robotSm]:[d.human,d.robot]}
 function measure(){
  const box=canvas.getBoundingClientRect();
  const cssW=box.width||root.clientWidth||560,ratio=box.width&&box.height?box.height/box.width:1.25;
  const w=Math.max(320,Math.min(1120,Math.round(cssW*Math.min(window.devicePixelRatio||1,2))));
  return{w,h:Math.round(w*ratio)};
 }
 function raster(img){
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d');x.fillStyle=BG;x.fillRect(0,0,W,H);x.imageSmoothingQuality='high';
  const s=Math.max(W/img.naturalWidth,H/img.naturalHeight),iw=img.naturalWidth*s,ih=img.naturalHeight*s;
  x.drawImage(img,(W-iw)/2,(H-ih)/2,iw,ih);return c;
 }
 function pixels(c){try{return c.getContext('2d').getImageData(0,0,W,H).data}catch{return null}}
 function buildTiles(){
  const cell=Math.max(8,Math.round(W/42)),hd=pixels(human),rd=pixels(robot);
  let seed=76;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const at=(px,py)=>(Math.min(py,H-1)*W+Math.min(px,W-1))*4;
  const lit=(d,x,y,w,h)=>{if(!d)return true;const i=at(x+(w>>1),y+(h>>1));return Math.max(d[i],d[i+1],d[i+2])>44};
  // Peso da peça: quanto o humano e o robô diferem nela (fundo escuro pesa zero).
  const weight=(x,y,w,h)=>{if(!hd||!rd)return 1;let s=0;
   for(const[a,b]of[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const i=at(x+(w*a|0),y+(h*b|0));s+=Math.max(0,Math.abs(hd[i]-rd[i])+Math.abs(hd[i+1]-rd[i+1])+Math.abs(hd[i+2]-rd[i+2])-40)}
   return s};
  tiles=[];
  for(let y=0;y<H;y+=cell)for(let x=0;x<W;x+=cell){
   const w=Math.min(cell,W-x),h=Math.min(cell,H-y);
   const cx=(x+w/2)/W,ny=(y+h/2)/H,jit=rnd()*.12;
   tiles.push({x,y,w,h,fwd:sweep(cx)*.6+ny*.18+jit,back:sweep(1-cx)*.6+ny*.18+jit,dx:(.08+rnd()*.3)*W,dy:(rnd()-.62)*.36*H,turn:(rnd()-.5)*3.2,size:.55+rnd()*.6,hb:lit(hd,x,y,w,h),rb:lit(rd,x,y,w,h),wt:weight(x,y,w,h)});
  }
  // O relógio segue a figura: os 4 s são repartidos pelo quanto cada trecho muda.
  // O rosto ganha tempo; o fundo escuro passa depressa, sempre na mesma ordem.
  for(const key of ['fwd','back']){
   const c=curve(key);ease[key]=c;
   for(const t of tiles)t[key]=clamp(c.to(t[key]))*REACH;
  }
 }
 // Mapa monótono valor bruto → 0..1 (e o inverso), pela massa acumulada de diferença.
 function curve(key){
  const pts=tiles.filter(t=>t.wt>0).sort((a,b)=>a[key]-b[key]),n=pts.length;
  if(n<16)return{to:v=>v/.9,from:u=>u*.9};
  const xs=new Float64Array(n),ys=new Float64Array(n);let acc=0;
  pts.forEach((t,i)=>{xs[i]=t[key];ys[i]=acc+t.wt/2;acc+=t.wt});
  const y0=ys[0],y1=ys[n-1];for(let i=0;i<n;i++)ys[i]=(ys[i]-y0)/(y1-y0);
  const map=(A,B,v)=>{
   const slope=(B[n-1]-B[0])/((A[n-1]-A[0])||1);
   if(v<=A[0])return B[0]+(v-A[0])*slope;
   if(v>=A[n-1])return B[n-1]+(v-A[n-1])*slope;
   let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;A[m]<=v?lo=m:hi=m}
   const d=A[hi]-A[lo];return d>0?B[lo]+(B[hi]-B[lo])*(v-A[lo])/d:B[lo];
  };
  return{to:v=>map(xs,ys,v),from:u=>map(ys,xs,u)};
 }
 async function prepare(){
  const my=++token,[hs,rs]=sources(),{w,h}=measure(),key=`${hs}|${w}x${h}`;
  if(key===variant)return;
  try{
   const[hi,ri]=await Promise.all([loadImage(hs),loadImage(rs)]);
   if(my!==token)return;
   W=w;H=h;canvas.width=W;canvas.height=H;human=raster(hi);robot=raster(ri);buildTiles();
   variant=key;ready=true;drawn='';render(true);
   root.classList.add('evo-ready','is-ready');play();
  }catch{if(my===token&&!ready){root.classList.add('evo-failed');canvas.style.display='none'}}
 }

 function stateAt(t){
  const m=((t%CYCLE)+CYCLE)%CYCLE;
  if(m<HOLD)return{name:'human',left:HOLD-m};
  if(m<HOLD+MORPH)return{name:'to-robot',k:(m-HOLD)/MORPH};
  if(m<2*HOLD+MORPH)return{name:'robot',left:2*HOLD+MORPH-m};
  return{name:'to-human',k:(m-2*HOLD-MORPH)/MORPH};
 }
 function drawMorph(k,forward,particles=true){
  const from=forward?human:robot,to=forward?robot:human,p=glide(k)*(REACH+SPAN*SETTLE),flying=[];
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.drawImage(from,0,0);ctx.fillStyle=BG;
  for(const t of tiles){
   const d=(p-(forward?t.fwd:t.back))/SPAN;
   if(d<=0)continue;
   if(d>=SETTLE){ctx.globalAlpha=1;ctx.drawImage(to,t.x,t.y,t.w,t.h,t.x,t.y,t.w,t.h);continue}
   ctx.globalAlpha=1;ctx.fillRect(t.x,t.y,t.w,t.h);
   const a=smooth(clamp((d-.12)/.63));
   if(a>0){ctx.globalAlpha=a;ctx.drawImage(to,t.x,t.y,t.w,t.h,t.x,t.y,t.w,t.h)}
   if(particles&&(forward?t.hb:t.rb))flying.push(t,d);
  }
  // A luz da varredura acompanha a frente da transformação.
  const glow=Math.sin(Math.PI*clamp(k*1.1-.03)),front=ease[forward?'fwd':'back'].from((p-SPAN*.3)/REACH)-.06;
  if(glow>.01){
   const at=ny=>{const nx=lightX((front-.18*ny)/.6);return(forward?nx:1-nx)*W};
   const x0=at(0),x1=at(1),mx=(x0+x1)/2,dxl=x1-x0,len=Math.hypot(dxl,H),nx=H/len,ny=-dxl/len,band=W*.08;
   const g=ctx.createLinearGradient(mx-nx*band,H/2-ny*band,mx+nx*band,H/2+ny*band);
   g.addColorStop(0,'rgba(189,255,89,0)');g.addColorStop(.42,'rgba(189,255,89,.22)');g.addColorStop(.5,'rgba(242,255,222,.34)');g.addColorStop(.58,'rgba(189,255,89,.22)');g.addColorStop(1,'rgba(189,255,89,0)');
   ctx.globalCompositeOperation='lighter';ctx.globalAlpha=glow;ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  const dir=forward?1:-1;
  for(let i=0;i<flying.length;i+=2){
   const t=flying[i],d=flying[i+1],go=1-(1-d)*(1-d),alpha=clamp((SETTLE-d)*1.8);
   const cx=t.x+t.w/2+dir*t.dx*go,cy=t.y+t.h/2+t.dy*go,s=t.size*(1-.8*d),r=t.turn*d*dir,cos=Math.cos(r)*s,sin=Math.sin(r)*s;
   ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha;
   ctx.setTransform(cos,sin,-sin,cos,cx,cy);
   ctx.drawImage(from,t.x,t.y,t.w,t.h,-t.w/2,-t.h/2,t.w,t.h);
   if(d>.2&&d<SETTLE-.08){
    ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha*.85;
    ctx.fillStyle=d>.5?'#e2ffb6':'#a3ff00';const q=Math.max(2,W/300);ctx.fillRect(cx-dir*t.w*.7,cy,q,q);
   }
  }
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 }
 function setState(name){if(root.dataset.state!==name){root.dataset.state=name;section.dataset.evoState=name}}
 function render(force){
  if(!ready)return null;
  if(reduce.matches){
   // Sem movimento: um quadro fixo no meio da transformação (humano virando IA).
   if(force||drawn!=='still'){drawMorph(.5,true);drawn='still'}
   setState('still');return null;
  }
  const s=stateAt(clock);
  if(s.left!==undefined){if(force||drawn!==s.name){ctx.drawImage(s.name==='human'?human:robot,0,0);drawn=s.name}}
  else{drawMorph(s.k,s.name==='to-robot');drawn=''}
  setState(s.name);return s;
 }
 function tick(now){
  raf=0;if(!running)return;
  if(last!==null)clock+=Math.min(now-last,64);
  last=now;
  // Aparelho lento: desenha a ~30 quadros por segundo, sem alterar a duração.
  if(cost>12&&now-lastDraw<30&&stateAt(clock).left===undefined){raf=requestAnimationFrame(tick);return}
  const t0=performance.now(),s=render(false);
  if(s&&s.left===undefined){cost=cost*.8+(performance.now()-t0)*.2;lastDraw=now}
  if(s&&s.left!==undefined){
   // Estado parado: nada a desenhar até a próxima transformação.
   const target=clock+s.left;last=null;
   timer=setTimeout(()=>{timer=0;clock=target;if(running)raf=requestAnimationFrame(tick)},s.left);
   return;
  }
  raf=requestAnimationFrame(tick);
 }
 function play(){if(running||!ready||!inView||document.hidden||reduce.matches)return;running=true;last=null;raf=requestAnimationFrame(tick)}
 function stop(){running=false;if(raf)cancelAnimationFrame(raf);if(timer)clearTimeout(timer);raf=timer=0;last=null}

 document.addEventListener('visibilitychange',()=>document.hidden?stop():play());
 // addListener cobre Safari antigo (anterior ao 14).
 const onChange=(mq,fn)=>mq.addEventListener?mq.addEventListener('change',fn):mq.addListener&&mq.addListener(fn);
 onChange(reduce,()=>{stop();render(true);play()});
 onChange(small,()=>{if(ready)prepare()});
 let resizeTimer=0;
 addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!ready)return;const{w}=measure();if(Math.abs(w-W)/W>.12)prepare()},250)},{passive:true});

 // Observa o próprio retrato: no celular a seção é bem mais alta que a tela.
 if('IntersectionObserver' in window){
  new IntersectionObserver(entries=>{const e=entries[entries.length-1];inView=e.isIntersecting&&e.intersectionRatio>=.35;inView?play():stop()},{threshold:[0,.35,.6]}).observe(root);
  const loader=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loader.disconnect();prepare()}},{rootMargin:'700px 0px'});
  loader.observe(root);
 }else{inView=true;prepare()}
})();
