// ================= Estado =================
const PX = 300; // dpi
const SIZES = { "4x6":[4,6], "6x8":[6,8], "8x10":[8,10], "8x12":[8,12] };
const state = {
  frame:null, hasAlpha:false, photo:null, logo:null,
  zone:{x:.25,y:.25,w:.5,h:.5},
  bright:0, contrast:0, gray:false, bw:false, bwth:128,
  text:"", font:"Poppins", tsize:6, tcolor:"#ffffff", textPos:{x:.5,y:.9},
  logoWidth:.25, logoPos:{x:.5,y:.2},
};
let adjustedPhoto = null; // canvas con ajustes aplicados
const sessionGallery = [];

const view = document.getElementById('view');
const vctx = view.getContext('2d');

// ================= Utilidades =================
function $(id){ return document.getElementById(id); }
function setStatus(t){ $('status').textContent = t; }
function targetSize(){
  const [a,b] = SIZES[$('size').value];
  const short=a*PX, long=b*PX;
  return $('orient').value==='v' ? [short,long] : [long,short];
}
function loadImageFromFile(file, cb){
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = ()=>cb(img); img.src = r.result; };
  r.readAsDataURL(file);
}
function imageToCanvas(img){
  const c=document.createElement('canvas'); c.width=img.width||img.naturalWidth;
  c.height=img.height||img.naturalHeight; c.getContext('2d').drawImage(img,0,0); return c;
}
// Detecta zona transparente (bounding box de píxeles con alfa bajo)
function detectAlpha(img){
  const c=imageToCanvas(img); const w=c.width,h=c.height;
  const d=c.getContext('2d').getImageData(0,0,w,h).data;
  let minX=w,minY=h,maxX=-1,maxY=-1, found=false;
  for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]<32){
    found=true; if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; } } }
  if(!found) return null;
  return {x:minX/w, y:minY/h, w:(maxX-minX+1)/w, h:(maxY-minY+1)/h};
}

// ================= Ajustes de foto =================
function rebuildAdjusted(){
  if(!state.photo){ adjustedPhoto=null; return; }
  const img = state.photo;
  const w=img.width||img.naturalWidth, h=img.height||img.naturalHeight;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d');
  const b = 1 + state.bright/100;
  const k = 1 + state.contrast/100;
  ctx.filter = `brightness(${b}) contrast(${k})` + (state.gray||state.bw ? ' grayscale(100%)' : '');
  ctx.drawImage(img,0,0,w,h);
  ctx.filter='none';
  if(state.bw){
    const id=ctx.getImageData(0,0,w,h); const dd=id.data;
    for(let i=0;i<dd.length;i+=4){ const v = dd[i] >= state.bwth ? 255 : 0; dd[i]=dd[i+1]=dd[i+2]=v; }
    ctx.putImageData(id,0,0);
  }
  adjustedPhoto=c;
}

// ================= Composición =================
function compose(ctx, W, H, preview){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
  ctx.imageSmoothingQuality='high';
  const z = {x:state.zone.x*W, y:state.zone.y*H, w:state.zone.w*W, h:state.zone.h*H};

  function drawPhoto(){
    if(!adjustedPhoto || z.w<=0 || z.h<=0) return;
    const p=adjustedPhoto;
    const s=Math.max(z.w/p.width, z.h/p.height);
    const pw=p.width*s, ph=p.height*s;
    const px=z.x+(z.w-pw)/2, py=z.y+(z.h-ph)/2;
    ctx.save(); ctx.beginPath(); ctx.rect(z.x,z.y,z.w,z.h); ctx.clip();
    ctx.drawImage(p, px,py,pw,ph); ctx.restore();
  }
  if(state.frame && state.hasAlpha){ drawPhoto(); ctx.drawImage(state.frame,0,0,W,H); }
  else { if(state.frame) ctx.drawImage(state.frame,0,0,W,H); drawPhoto(); }

  // logo
  if(state.logo){
    const lw=state.logoWidth*W;
    const lh=lw*(state.logo.height||state.logo.naturalHeight)/(state.logo.width||state.logo.naturalWidth);
    ctx.drawImage(state.logo, state.logoPos.x*W-lw/2, state.logoPos.y*H-lh/2, lw, lh);
  }
  // texto
  if(state.text){
    const fs=Math.max(8, state.tsize/100*H);
    ctx.font=`bold ${fs}px '${state.font}', sans-serif`;
    ctx.fillStyle=state.tcolor; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(state.text, state.textPos.x*W, state.textPos.y*H);
  }
  // marca de agua DEMO (cuando la licencia es de demostración)
  if(window.__DEMO__){
    ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(-Math.PI/6);
    ctx.font=`bold ${Math.max(24,H/8)}px sans-serif`;
    ctx.fillStyle='rgba(255,0,0,0.5)'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('DEMO', 0, 0); ctx.restore();
  }
  // overlays de edición solo en la vista
  if(preview) drawOverlays(ctx,W,H,z);
}

function drawOverlays(ctx,W,H,z){
  const editable = state.frame && !state.hasAlpha;
  if(editable){
    ctx.strokeStyle=getAccent(); ctx.lineWidth=2; ctx.setLineDash([6,4]);
    ctx.strokeRect(z.x,z.y,z.w,z.h); ctx.setLineDash([]);
    ctx.fillStyle=getAccent();
    handlePts(z).forEach(p=>ctx.fillRect(p.x-5,p.y-5,10,10));
  }
}
function handlePts(z){ return [
  {x:z.x,y:z.y},{x:z.x+z.w/2,y:z.y},{x:z.x+z.w,y:z.y},
  {x:z.x+z.w,y:z.y+z.h/2},{x:z.x+z.w,y:z.y+z.h},
  {x:z.x+z.w/2,y:z.y+z.h},{x:z.x,y:z.y+z.h},{x:z.x,y:z.y+z.h/2} ]; }

function getAccent(){ return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#1BA1E2'; }

// ================= Render de la vista =================
function fitView(){
  const [tw,th]=targetSize();
  const stage=document.querySelector('.stage');
  const maxW=stage.clientWidth-24, maxH=stage.clientHeight-24;
  let w=maxW, h=w*th/tw; if(h>maxH){ h=maxH; w=h*tw/th; }
  const dpr=window.devicePixelRatio||1;
  view.width=Math.round(w*dpr); view.height=Math.round(h*dpr);
  view.style.width=w+'px'; view.style.height=h+'px';
  render();
}
function render(){ compose(vctx, view.width, view.height, true); }

// ================= Interacción (arrastrar) =================
let drag=null;
function viewToNorm(ev){
  const r=view.getBoundingClientRect();
  return { x:(ev.clientX-r.left)/r.width, y:(ev.clientY-r.top)/r.height };
}
function textBox(){
  if(!state.text) return null;
  const W=view.width,H=view.height;
  const fs=Math.max(8,state.tsize/100*H);
  vctx.font=`bold ${fs}px '${state.font}'`;
  const m=vctx.measureText(state.text);
  const w=m.width, h=fs*1.3;
  const cx=state.textPos.x*W, cy=state.textPos.y*H;
  return {x:cx-w/2,y:cy-h/2,w,h,W,H};
}
function logoBox(){
  if(!state.logo) return null;
  const W=view.width,H=view.height;
  const lw=state.logoWidth*W, lh=lw*(state.logo.height)/(state.logo.width);
  const cx=state.logoPos.x*W, cy=state.logoPos.y*H;
  return {x:cx-lw/2,y:cy-lh/2,w:lw,h:lh};
}
function hitHandle(nx,ny){
  if(!(state.frame && !state.hasAlpha)) return null;
  const W=view.width,H=view.height;
  const z={x:state.zone.x*W,y:state.zone.y*H,w:state.zone.w*W,h:state.zone.h*H};
  const px=nx*W, py=ny*H; const names=['tl','t','tr','r','br','b','bl','l'];
  const pts=handlePts(z);
  for(let i=0;i<pts.length;i++){ if(Math.abs(px-pts[i].x)<10 && Math.abs(py-pts[i].y)<10) return names[i]; }
  if(px>z.x&&px<z.x+z.w&&py>z.y&&py<z.y+z.h) return 'move';
  return null;
}
view.addEventListener('mousedown', e=>{
  const n=viewToNorm(e); const W=view.width,H=view.height; const px=n.x*W, py=n.y*H;
  const tb=textBox(); if(tb && px>tb.x&&px<tb.x+tb.w&&py>tb.y&&py<tb.y+tb.h){ drag={type:'text'}; return; }
  const lb=logoBox(); if(lb && px>lb.x&&px<lb.x+lb.w&&py>lb.y&&py<lb.y+lb.h){ drag={type:'logo'}; return; }
  const h=hitHandle(n.x,n.y); if(h){ drag={type:'zone',handle:h,last:n}; }
});
window.addEventListener('mousemove', e=>{
  if(!drag) return;
  const n=viewToNorm(e);
  if(drag.type==='text'){ state.textPos={x:clamp(n.x),y:clamp(n.y)}; render(); return; }
  if(drag.type==='logo'){ state.logoPos={x:clamp(n.x),y:clamp(n.y)}; render(); return; }
  if(drag.type==='zone'){
    let z={...state.zone}; const dx=n.x-drag.last.x, dy=n.y-drag.last.y; drag.last=n;
    const H=drag.handle;
    if(H==='move'){ z.x+=dx; z.y+=dy; }
    else {
      if(H.includes('l')){ z.x+=dx; z.w-=dx; }
      if(H.includes('r')){ z.w+=dx; }
      if(H.includes('t')){ z.y+=dy; z.h-=dy; }
      if(H.includes('b')){ z.h+=dy; }
    }
    if(z.w<0.05)z.w=0.05; if(z.h<0.05)z.h=0.05;
    if($('square').checked && H!=='move'){ const [tw,th]=targetSize(); const ar=tw/th;
      z.h=z.w*ar; } // cuadrado en px de salida
    z.x=Math.max(0,Math.min(z.x,1-z.w)); z.y=Math.max(0,Math.min(z.y,1-z.h));
    state.zone=z; render();
  }
});
window.addEventListener('mouseup',()=>drag=null);
function clamp(v){ return Math.max(0,Math.min(1,v)); }

// ================= Exportar / Imprimir =================
function renderFinal(){
  const [tw,th]=targetSize();
  const c=document.createElement('canvas'); c.width=tw; c.height=th;
  compose(c.getContext('2d'), tw, th, false);
  return c;
}
function eventName(){ return ($('event').value.trim()||'SinEvento').replace(/[\\/:*?"<>|]/g,'_'); }
function downloadPhoto(){
  if(!state.frame){ alert('Primero carga un marco.'); return; }
  const c=renderFinal(); const url=c.toDataURL('image/png');
  const a=document.createElement('a');
  a.href=url; a.download=`ArtefGoFrames_${eventName()}_${stamp()}.png`; a.click();
  addToGallery(url);
  setStatus('Foto descargada.');
}
function printPhoto(){
  if(!state.frame){ alert('Primero carga un marco.'); return; }
  const c=renderFinal(); const url=c.toDataURL('image/png');
  const [a,b]=SIZES[$('size').value];
  const wIn = $('orient').value==='v'?a:b, hIn=$('orient').value==='v'?b:a;
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>Imprimir</title><style>
    @page{ size:${wIn}in ${hIn}in; margin:0; }
    html,body{ margin:0; } img{ width:${wIn}in; height:${hIn}in; display:block; }
  </style></head><body><img src="${url}" onload="window.print()"></body></html>`);
  w.document.close();
  addToGallery(url);
}
function stamp(){ const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }

// ================= Galería de sesión =================
function addToGallery(url){ sessionGallery.unshift({url,event:eventName(),t:Date.now()}); }
function openGallery(){
  const g=$('galleryGrid'); g.innerHTML='';
  if(!sessionGallery.length) g.innerHTML='<p style="color:var(--mut)">Aún no hay fotos. Descarga o imprime alguna.</p>';
  sessionGallery.forEach(it=>{
    const d=document.createElement('div'); d.className='cell';
    d.innerHTML=`<img src="${it.url}"><div class="row">
      <button>Abrir</button><button>Imprimir</button></div>`;
    d.querySelectorAll('button')[0].onclick=()=>{ const a=document.createElement('a'); a.href=it.url; a.download='ArtefGoFrames.png'; a.click(); };
    d.querySelectorAll('button')[1].onclick=()=>{ const w=window.open(''); w.document.write(`<img src="${it.url}" style="max-width:100%" onload="print()">`); };
    g.appendChild(d);
  });
  openModal('galleryModal');
}

// ================= Lote de fotos =================
$('batchInput').addEventListener('change', e=>{
  const files=[...e.target.files]; if(!files.length) return;
  if(window.__NATIVE__){ e.target.value=''; alert('El lote llegará con el envío a la PC. Por ahora usa Guardar / Compartir una por una.'); return; }
  if(!state.frame){ alert('Primero carga y personaliza un marco.'); return; }
  let done=0;
  files.forEach((f,i)=>{
    loadImageFromFile(f, img=>{
      const prevPhoto=state.photo, prevAdj=adjustedPhoto;
      state.photo=img; rebuildAdjusted();
      const c=renderFinal(); const url=c.toDataURL('image/png');
      const a=document.createElement('a'); a.href=url;
      a.download=`ArtefGoFrames_${eventName()}_${i+1}_${stamp()}.png`;
      setTimeout(()=>a.click(), i*300);
      addToGallery(url);
      state.photo=prevPhoto; adjustedPhoto=prevAdj;
      done++; if(done===files.length){ setStatus(`Lote: ${done} foto(s) procesadas.`); render(); }
    });
  });
  e.target.value='';
});

// ================= Proyecto (guardar/cargar) =================
function imgToData(img){ if(!img) return null; return imageToCanvas(img).toDataURL('image/png'); }
function saveProject(){
  const data={ v:1, event:$('event').value, size:$('size').value, orient:$('orient').value,
    square:$('square').checked, zone:state.zone, hasAlpha:state.hasAlpha,
    bright:state.bright, contrast:state.contrast, gray:state.gray, bw:state.bw, bwth:state.bwth,
    text:state.text, font:state.font, tsize:state.tsize, tcolor:state.tcolor, textPos:state.textPos,
    logoWidth:state.logoWidth, logoPos:state.logoPos,
    frame:imgToData(state.frame), photo:imgToData(state.photo), logo:imgToData(state.logo) };
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`${eventName()}.afgf`; a.click(); setStatus('Proyecto guardado.');
}
$('openProjectFile').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{ loadProjectData(JSON.parse(r.result)); }
    catch(err){ alert('Archivo inválido: '+err.message); } };
  r.readAsText(f); e.target.value='';
});
function loadProjectData(d){
  $('event').value=d.event||''; $('size').value=d.size||'4x6'; $('orient').value=d.orient||'v';
  $('square').checked=!!d.square;
  state.zone=d.zone||{x:.25,y:.25,w:.5,h:.5}; state.hasAlpha=!!d.hasAlpha;
  $('bright').value=state.bright=d.bright||0; $('contrast').value=state.contrast=d.contrast||0;
  $('gray').checked=state.gray=!!d.gray; $('bw').checked=state.bw=!!d.bw;
  $('bwth').value=state.bwth=d.bwth||128;
  $('text').value=state.text=d.text||''; $('font').value=state.font=d.font||'Poppins';
  $('tsize').value=state.tsize=d.tsize||6; $('tcolor').value=state.tcolor=d.tcolor||'#ffffff';
  state.textPos=d.textPos||{x:.5,y:.9};
  $('lsize').value=(state.logoWidth=d.logoWidth||.25)*100; state.logoPos=d.logoPos||{x:.5,y:.2};
  const loadImg=(data,set)=>{ if(!data){set(null);return Promise.resolve();}
    return new Promise(res=>{ const im=new Image(); im.onload=()=>{set(im);res();}; im.src=data; }); };
  Promise.all([
    loadImg(d.frame,i=>state.frame=i), loadImg(d.photo,i=>state.photo=i), loadImg(d.logo,i=>state.logo=i)
  ]).then(()=>{ rebuildAdjusted(); fitView(); setStatus('Proyecto cargado.'); });
}
function newProject(){
  state.frame=state.photo=state.logo=null; state.hasAlpha=false; adjustedPhoto=null;
  state.zone={x:.25,y:.25,w:.5,h:.5}; state.textPos={x:.5,y:.9}; state.logoPos={x:.5,y:.2};
  ['bright','contrast'].forEach(id=>$(id).value=0); $('bwth').value=128;
  ['gray','bw','square'].forEach(id=>$(id).checked=false);
  $('text').value=''; state.text=''; state.bright=state.contrast=0; state.gray=state.bw=false;
  render(); setStatus('Proyecto nuevo.');
}

// ================= Entradas de imagen =================
$('frameInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f)return;
  loadImageFromFile(f,img=>{ state.frame=img; const z=detectAlpha(img);
    if(z){ state.hasAlpha=true; state.zone=z; setStatus('Marco con transparencia: zona automática.'); }
    else { state.hasAlpha=false; state.zone={x:.25,y:.25,w:.5,h:.5};
      setStatus('Marco opaco: ajusta la zona arrastrando el rectángulo.'); }
    fitView(); }); e.target.value=''; });
$('photoInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f)return;
  loadImageFromFile(f,img=>{ state.photo=img; rebuildAdjusted(); render(); }); e.target.value=''; });
$('logoInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f)return;
  loadImageFromFile(f,img=>{ state.logo=img; state.logoPos={x:.5,y:.2}; render();
    setStatus('Logo agregado. Arrástralo en la vista.'); }); e.target.value=''; });

// ================= Controles =================
function bind(id, prop, fn){ $(id).addEventListener('input', e=>{
  state[prop]= fn? fn(e.target) : e.target.value; if(['bright','contrast','gray','bw','bwth'].includes(id)) rebuildAdjusted(); render(); }); }
bind('bright','bright',t=>+t.value); bind('contrast','contrast',t=>+t.value);
bind('bwth','bwth',t=>+t.value);
$('gray').addEventListener('change',e=>{ state.gray=e.target.checked; rebuildAdjusted(); render(); });
$('bw').addEventListener('change',e=>{ state.bw=e.target.checked; rebuildAdjusted(); render(); });
$('text').addEventListener('input',e=>{ state.text=e.target.value; render(); });
$('font').addEventListener('change',e=>{ state.font=e.target.value; render(); });
$('tsize').addEventListener('input',e=>{ state.tsize=+e.target.value; render(); });
$('tcolor').addEventListener('input',e=>{ state.tcolor=e.target.value; render(); });
$('lsize').addEventListener('input',e=>{ state.logoWidth=+e.target.value/100; render(); });
$('size').addEventListener('change',fitView); $('orient').addEventListener('change',fitView);
$('square').addEventListener('change',()=>render());
function restorePhoto(){ ['bright','contrast'].forEach(id=>$(id).value=0); $('bwth').value=128;
  ['gray','bw'].forEach(id=>$(id).checked=false);
  state.bright=state.contrast=0; state.gray=state.bw=false; state.bwth=128;
  rebuildAdjusted(); render(); setStatus('Foto restaurada.'); }
function removeLogo(){ state.logo=null; render(); setStatus('Logo quitado.'); }

// ================= Temas (Windows Phone) =================
const THEMES=[['Lima','#A4C400'],['Verde','#60A917'],['Esmeralda','#008A00'],['Verde azulado','#00ABA9'],
  ['Cian','#1BA1E2'],['Cobalto','#0050EF'],['Índigo','#6A00FF'],['Violeta','#AA00FF'],
  ['Rosa','#F472D0'],['Magenta','#D80073'],['Rojo','#E51400'],['Naranja','#FA6800']];
function applyTheme(hex){ document.documentElement.style.setProperty('--acc',hex);
  document.documentElement.style.setProperty('--accD', shade(hex,-18));
  localStorage.setItem('afgf_theme',hex); render(); }
function shade(hex,p){ const n=parseInt(hex.slice(1),16); let r=(n>>16)+p*2.55, g=((n>>8)&255)+p*2.55, b=(n&255)+p*2.55;
  const c=x=>Math.max(0,Math.min(255,Math.round(x))); return '#'+((1<<24)+(c(r)<<16)+(c(g)<<8)+c(b)).toString(16).slice(1); }
(function initThemes(){ const d=$('themeDrop');
  THEMES.forEach(([name,hex])=>{ const b=document.createElement('button');
    b.textContent=name; b.onclick=()=>applyTheme(hex); d.appendChild(b); });
  applyTheme(localStorage.getItem('afgf_theme')||'#1BA1E2'); })();

// ================= Menús / Modales =================
document.querySelectorAll('.menu>button').forEach(b=>{
  b.onclick=e=>{ const m=b.parentElement; const open=m.classList.contains('open');
    document.querySelectorAll('.menu').forEach(x=>x.classList.remove('open'));
    if(!open) m.classList.add('open'); e.stopPropagation(); }; });
document.addEventListener('click',()=>document.querySelectorAll('.menu').forEach(x=>x.classList.remove('open')));
function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
function openAbout(){ openModal('aboutModal'); loadNews(); }
async function verLicencia(){
  openModal('licenseModal');
  const el = $('licBox');
  try{
    const i = await window.afgf.licenseInfo();
    if(!i || !i.activated){ el.innerHTML = 'No hay licencia activa (modo demo).'; return; }
    const vence = new Date(i.expiry*1000).toLocaleDateString();
    const tipo = i.type==='demo' ? 'Demo (72 h)' : 'Licencia completa';
    el.innerHTML =
      '<b>Tipo:</b> '+tipo+'<br>'+
      '<b>Correo:</b> '+esc(i.email||'—')+'<br>'+
      '<b>Vence:</b> '+vence+'  ('+i.daysLeft+' dias restantes)<br>'+
      '<b>ID de equipo:</b><br><span style="font-family:monospace;font-size:12px;word-break:break-all">'+esc(i.hwid)+'</span>';
  }catch(e){ el.textContent = 'No se pudo leer la licencia: '+(e.message||e); }
}
async function desactivar(){
  if(!confirm('Desactivar la licencia en este equipo? Tendras que volver a activar.')) return;
  try{ await window.afgf.deactivate(); }catch(e){}
}

// Modo demo (lo pasa el proceso principal por ?demo=1)
// window.__DEMO__ se define en el arranque según el tipo de licencia (ver adaptador Android).
// Noticias desde el hosting.
const NEWS_URL = 'https://artefgo.com/news/news.json';
function loadNews(){
  fetch(NEWS_URL).then(r=>r.ok?r.json():Promise.reject()).then(items=>{
    $('newsBox').innerHTML = (items||[]).map(it=>
      `<div style="background:var(--card);border-left:4px solid var(--acc);padding:8px 10px;border-radius:6px;margin-bottom:8px">
       <b style="color:var(--acc)">${esc(it.title)}</b><br><small style="color:#888">${esc(it.date)}</small>
       <div>${esc(it.body).replace(/\n/g,'<br>')}</div></div>`).join('') || 'Sin novedades.';
  }).catch(()=>{ $('newsBox').textContent='No se pudieron cargar las novedades (revisa la carpeta news en tu hosting).'; });
}
function esc(s){ return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// ================= Arranque =================
window.addEventListener('resize', fitView);
document.fonts.ready.then(fitView);
fitView();
setStatus('Carga un marco para empezar.');

// ======================================================================
// ================= Adaptador Android (Capacitor) ======================
// ======================================================================
var __Cap = window.Capacitor || {};
var P = __Cap.Plugins || {};
window.__NATIVE__ = !!(__Cap.isNativePlatform && __Cap.isNativePlatform());

// Puente para el modal de licencia del editor
window.afgf = {
  licenseInfo: function(){ return AFGF_LIC.info(); },
  deactivate: async function(){ await AFGF_LIC.deactivate(); showActivation('Licencia desactivada. Vuelve a activar.'); }
};

// ---- Pantallas ----
function showActivation(message){
  var a=document.getElementById('activation'); if(a) a.classList.add('on');
  if(message){ var m=document.getElementById('actMsg'); if(m) m.textContent=message; }
  AFGF_LIC.hardwareId().then(function(h){ var e=document.getElementById('hwid'); if(e) e.textContent=h; }).catch(function(){});
}
function showEditor(){
  var a=document.getElementById('activation'); if(a) a.classList.remove('on');
  fitView();
}

// ---- Cámara ----
async function tomarFoto(){
  try{
    if(window.__NATIVE__ && P.Camera && P.Camera.getPhoto){
      var ph = await P.Camera.getPhoto({ quality:92, resultType:'dataUrl', source:'CAMERA', allowEditing:false, saveToGallery:false });
      var img=new Image(); img.onload=function(){ state.photo=img; rebuildAdjusted(); render(); }; img.src=ph.dataUrl;
    } else { $('photoInput').click(); }
  }catch(e){ /* cancelado */ }
}

// ---- Salida: guardar/compartir en Android ----
async function shareCanvas(canvas, filename){
  var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  if(window.__NATIVE__ && P.Filesystem && P.Share){
    try{
      var base64 = dataUrl.split(',')[1];
      var w = await P.Filesystem.writeFile({ path: filename, data: base64, directory:'CACHE' });
      await P.Share.share({ title:'ArtefGo Frames', files:[w.uri] });
    }catch(e){ var m=String(e&&e.message||e); if(!/cancel/i.test(m)) alert('No se pudo compartir: '+m); }
  } else {
    var a=document.createElement('a'); a.href=dataUrl; a.download=filename; a.click();
  }
}
async function shareText(text, filename){
  try{
    var base64 = btoa(unescape(encodeURIComponent(text)));
    var w = await P.Filesystem.writeFile({ path: filename, data: base64, directory:'CACHE' });
    await P.Share.share({ title:'Proyecto ArtefGo', files:[w.uri] });
  }catch(e){ var m=String(e&&e.message||e); if(!/cancel/i.test(m)) alert('No se pudo compartir: '+m); }
}

var _origPrint = printPhoto, _origSave = saveProject;
downloadPhoto = function(){
  if(!state.frame){ alert('Primero carga un marco.'); return; }
  var c=renderFinal(); var name='ArtefGo_'+eventName()+'_'+stamp()+'.jpg';
  if(window.__NATIVE__){ shareCanvas(c, name); addToGallery(c.toDataURL('image/jpeg',0.95)); setStatus('Listo para guardar o compartir.'); }
  else { var url=c.toDataURL('image/png'); var a=document.createElement('a'); a.href=url; a.download=name.replace('.jpg','.png'); a.click(); addToGallery(url); setStatus('Foto descargada.'); }
};
printPhoto = function(){
  if(window.__NATIVE__){ setStatus('La impresión será por WiFi a la PC (próximamente). Usa Guardar / Compartir.'); return; }
  _origPrint();
};
saveProject = function(){
  if(!window.__NATIVE__){ _origSave(); return; }
  var data={ v:1, event:$('event').value, size:$('size').value, orient:$('orient').value,
    square:$('square').checked, zone:state.zone, hasAlpha:state.hasAlpha,
    bright:state.bright, contrast:state.contrast, gray:state.gray, bw:state.bw, bwth:state.bwth,
    text:state.text, font:state.font, tsize:state.tsize, tcolor:state.tcolor, textPos:state.textPos,
    logoWidth:state.logoWidth, logoPos:state.logoPos,
    frame:imgToData(state.frame), photo:imgToData(state.photo), logo:imgToData(state.logo) };
  shareText(JSON.stringify(data), eventName()+'.afgf');
  setStatus('Proyecto listo para guardar o compartir.');
};

// ---- Arrastre táctil (reusa la lógica de mouse vía eventos sintéticos) ----
// Solo arrastra (y bloquea el scroll) cuando el toque empieza sobre un elemento
// movible del lienzo. Si no, deja que el panel se desplace normalmente.
view.addEventListener('touchstart', function(e){ if(!e.touches.length) return; var t=e.touches[0];
  view.dispatchEvent(new MouseEvent('mousedown',{clientX:t.clientX,clientY:t.clientY,bubbles:true}));
  if(drag) e.preventDefault(); }, {passive:false});
window.addEventListener('touchmove', function(e){ if(!drag || !e.touches.length) return; var t=e.touches[0];
  window.dispatchEvent(new MouseEvent('mousemove',{clientX:t.clientX,clientY:t.clientY,bubbles:true})); e.preventDefault(); }, {passive:false});
window.addEventListener('touchend', function(){ if(drag) window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }, {passive:false});

// ---- Ajustes de interfaz para Android ----
if(window.__NATIVE__){
  document.querySelectorAll('[data-print]').forEach(function(b){ b.style.display='none'; });
  var ob=document.getElementById('btnOut'); if(ob) ob.textContent='Guardar / Compartir';
  var fm=document.getElementById('fmDownload'); if(fm) fm.textContent='Guardar / Compartir';
  // Android no reconoce la extensión .afgf: permite elegir cualquier archivo
  var opf=document.getElementById('openProjectFile'); if(opf) opf.setAttribute('accept','*/*');
}
var bc=document.getElementById('btnCamera'); if(bc) bc.addEventListener('click', tomarFoto);

// ---- Activación ----
(function wireActivation(){
  var ba=document.getElementById('btnActivate'), bd=document.getElementById('btnDemo');
  if(!ba||!bd) return;
  function busy(b){ ba.disabled=b; bd.disabled=b; }
  ba.addEventListener('click', async function(){
    document.getElementById('actMsg').textContent='Activando…'; busy(true);
    var r=await AFGF_LIC.activate(document.getElementById('email').value, document.getElementById('key').value);
    busy(false);
    if(r.ok){ window.__DEMO__=(r.type==='demo'); showEditor(); render(); }
    else document.getElementById('actMsg').textContent='No se pudo activar: '+r.error;
  });
  bd.addEventListener('click', async function(){
    document.getElementById('actMsg').textContent='Solicitando demo…'; busy(true);
    var r=await AFGF_LIC.requestDemo(); busy(false);
    if(r.ok){ window.__DEMO__=true; showEditor(); render(); }
    else document.getElementById('actMsg').textContent='No se pudo activar la demo: '+r.error;
  });
})();

// ---- Arranque: licencia primero ----
(async function boot(){
  try{
    var lic = await AFGF_LIC.load();
    if(!AFGF_LIC.valid(lic)){ showActivation(); return; }
    if(AFGF_LIC.needsCheck(lic)){
      try{ await AFGF_LIC.verifyOnline(lic.email); await AFGF_LIC.save(lic, AFGF_LIC.nowSec()); }
      catch(e){ if(!AFGF_LIC.withinGrace(lic)){ showActivation('No se pudo verificar la licencia. Conéctate a internet para seguir usándola.'); return; } }
    }
    window.__DEMO__ = (lic.type==='demo');
    showEditor(); render();
  }catch(e){ showActivation('Error al leer la licencia.'); }
})();

// ======================================================================
// ============ Paleta de control + botón Atrás (Android) ===============
// ======================================================================
var selTarget = 'zone';
function setPalTarget(t){
  selTarget = t;
  document.querySelectorAll('#palette .pt').forEach(function(b){ b.classList.toggle('act', b.getAttribute('data-t')===t); });
  var h=document.getElementById('palhint');
  if(h) h.textContent = t==='zone' ? 'Mueve y ajusta la zona donde va la foto.'
       : t==='text' ? 'Mueve y agranda/achica el texto.'
       : 'Mueve y agranda/achica el logo.';
}
function palMove(dx,dy){
  var step=0.02;
  if(selTarget==='zone'){
    if(state.hasAlpha){ setStatus('El marco tiene zona automática (transparencia).'); return; }
    var z=state.zone; z.x=clamp(z.x+dx*step); z.y=clamp(z.y+dy*step);
    z.x=Math.max(0,Math.min(z.x,1-z.w)); z.y=Math.max(0,Math.min(z.y,1-z.h)); state.zone=z;
  } else if(selTarget==='text'){
    if(!state.text){ setStatus('Escribe un texto primero.'); return; }
    state.textPos={x:clamp(state.textPos.x+dx*step), y:clamp(state.textPos.y+dy*step)};
  } else if(selTarget==='logo'){
    if(!state.logo){ setStatus('Agrega un logo primero.'); return; }
    state.logoPos={x:clamp(state.logoPos.x+dx*step), y:clamp(state.logoPos.y+dy*step)};
  }
  render();
}
function palSize(kind){
  if(selTarget==='zone'){
    if(state.hasAlpha){ setStatus('El marco tiene zona automática (transparencia).'); return; }
    var z=state.zone, s=0.03;
    if(kind==='big'){ z.w=Math.min(1,z.w+s); z.h=Math.min(1,z.h+s); }
    else if(kind==='small'){ z.w=Math.max(0.05,z.w-s); z.h=Math.max(0.05,z.h-s); }
    else if(kind==='wider'){ z.w=Math.min(1,z.w+s); }
    else if(kind==='narrower'){ z.w=Math.max(0.05,z.w-s); }
    else if(kind==='taller'){ z.h=Math.min(1,z.h+s); }
    else if(kind==='shorter'){ z.h=Math.max(0.05,z.h-s); }
    z.x=Math.max(0,Math.min(z.x,1-z.w)); z.y=Math.max(0,Math.min(z.y,1-z.h)); state.zone=z;
  } else if(selTarget==='text'){
    if(!state.text){ setStatus('Escribe un texto primero.'); return; }
    var up = (kind==='big'||kind==='wider'||kind==='taller');
    state.tsize = up ? Math.min(20,state.tsize+1) : Math.max(2,state.tsize-1);
    var ts=$('tsize'); if(ts) ts.value=state.tsize;
  } else if(selTarget==='logo'){
    if(!state.logo){ setStatus('Agrega un logo primero.'); return; }
    var up2 = (kind==='big'||kind==='wider'||kind==='taller');
    state.logoWidth = up2 ? Math.min(0.6,state.logoWidth+0.03) : Math.max(0.05,state.logoWidth-0.03);
    var ls=$('lsize'); if(ls) ls.value=state.logoWidth*100;
  }
  render();
}
(function wirePalette(){
  document.querySelectorAll('#palette .pt').forEach(function(b){ b.addEventListener('click', function(){ setPalTarget(b.getAttribute('data-t')); }); });
  var MOVES={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  document.querySelectorAll('#palette .ppad button').forEach(function(b){
    b.addEventListener('click', function(){ var m=MOVES[b.getAttribute('data-m')]; palMove(m[0],m[1]); }); });
  document.querySelectorAll('#palette .psize button').forEach(function(b){
    b.addEventListener('click', function(){ palSize(b.getAttribute('data-s')); }); });
})();

// ---- Botón Atrás de Android: cierra modal/menú; si no hay nada, minimiza (no pierde el trabajo) ----
if(P.App && P.App.addListener){
  P.App.addListener('backButton', function(){
    var m=document.querySelector('.modal.open');
    if(m){ m.classList.remove('open'); return; }
    var mn=document.querySelector('.menu.open');
    if(mn){ mn.classList.remove('open'); return; }
    var act=document.getElementById('activation');
    if(act && act.classList.contains('on')){ if(P.App.minimizeApp) P.App.minimizeApp(); return; }
    if(P.App.minimizeApp) P.App.minimizeApp();
  });
}
