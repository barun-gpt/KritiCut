/* ============================================================
   KritiCut v2.0 — Full-featured mobile video editor
   ============================================================ */
(() => {
'use strict';

// ---------- helpers ----------
const $ = (s,p=document) => p.querySelector(s);
const $$ = (s,p=document) => [...p.querySelectorAll(s)];
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const uid = () => 'id'+Math.random().toString(36).slice(2,9);
const fmtTime = s => { if(!isFinite(s)||s<0)s=0; const m=Math.floor(s/60),sec=Math.floor(s%60); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
const escapeHtml = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast = msg => { const el=$('#toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.add('hidden'),1800); };
const installClip = c => { c.duration = function(){ return this.end - this.start; }; return c; };

// ---------- state ----------
const S = {
  clips: [],
  mediaLib: [],
  selId: null,
  playhead: 0,
  playing: false,
  zoom: 1,
  pxPerSec: 60,
  trackLabelW: 66,
  tab: 'edit',
  history: [],
  historyIdx: -1,
  videoEls: new Map(),
  imageEls: new Map(),
  audioEls: new Map(),
  audioCtx: null,
  master: null,
  activeAudio: [],
  playWall: 0, playStart: 0,
  tlHeight: parseInt(localStorage.getItem('kc_tlh')||'240',10),
  editingTextClip: null,
  textDraft: {},
};

// ---------- DOM ----------
const canvas = $('#previewCanvas');
const ctx = canvas.getContext('2d',{alpha:false});
const overlay = $('#overlayLayer');

// ============================================================
// Boot
// ============================================================
function boot(){
  try { init(); S._booted = true; }
  catch(err) {
    console.error('KritiCut init error:', err);
    const el = document.createElement('div');
    el.style.cssText='position:fixed;bottom:20px;left:20px;right:20px;background:#ff5470;color:#fff;padding:14px;border-radius:10px;z-index:99999;font-size:13px;font-family:monospace;box-shadow:0 8px 24px rgba(0,0,0,0.5)';
    el.textContent='Init error: '+err.message;
    document.body.appendChild(el);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(boot,30), {once:true});
} else {
  setTimeout(boot,30);
}

/* Global delegated close button — always works even if per-modal setup fails */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.close-btn, [data-close]');
  if (btn) {
    const modal = btn.closest('.modal');
    if (modal) { modal.classList.add('hidden'); e.stopPropagation(); e.preventDefault(); }
  }
  // Click on modal backdrop to close
  if (e.target.classList && e.target.classList.contains('modal')) {
    e.target.classList.add('hidden');
  }
}, true);

function init() {
  buildHome();
  setupEditorChrome();
  setupCanvas();
  setupTimeline();
  setupTransport();
  setupZoom();
  setupResize();
  setupTabs();
  setupTextModal();
  setupPresetModal();
  setupExportModal();
  setupImport();
  setupUndoRedo();
  setupKeyboard();
}

// ============================================================
// Home / Landing
// ============================================================
function showHome() {
  $('#homeScreen').classList.remove('hidden');
  $('#editorScreen').classList.add('hidden');
  stopPlayback();
}
function showEditor() {
  $('#homeScreen').classList.add('hidden');
  $('#editorScreen').classList.remove('hidden');
  requestAnimationFrame(() => { resizeCanvas(); renderTimeline(); updatePlayheadUI(); render(); });
}
function buildHome() {
  // New project
  $('#btnNewProject').addEventListener('click', () => { newProject(); showEditor(); });
  $('#btnOpenProject').addEventListener('click', () => {
    const data = localStorage.getItem('kc_draft');
    if (!data) { toast('No saved draft'); return; }
    try {
      const d = JSON.parse(data);
      S.clips = d.clips.map(c => installClip({...c}));
      // Re-create elements for media lib
      d.mediaLib.forEach(m => {
        if (m.src && m.type === 'video') {
          // Can't revive blob URLs across reloads — skip videos from drafts
        }
      });
      showEditor();
      toast('Draft loaded');
    } catch(e) { toast('Failed to open draft'); }
  });
  $('#btnImportPresetHome').addEventListener('click', () => $('#homePresetFile').click());
  $('#homePresetFile').addEventListener('change', e => importPresetFile(e.target.files[0], true));

  // Templates
  const tg = $('#templateGrid'); tg.innerHTML = '';
  TEMPLATES.forEach(t => {
    const el = document.createElement('div');
    el.className = 'template-card';
    el.style.background = t.color;
    el.innerHTML = `<div class="tpl-tag">${t.tag}</div><div class="tpl-name">${t.name}</div><button class="tpl-use">Use</button>`;
    $('.tpl-use', el).addEventListener('click', () => {
      newProject();
      addWelcomeClip();
      // Apply preset to welcome clip
      const w = S.clips[0];
      w.filters = {...(t.preset.filters||{})};
      saveHistory();
      showEditor();
      toast(`Template "${t.name}" applied — add your media`);
    });
    tg.appendChild(el);
  });

  // Home preset chips
  const pc = $('#homePresetChips'); pc.innerHTML = '';
  [...BUILTIN_PRESETS, ...loadUserPresets()].forEach(p => {
    const c = document.createElement('div');
    c.className = 'chip';
    c.innerHTML = `<div class="chip-preview" style="background:linear-gradient(135deg,#4ea8ff,#25c38e)"></div>${escapeHtml(p.name)}`;
    c.addEventListener('click', () => {
      newProject(); addWelcomeClip();
      const w = S.clips[0];
      w.filters = {...(p.data.filters||{})};
      saveHistory(); showEditor();
      toast(`Preset "${p.name}" loaded`);
    });
    pc.appendChild(c);
  });
}

function newProject() {
  S.clips = []; S.mediaLib = []; S.selId = null; S.playhead = 0;
  S.history = []; S.historyIdx = -1;
  S.videoEls.clear(); S.imageEls.clear(); S.audioEls.clear();
}

// ============================================================
// Editor chrome
// ============================================================
function setupEditorChrome() {
  $('#btnHome').addEventListener('click', () => {
    // Autosave
    try { localStorage.setItem('kc_draft', JSON.stringify({clips:S.clips.map(c=>{const x={...c};delete x.duration;return x;}),mediaLib:S.mediaLib})); } catch(e){}
    showHome();
  });
  $('#btnPreset').addEventListener('click', () => openPresetModal());
  $('#btnAdd').addEventListener('click', () => $('#importModal').classList.remove('hidden'));
  $('#btnSplit').addEventListener('click', splitAtPlayhead);
  $('#btnDelete').addEventListener('click', deleteSelected);
  $('#btnDuplicate').addEventListener('click', duplicateSelected);
  $('#btnKeyframe').addEventListener('click', addKeyframeAtPlayhead);
}

// ============================================================
// Canvas sizing & render loop
// ============================================================
function setupCanvas() {
  requestAnimationFrame(function tick(now) {
    if (S.playing) {
      S.playhead = S.playStart + (now - S.playWall)/1000;
      const d = totalDur();
      if (S.playhead >= d) { S.playhead = d; pause(); }
      driveVideos();
      updatePlayheadUI();
    }
    render();
    requestAnimationFrame(tick);
  });
}
function resizeCanvas() {
  const wrap = $('#previewWrap');
  const r = wrap.getBoundingClientRect();
  const ratio = Math.min(r.width/9, r.height/16);
  const w = 9*ratio*0.92, h = 16*ratio*0.92;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const dpr = Math.min(window.devicePixelRatio||1,2);
  canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
  canvas._w = w; canvas._h = h;
  overlay.style.width = w+'px'; overlay.style.height = h+'px';
  overlay.style.left = ((r.width - w)/2)+'px';
  overlay.style.top = ((r.height - h)/2)+'px';
  render();
}
window.addEventListener('resize', resizeCanvas);

function totalDur() { let d=3; for(const c of S.clips) d=Math.max(d,c.end); return d; }

// ============================================================
// Rendering
// ============================================================
function render() {
  if (!canvas._w) return;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
  const t = S.playhead;
  const ar = 9/16, ca = W/H;
  let dw, dh, ox, oy;
  if (ca > ar) { dh=H; dw=H*ar; ox=(W-dw)/2; oy=0; } else { dw=W; dh=W/ar; ox=0; oy=(H-dh)/2; }
  ctx.save(); ctx.beginPath(); ctx.rect(ox,oy,dw,dh); ctx.clip();

  // Keyframed values interpolation
  applyKeyframes(t);

  const active = S.clips.filter(c=>c.start<=t && c.end>t).sort((a,b)=>(a.z||0)-(b.z||0));
  for (const c of active) {
    if (c.type==='video'||c.type==='image'||c.type==='procedural'||c.type==='overlay-img') {
      drawMediaClip(c,t,ox,oy,dw,dh);
    }
  }
  // Overlays (filter vignette from adjustments)
  for (const c of active) drawVignette(c,ox,oy,dw,dh);
  ctx.restore();
  renderTextOverlays(t);
  drawKeyframeMarkers();
}
function drawMediaClip(c,t,ox,oy,dw,dh) {
  const lt = (t-c.start)*(c.speed||1)+c.offset;
  ctx.save();
  ctx.globalAlpha = c.opacity ?? 1;
  // filters
  const f = c.filters||{};
  let fs = '';
  if (f.brightness!=null) fs += `brightness(${f.brightness}) `;
  if (f.contrast!=null) fs += `contrast(${f.contrast}) `;
  if (f.saturate!=null) fs += `saturate(${f.saturate}) `;
  if (f.hueRotate!=null) fs += `hue-rotate(${f.hueRotate}deg) `;
  if (f.sepia!=null) fs += `sepia(${f.sepia}) `;
  if (f.grayscale!=null) fs += `grayscale(${f.grayscale}) `;
  if (f.blurpx!=null) fs += `blur(${f.blurpx}px) `;
  ctx.filter = fs.trim() || 'none';

  const s = c.scale||1;
  const rot = ((c.rotation||0)+(c._kf?.rot||0))*Math.PI/180;
  const px = c._kf?.x ?? (c.x??0.5);
  const py = c._kf?.y ?? (c.y??0.5);
  const w = dw*s, h = dh*s;
  const cx = ox + dw*px, cy = oy + dh*py;
  ctx.translate(cx,cy); ctx.rotate(rot);
  if (c.flipX) ctx.scale(-1,1);

  if (c.type === 'procedural') {
    drawWelcome(c,lt,-w/2,-h/2,w,h);
  } else {
    let el = c.type==='video' ? S.videoEls.get(c.mediaId) : S.imageEls.get(c.mediaId);
    if (!el) { ctx.restore(); return; }
    if (c.type==='video' && !S.playing) {
      const want = clamp(lt,0,Math.max(0.05,c.mediaDur-0.05));
      if (Math.abs(el.currentTime - want) > 0.1) { try{el.currentTime=want;}catch(e){} }
    }
    const vW = el.videoWidth||el.naturalWidth||w, vH = el.videoHeight||el.naturalHeight||h;
    const a = vW/vH;
    let w2=w, h2=w/a; if (h2<h){h2=h;w2=h*a;}
    try{ctx.drawImage(el,-w2/2,-h2/2,w2,h2);}catch(e){}
  }
  // overlay color (warmth via color wash)
  if (f.warmth) {
    ctx.fillStyle = `rgba(255,170,60,${Math.abs(f.warmth)*0.15})`;
    ctx.fillRect(-w/2,-h/2,w,h);
  }
  if (f.fade) {
    ctx.fillStyle = `rgba(255,255,255,${f.fade*0.2})`;
    ctx.fillRect(-w/2,-h/2,w,h);
  }
  // clip effect
  applyClipEffect(c,-w/2,-h/2,w,h,lt);
  ctx.restore();
}
function drawVignette(c,ox,oy,dw,dh) {
  const v = c.filters?.vignette;
  if (!v) return;
  const grd = ctx.createRadialGradient(ox+dw/2,oy+dh/2,Math.min(dw,dh)*(0.4-v*0.1),ox+dw/2,oy+dh/2,Math.max(dw,dh)*(0.6+v*0.2));
  grd.addColorStop(0,'rgba(0,0,0,0)');
  grd.addColorStop(1,`rgba(0,0,0,${0.3+v*0.4})`);
  ctx.fillStyle = grd;
  ctx.save(); ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1,0,0,1,0,0);
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();
}
function drawWelcome(c,t,x,y,w,h){
  const hue=(t*25)%360;
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,`hsl(${hue},75%,55%)`);g.addColorStop(0.5,`hsl(${(hue+60)%360},75%,45%)`);g.addColorStop(1,`hsl(${(hue+140)%360},75%,35%)`);
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  for(let i=0;i<10;i++){ctx.fillStyle=`hsla(${(hue+i*30)%360},90%,65%,0.55)`;const bx=x+(Math.sin(t*0.8+i)*0.5+0.5)*w;const by=y+((t*40+i*70)%h);ctx.beginPath();ctx.arc(bx,by,15+Math.sin(t*2+i)*8,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=10;
  ctx.font=`bold ${Math.round(w*0.08)}px -apple-system,sans-serif`;
  const L=['Welcome to','KritiCut','Trim · Split · Keyframe','4K Export · Premium Filters','Templates & Presets','All features FREE'];
  ctx.fillText(L[Math.floor(t/1.8)%L.length],x+w/2,y+h/2);
  ctx.font=`${Math.round(w*0.04)}px -apple-system,sans-serif`;ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.fillText('Tap + to add media · Text tab for animated titles',x+w/2,y+h/2+w*0.09);
  ctx.shadowBlur=0;
}
function applyClipEffect(c,x,y,w,h,lt){
  switch(c.effect){
    case 'Vignette':{const g=ctx.createRadialGradient(x+w/2,y+h/2,w*0.35,x+w/2,y+h/2,w*0.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.6)');ctx.fillStyle=g;ctx.fillRect(x-50,y-50,w+100,h+100);break;}
    case 'Shake':ctx.fillStyle='rgba(255,0,80,0.1)';ctx.fillRect(x+(Math.random()-0.5)*8,y+(Math.random()-0.5)*8,w,h);break;
    case 'VHS':ctx.fillStyle=`rgba(255,255,255,${Math.random()*0.06})`;for(let i=0;i<12;i++){const yy=y+Math.random()*h;ctx.fillRect(x,yy,w,1+Math.random()*2);}break;
    case 'Zoom In':ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+w/2,y+h/2,60+(lt%3)*80,0,Math.PI*2);ctx.stroke();break;
    case 'Spin':ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=4;for(let i=0;i<4;i++){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(lt*3+i*Math.PI/2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w*0.4,0);ctx.stroke();ctx.restore();}break;
    case 'Flicker':ctx.fillStyle=`rgba(255,255,255,${Math.random()>0.9?0.3:0})`;ctx.fillRect(x,y,w,h);break;
    case 'Blur':ctx.filter='blur(2px) '+(ctx.filter||'');break;
  }
}

// ============================================================
// Text overlays
// ============================================================
function renderTextOverlays(t){
  overlay.innerHTML = '';
  for (const c of S.clips) {
    if (c.type !== 'text') continue;
    if (c.start > t || c.end <= t) continue;
    const div = document.createElement('div');
    div.className = 'overlay-text' + (S.selId===c.id ? ' selected':'') + (S.playing?'':' draggable');
    div.dataset.id = c.id;
    div.textContent = c.text || '';
    const px = c._kf?.x ?? (c.x??0.5), py = c._kf?.y ?? (c.y??0.4);
    const sz = c._kf?.size ?? (c.size||38);
    const rot = c._kf?.rot ?? (c.rotation||0);
    const op = c._kf?.opacity ?? (c.opacity??1);
    div.style.left = (px*100)+'%'; div.style.top = (py*100)+'%';
    div.style.fontSize = sz+'px';
    div.style.color = c.color||'#fff';
    div.style.fontFamily = c.fontCss || c.font || 'sans-serif';
    div.style.opacity = op;
    div.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${c._kf?.scale??1})`;
    if (c.bold) div.style.fontWeight='900';
    if (c.italic) div.style.fontStyle='italic';
    if (c.underline) div.style.textDecoration='underline';
    if (c.align) div.style.textAlign = c.align;
    if (c.strokeW) div.style.webkitTextStroke = `${c.strokeW}px ${c.stroke||'#000'}`;
    if (c.shadowBlur) div.style.textShadow = `0 0 ${c.shadowBlur}px ${c.shadow||'#000'}, 0 2px 4px rgba(0,0,0,0.6)`;
    else div.style.textShadow = '0 2px 6px rgba(0,0,0,0.7)';
    if (c.letterSpacing) div.style.letterSpacing = c.letterSpacing+'px';
    if (c.bg && c.bg !== '#00000000') { div.style.background = c.bg; div.style.padding = '4px 10px'; div.style.borderRadius = '6px'; }
    if (c.effectCss) div.style.cssText += c.effectCss;
    // Animation
    const lt = t - c.start;
    const dur = c.duration();
    const ad = c.animDur || 0.6;
    if (c.animIn && c.animIn !== 'None' && lt < ad) {
      div.style.animation = `${animName(c.animIn,'in')} ${ad}s forwards`;
    } else if (c.animOut && c.animOut !== 'None' && lt > dur - ad) {
      div.style.animation = `${animName(c.animOut,'out')} ${ad}s forwards`;
    } else if (c.animLoop && c.animLoop !== 'None') {
      div.style.animation = `${animName(c.animLoop,'loop')} 1.2s infinite`;
    }
    overlay.appendChild(div);
  }
  attachOverlayDrag();
}
function animName(name,dir){
  const map = {
    'Fade In':'kc-fadein','Fade Out':'kc-fadeout',
    'Pop In':'kc-popin','Pop Out':'kc-popout',
    'Slide Up':'kc-slideup','Slide Up Out':'kc-slideupout',
    'Slide Down':'kc-slidedown','Slide Down Out':'kc-slidedownout',
    'Slide Left':'kc-slideleft','Slide Left Out':'kc-slideleftout',
    'Slide Right':'kc-slideright','Slide Right Out':'kc-sliderightout',
    'Scale In':'kc-scalein','Scale Out':'kc-scaleout',
    'Blur In':'kc-blurin','Blur Out':'kc-blurout',
    'Spin In':'kc-spinin',
    'Typewriter':'kc-typewriter',
    'Pulse':'kc-pulse','Bounce':'kc-bounce','Wave':'kc-wave','Shake':'kc-shake',
    'Glow':'kc-glow','Rainbow':'kc-rainbow','Neon Flicker':'kc-flicker','Blink':'kc-flicker'
  };
  return map[name] || 'kc-fadein';
}

// Draggable text on overlay
let dragState = null;
function attachOverlayDrag(){
  if (S._dragBound) return;
  S._dragBound = true;
  const getP = e => e.touches ? e.touches[0] : e;
  overlay.addEventListener('mousedown', startD);
  overlay.addEventListener('touchstart', startD, {passive:false});
  function startD(e){
    const div = e.target.closest('.overlay-text');
    if (!div) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const id = div.dataset.id;
    const clip = S.clips.find(c=>c.id===id); if(!clip) return;
    select(id);
    const p = getP(e);
    const r = overlay.getBoundingClientRect();
    dragState = {clip, sx:p.x, sy:p.y, ox:clip.x??0.5, oy:clip.y??0.5, r};
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', mv, {passive:false}); document.addEventListener('touchend', up);
  }
  function mv(e){
    if(!dragState) return;
    if(e.cancelable) e.preventDefault();
    const p=getP(e);
    dragState.clip.x = clamp(dragState.ox + (p.x-dragState.sx)/dragState.r.width, 0,1);
    dragState.clip.y = clamp(dragState.oy + (p.y-dragState.sy)/dragState.r.height, 0,1);
    render();
  }
  function up(){
    document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
    document.removeEventListener('touchmove',mv);document.removeEventListener('touchend',up);
    if(dragState){saveHistory();dragState=null;}
  }
}

// ============================================================
// Playback / transport
// ============================================================
function setupTransport(){
  $('#btnPlay').addEventListener('click', togglePlay);
  $('#bigPlay').addEventListener('click', togglePlay);
  $('#btnPrevFrame').addEventListener('click', ()=>{pause();S.playhead=Math.max(0,S.playhead-1/30);updatePlayheadUI();render();});
  $('#btnNextFrame').addEventListener('click', ()=>{pause();S.playhead=Math.min(totalDur(),S.playhead+1/30);updatePlayheadUI();render();});
}
function togglePlay(){ S.playing ? pause() : play(); }
function play(){
  if (S.playhead >= totalDur()-0.05) S.playhead = 0;
  initAudio();
  S.playing = true;
  S.playWall = performance.now();
  S.playStart = S.playhead;
  startAudio();
  for (const c of S.clips) {
    if (c.type !== 'video') continue;
    const el = S.videoEls.get(c.mediaId); if(!el) continue;
    if (c.start<=S.playhead && c.end>S.playhead) {
      const lt = clamp((S.playhead-c.start)*(c.speed||1)+c.offset, 0, Math.max(0.05,c.mediaDur-0.05));
      try{el.currentTime=lt;el.playbackRate=c.speed||1;el.play().catch(()=>{});}catch(e){}
    }
  }
  $('#playIcon').innerHTML = '<path fill="currentColor" d="M6 4h4v16H6zm8 0h4v16h-4z"/>';
  $('#bigPlay').classList.add('hidden');
}
function pause(){ stopPlayback(); $('#playIcon').innerHTML = '<path fill="currentColor" d="M8 5v14l11-7z"/>'; $('#bigPlay').classList.remove('hidden'); render(); }
function stopPlayback(){ S.playing=false; stopAudio(); for(const el of S.videoEls.values()){try{el.pause();}catch(e){}} }
function driveVideos(){
  const t = S.playhead;
  for (const c of S.clips) {
    if (c.type !== 'video') continue;
    const el = S.videoEls.get(c.mediaId); if(!el) continue;
    if (c.start<=t && c.end>t) {
      const lt = clamp((t-c.start)*(c.speed||1)+c.offset, 0, Math.max(0.05,c.mediaDur-0.05));
      el.playbackRate = c.speed||1;
      if (el.paused) { try{el.currentTime=lt;el.play().catch(()=>{});}catch(e){} }
      else if (Math.abs(el.currentTime-lt)>0.2) { try{el.currentTime=lt;}catch(e){} }
    } else {
      if (!el.paused) try{el.pause();}catch(e){}
    }
  }
}
function initAudio(){
  if (S.audioCtx) { if(S.audioCtx.state==='suspended') S.audioCtx.resume().catch(()=>{}); return; }
  try {
    S.audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    S.master = S.audioCtx.createGain(); S.master.gain.value=1; S.master.connect(S.audioCtx.destination);
  } catch(e){}
}
function startAudio(){
  stopAudio(); if(!S.audioCtx) return;
  const t=S.playhead, now=S.audioCtx.currentTime;
  for (const c of S.clips) {
    if (c.type!=='audio' && c.type!=='video') continue;
    if (c.start>t+0.05 || c.end<=t) continue;
    const el = S.videoEls.get(c.mediaId)||S.audioEls.get(c.mediaId); if(!el||!el.captureStream) continue;
    try {
      const stream = el.captureStream();
      const src = S.audioCtx.createMediaStreamSource(stream);
      const g = S.audioCtx.createGain();
      const v = c.volume??1;
      g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(v,now+(c.fadeIn||0)+0.02);
      const ue = c.end-t, fo = c.fadeOut||0;
      if(fo>0 && ue>fo){ g.gain.setValueAtTime(v,now+ue-fo); g.gain.linearRampToValueAtTime(0,now+ue); }
      src.connect(g).connect(S.master);
      const lt = clamp((t-c.start)*(c.speed||1)+c.offset, 0, Math.max(0.05,(c.mediaDur||5)-0.05));
      el.currentTime = lt; el.playbackRate = c.speed||1; el.play().catch(()=>{});
      S.activeAudio.push({el,src,g});
    } catch(e){}
  }
}
function stopAudio(){ for(const{el} of S.activeAudio)try{el.pause();}catch(e){} S.activeAudio=[]; }

// ============================================================
// Timeline
// ============================================================
function setupTimeline(){
  const sc = $('#timelineScroll');
  sc.addEventListener('mousedown', onTlDown);
  sc.addEventListener('touchstart', onTlDown, {passive:false});
}
function onTlDown(e){
  if(e.target.closest('.clip')) return;
  const gx=ev=>ev.touches?ev.touches[0].clientX:ev.clientX;
  seek(gx(e));
  const mv=ev=>{if(ev.touches&&ev.cancelable)ev.preventDefault();seek(gx(ev));};
  const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);document.removeEventListener('touchmove',mv);document.removeEventListener('touchend',up);};
  document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  document.addEventListener('touchmove',mv,{passive:false});document.addEventListener('touchend',up);
}
function seek(cx){ const sc=$('#timelineScroll'),r=sc.getBoundingClientRect(),x=cx-r.left+sc.scrollLeft-S.trackLabelW; S.playhead=clamp(x/S.pxPerSec,0,totalDur()); pause(); updatePlayheadUI(); render(); }

function niceStep(p){ const s=80/p; for(const n of [0.1,0.2,0.5,1,2,5,10,30,60]) if(n>=s*0.7) return n; return 10; }

function renderTimeline(){
  const pxps=S.pxPerSec, td=totalDur(), totalPx=Math.max(2200,td*pxps+300), lw=S.trackLabelW;
  ['#videoClips','#overlayClips','#textClips','#audioClips'].forEach(id=>{const el=$(id);el.style.width=totalPx+'px';el.style.paddingLeft=lw+'px';el.style.boxSizing='border-box';});
  const ruler=$('#ruler');ruler.style.width=totalPx+'px';ruler.style.paddingLeft=lw+'px';ruler.style.boxSizing='border-box';ruler.innerHTML='';
  $$('.track-label').forEach(el=>el.style.width=lw+'px');
  const step=niceStep(pxps);
  for(let t=0;t<=td+step;t+=step){const tk=document.createElement('div');tk.className='ruler-tick'+(Math.abs(t%(step*2))<0.01?' major':'');tk.style.left=(lw+t*pxps)+'px';tk.textContent=fmtTime(t);ruler.appendChild(tk);}
  $('#videoClips').innerHTML='';$('#overlayClips').innerHTML='';$('#textClips').innerHTML='';$('#audioClips').innerHTML='';
  for(const c of S.clips){
    const el=document.createElement('div');
    const cls = c.type==='procedural'?'video':(c.type==='overlay-img'?'image':c.type);
    el.className='clip '+cls;el.dataset.id=c.id;
    el.style.left=(lw+c.start*pxps)+'px';el.style.width=(c.duration()*pxps)+'px';
    const nm = c.type==='text'?(c.text||'Text').slice(0,16):c.type==='audio'?(c.name||'Audio'):c.type==='procedural'?'Sample':(c.name||'Clip');
    el.innerHTML=`<div class="trim-handle trim-left"></div><div class="clip-name">${escapeHtml(nm)}</div><div class="trim-handle trim-right"></div>${c.keyframes?`<div class="kf-dot"></div>`:''}`;
    if(c.keyframes){const kfd=document.createElement('div');kfd.className='kf-ticks';c.keyframes.filter(k=>k.prop==='_all').forEach(k=>{const d=document.createElement('div');d.className='kf-tick';d.style.left=((k.t-c.start)*pxps)+'px';kfd.appendChild(d);});el.appendChild(kfd);}
    if(S.selId===c.id) el.classList.add('selected');
    const tid = c.type==='audio'?'audioClips':c.type==='text'?'textClips':c.type==='overlay-img'?'overlayClips':'videoClips';
    $('#'+tid).appendChild(el);
  }
  attachClipDnD();
}
let clipDrag=null;
function attachClipDnD(){
  $$('.clip').forEach(el=>{el.addEventListener('mousedown',dnd);el.addEventListener('touchstart',dnd,{passive:false});});
}
function dnd(e){
  const el=e.target.closest('.clip');if(!el)return;
  const clip=S.clips.find(c=>c.id===el.dataset.id);if(!clip)return;
  if(e.cancelable)e.preventDefault();e.stopPropagation();
  const isL=e.target.classList.contains('trim-left'),isR=e.target.classList.contains('trim-right');
  const touch=!!e.touches,gx=ev=>touch?ev.touches[0].clientX:ev.clientX;
  select(clip.id);pause();
  clipDrag={type:isL?'trimLeft':isR?'trimRight':'move',id:clip.id,sx:gx(e),os:clip.start,oe:clip.end,oo:clip.offset};
  const mv=ev=>{if(touch&&ev.cancelable)ev.preventDefault();applyCipDrag(gx(ev));};
  const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);document.removeEventListener('touchmove',mv);document.removeEventListener('touchend',up);if(clipDrag){saveHistory();clipDrag=null;}};
  document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  document.addEventListener('touchmove',mv,{passive:false});document.addEventListener('touchend',up);
}
function applyCipDrag(cx){
  if(!clipDrag)return;
  const c=S.clips.find(x=>x.id===clipDrag.id);if(!c)return;
  const dx=(cx-clipDrag.sx)/S.pxPerSec;
  if(clipDrag.type==='move'){c.start=Math.max(0,clipDrag.os+dx);c.end=c.start+(clipDrag.oe-clipDrag.os);}
  else if(clipDrag.type==='trimLeft'){const ns=Math.max(0,clipDrag.os+dx);const nd=clipDrag.oe-ns;if(nd<0.2)return;const md=c.mediaDur||nd;const off=clipDrag.oo+(clipDrag.os-ns);if(off<0)return;c.offset=clamp(off,0,Math.max(0,md-nd));c.start=ns;}
  else if(clipDrag.type==='trimRight'){let ne=clipDrag.oe+dx;const nd=ne-c.start;if(nd<0.2)return;if(c.type==='video'||c.type==='audio'){const md=c.mediaDur||nd;if(c.offset+nd>md+0.05)ne=c.start+(md-c.offset);}c.end=ne;}
  renderTimeline();render();updatePlayheadUI();
}

function updatePlayheadUI(){
  const left = S.trackLabelW + S.playhead*S.pxPerSec;
  $('#playheadLine').style.left=left+'px';
  $('#curTime').textContent=fmtTime(S.playhead);$('#totTime').textContent=fmtTime(totalDur());
  const sc=$('#timelineScroll'),vl=sc.scrollLeft,vr=vl+sc.clientWidth;
  if(left<vl+30||left>vr-60)sc.scrollLeft=clamp(left-sc.clientWidth/2,0,sc.scrollWidth);
}

// ============================================================
// Selection / clip panel
// ============================================================
function select(id){ S.selId=id; $$('.clip').forEach(el=>el.classList.toggle('selected',el.dataset.id===id)); showClipPanel(); render(); }
function selected(){ return S.clips.find(c=>c.id===S.selId); }
function deselect(){ S.selId=null; $$('.clip').forEach(el=>el.classList.remove('selected')); hideClipPanel(); render(); }
function showClipPanel(){
  const c=selected();if(!c)return hideClipPanel();
  const con=$('#clipPanelContent');con.innerHTML='';
  const mk=(i,l,f,d)=>{const b=document.createElement('button');b.className='clip-action'+(d?' danger':'');b.innerHTML=`<span style="font-size:18px">${i}</span><span>${l}</span>`;b.addEventListener('click',f);con.appendChild(b);};
  mk('✂','Split',()=>splitAt(c,S.playhead));
  mk('🗑','Delete',deleteSel,true);
  mk('⧉','Dup',dupSel);
  if(c.type!=='audio'&&c.type!=='procedural'){
    mk('↔','Flip',()=>{c.flipX=!c.flipX;render();saveHistory();});
    mk('↻','Rotate',()=>{c.rotation=((c.rotation||0)+90)%360;render();saveHistory();});
  }
  if(c.type==='text') mk('✎','Edit',()=>openTextFor(c));
  if(c.type==='video'||c.type==='audio'){
    slider(con,'Speed',0.25,4,0.05,c.speed??1,v=>{setSpeed(c,v);renderTimeline();return v.toFixed(2)+'×';});
    slider(con,'Vol',0,2,0.05,c.volume??1,v=>{c.volume=v;return Math.round(v*100)+'%';});
  }
  if(c.type==='image'||c.type==='overlay-img'||c.type==='text'){
    slider(con,'Opacity',0,1,0.05,c.opacity??1,v=>{c.opacity=v;return Math.round(v*100)+'%';});
  }
  if(c.type!=='audio'&&c.type!=='text'){
    slider(con,'Scale',0.2,3,0.05,c.scale??1,v=>{c.scale=v;return v.toFixed(2)+'×';});
  }
  $('#clipPanel').classList.remove('hidden');
}
function hideClipPanel(){ $('#clipPanel').classList.add('hidden'); }
function slider(c,l,mn,mx,st,v,fn){
  const r=document.createElement('div');r.className='slider-row';r.innerHTML=`<label>${l} <span class="v"></span></label><input type="range" min="${mn}" max="${mx}" step="${st}" value="${v}">`;
  const inp=$('input',r);$('.v',r).textContent=fn(v);
  inp.addEventListener('input',()=>{$('.v',r).textContent=fn(Number(inp.value));render();});
  inp.addEventListener('change',()=>saveHistory());
  c.appendChild(r);
}
function splitAtPlayhead(){const t=S.playhead;S.clips.filter(c=>c.start<t-0.05&&c.end>t+0.05).forEach(c=>splitAt(c,t));if(S.clips.some(c=>c.start<t-0.05&&c.end>t+0.05))toast('Split');else toast('No clip at playhead');}
function splitAt(c,t){if(t<=c.start+0.05||t>=c.end-0.05)return;const so=c.offset+(t-c.start)*(c.speed||1);const r=installClip(JSON.parse(JSON.stringify(c)));r.id=uid();r.start=t;r.end=c.end;r.offset=so;c.end=t;S.clips.push(r);renderTimeline();saveHistory();}
function deleteSel(){const c=selected();if(!c)return;S.clips=S.clips.filter(x=>x.id!==c.id);S.selId=null;hideClipPanel();renderTimeline();render();saveHistory();toast('Deleted');}
function dupSel(){const c=selected();if(!c)return;const copy=installClip(JSON.parse(JSON.stringify(c)));copy.id=uid();copy.start=c.end;copy.end=copy.start+c.duration();S.clips.push(copy);renderTimeline();saveHistory();toast('Duplicated');}
function setSpeed(c,s){c.speed=s;if(c.type==='video'||c.type==='audio')c.end=c.start+(c.mediaDur-c.offset)/s;}

// ============================================================
// Tabs (bottom)
// ============================================================
function setupTabs(){
  $$('.tab-btn').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
}
function setTab(tab){
  S.tab=tab;
  $$('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  hideClipPanel();
  renderTab(tab);
}
function renderTab(tab){
  const ex=$('#inlinePanel');if(ex)ex.remove();
  if(tab==='edit') return;
  const panel=document.createElement('div');panel.id='inlinePanel';panel.className='clip-panel';
  const sc=document.createElement('div');sc.className='panel-scroll';panel.appendChild(sc);
  const close=document.createElement('button');close.className='icon-btn';close.textContent='✕';close.style.cssText='position:absolute;top:6px;right:8px;color:var(--text-dim);z-index:5';
  close.addEventListener('click',()=>{panel.remove();$$('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab==='edit'));S.tab='edit';});
  panel.appendChild(close);

  if(tab==='filters'){
    // group filters by category
    const groups = {};
    PRESETS_FILTERS.forEach(f=>{(groups[f.group]=groups[f.group]||[]).push(f);});
    Object.entries(groups).forEach(([grp,list])=>{
      const h=document.createElement('div');h.className='panel-group-title';h.textContent=grp;sc.appendChild(h);
      const wrap=document.createElement('div');wrap.className='chip-row';sc.appendChild(wrap);
      list.forEach((f,i)=>{
        const chip=document.createElement('div');chip.className='chip';
        chip.innerHTML=`<div class="chip-preview" style="background:linear-gradient(135deg,#667eea,#764ba2)"></div>${f.name}`;
        chip.addEventListener('click',()=>{$$('.chip',panel).forEach(c=>c.classList.remove('active'));chip.classList.add('active');applyFilter(f.values,f.overlay);});
        wrap.appendChild(chip);
      });
    });
  } else if(tab==='adjust'){
    PRESETS_ADJUST.forEach(([k,lb,mn,mx,v,st])=>{
      const c=selected();
      const cur=c?.filters?.[k]??v;
      slider(sc,lb,mn,mx,st,cur,val=>{const cc=selected();if(!cc)return val;cc.filters=cc.filters||{};cc.filters[k]=val;return val.toFixed(k==='blurpx'||k==='hueRotate'?1:2);});
    });
    const rst=document.createElement('div');rst.className='chip chip-reset';rst.innerHTML=`<div class="chip-preview" style="background:var(--danger)"></div>Reset`;
    rst.addEventListener('click',()=>{const c=selected();if(c){c.filters={};c.effect=null;render();saveHistory();toast('Reset');}});
    sc.appendChild(rst);
  } else if(tab==='effects'){
    PRESETS_EFFECTS.forEach((n,i)=>{const chip=document.createElement('div');chip.className='chip'+(i===0?' active':'');chip.innerHTML=`<div class="chip-preview" style="background:linear-gradient(135deg,#f093fb,#f5576c)"></div>${n}`;chip.addEventListener('click',()=>{$$('.chip',panel).forEach(c=>c.classList.remove('active'));chip.classList.add('active');const c=selected();if(!c){toast('Select a clip');return;}c.effect=n==='None'?null:n;render();saveHistory();});sc.appendChild(chip);});
  } else if(tab==='audio'){
    const ab=document.createElement('div');ab.className='clip-action';ab.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg><span>Add</span>';ab.addEventListener('click',()=>$('#importAudio').click());sc.appendChild(ab);
    const s=selected();
    if(s && (s.type==='audio'||s.type==='video')){
      slider(sc,'Volume',0,2,0.05,s.volume??1,v=>{s.volume=v;return Math.round(v*100)+'%';});
      slider(sc,'Fade In',0,3,0.1,s.fadeIn??0,v=>{s.fadeIn=v;return v.toFixed(1)+'s';});
      slider(sc,'Fade Out',0,3,0.1,s.fadeOut??0,v=>{s.fadeOut=v;return v.toFixed(1)+'s';});
      slider(sc,'Speed',0.25,4,0.05,s.speed??1,v=>{setSpeed(s,v);renderTimeline();return v.toFixed(2)+'×';});
    }
  } else if(tab==='text'){
    const ab=document.createElement('div');ab.className='clip-action';ab.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg><span>Add Text</span>';ab.addEventListener('click',()=>openTextModal());sc.appendChild(ab);
    ['Title','Subtitle','Caption','Quote','Neon','Retro','Animated'].forEach(p=>{const chip=document.createElement('div');chip.className='chip';chip.innerHTML=`<div class="chip-preview" style="background:linear-gradient(135deg,#ffb347,#ff7a59);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:10px">T</div>${p}`;chip.addEventListener('click',()=>openTextModal(p));sc.appendChild(chip);});
  } else if(tab==='overlay'){
    const ab=document.createElement('div');ab.className='clip-action';ab.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg><span>Add Image</span>';ab.addEventListener('click',()=>$('#importImage').click());sc.appendChild(ab);
    const s=selected();if(s){
      slider(sc,'Opacity',0,1,0.05,s.opacity??1,v=>{s.opacity=v;return Math.round(v*100)+'%';});
      slider(sc,'Scale',0.2,3,0.05,s.scale??1,v=>{s.scale=v;return v.toFixed(2)+'×';});
      slider(sc,'Rotate',-180,180,1,s.rotation??0,v=>{s.rotation=v;return Math.round(v)+'°';});
    }
  } else if(tab==='keyframes'){
    const ab=document.createElement('div');ab.className='clip-action';ab.innerHTML='<span style="font-size:20px">◆</span><span>Add Key</span>';ab.addEventListener('click',addKeyframeAtPlayhead);sc.appendChild(ab);
    const rb=document.createElement('div');rb.className='clip-action danger';rb.innerHTML='<span style="font-size:20px">✕</span><span>Remove</span>';rb.addEventListener('click',removeKeyframeAtPlayhead);sc.appendChild(rb);
    const cb=document.createElement('div');cb.className='clip-action';cb.innerHTML='<span style="font-size:20px">⟳</span><span>Clear All</span>';cb.addEventListener('click',()=>{const c=selected();if(c){c.keyframes=[];render();saveHistory();toast('Keyframes cleared');}});sc.appendChild(cb);
    const help=document.createElement('div');help.className='panel-hint';help.textContent='Select a clip, move playhead, change a property (scale/position/opacity/text size), then tap Add Key. Move playhead again, adjust property, add another key — KritiCut animates between them.';sc.appendChild(help);
    const s=selected();if(s&&s.keyframes){const info=document.createElement('div');info.className='panel-hint';info.textContent=`${s.keyframes.length} keyframe(s) on this clip`;sc.appendChild(info);}
  }
  $('#resizeHandle').before(panel);
}
function applyFilter(vals, overlay){
  const c=selected();if(!c){toast('Select a clip first');return;}
  c.filters={...vals};c.overlayColor=overlay?.color||null;render();saveHistory();
}

// ============================================================
// Zoom
// ============================================================
function setupZoom(){
  $('#btnZoomIn').addEventListener('click',()=>setZoom(S.zoom*1.25));
  $('#btnZoomOut').addEventListener('click',()=>setZoom(S.zoom/1.25));
}
function setZoom(z){S.zoom=clamp(z,0.2,12);S.pxPerSec=60*S.zoom;$('#zoomVal').textContent=S.zoom.toFixed(1)+'×';renderTimeline();updatePlayheadUI();}

// ============================================================
// Resize handle
// ============================================================
function setupResize(){
  const h=$('#resizeHandle');let drag=false,sy,sh;
  $('#timelineSection').style.height=S.tlHeight+'px';
  const begin=(y)=>{drag=true;sy=y;sh=S.tlHeight;h.classList.add('active');document.body.classList.add('resizing');};
  const mv=(y)=>{if(!drag)return;let nh=sh+(y-sy);nh=clamp(nh,140,window.innerHeight*0.75);S.tlHeight=Math.round(nh);$('#timelineSection').style.height=nh+'px';requestAnimationFrame(resizeCanvas);};
  const end=()=>{if(!drag)return;drag=false;h.classList.remove('active');document.body.classList.remove('resizing');localStorage.setItem('kc_tlh',S.tlHeight);setTimeout(resizeCanvas,50);};
  h.addEventListener('mousedown',e=>{begin(e.clientY);e.preventDefault();e.stopPropagation();});
  window.addEventListener('mousemove',e=>{if(drag){mv(e.clientY);e.preventDefault();}});
  window.addEventListener('mouseup',end);
  h.addEventListener('touchstart',e=>{begin(e.touches[0].clientY);e.preventDefault();},{passive:false});
  window.addEventListener('touchmove',e=>{if(drag){mv(e.touches[0].clientY);e.preventDefault();}},{passive:false});
  window.addEventListener('touchend',end);
  h.addEventListener('dblclick',()=>{S.tlHeight=240;$('#timelineSection').style.height='240px';localStorage.removeItem('kc_tlh');resizeCanvas();toast('Timeline reset');});
}

// ============================================================
// Keyframes
// ============================================================
function addKeyframeAtPlayhead(){
  const c=selected();if(!c){toast('Select a clip first');return;}
  c.keyframes=c.keyframes||[];
  // For the current playhead, capture the current animated props
  const t = S.playhead - c.start;
  if (t < 0 || t > c.duration()) return toast('Playhead outside clip');
  // Remove existing at same time
  c.keyframes = c.keyframes.filter(k => Math.abs(k.t - t) > 0.05);
  c.keyframes.push({
    t,
    prop: '_all',
    x: c.x??0.5, y:c.y??0.5,
    scale:c.scale??1, rot:c.rotation??0, opacity:c.opacity??1,
    size:c.size||38,
  });
  c.keyframes.sort((a,b)=>a.t-b.t);
  renderTimeline(); render(); saveHistory();
  $('#kfHint').classList.remove('hidden');setTimeout(()=>$('#kfHint').classList.add('hidden'),900);
  toast('Keyframe added');
}
function removeKeyframeAtPlayhead(){
  const c=selected();if(!c||!c.keyframes)return;
  const t=S.playhead-c.start;
  const before=c.keyframes.length;
  c.keyframes=c.keyframes.filter(k=>Math.abs(k.t-t)>0.08);
  if(before===c.keyframes.length) return toast('No keyframe here');
  renderTimeline();render();saveHistory();toast('Keyframe removed');
}
function applyKeyframes(t){
  // Reset _kf cache
  for (const c of S.clips) c._kf = null;
  for (const c of S.clips) {
    if (!c.keyframes||c.keyframes.length===0) continue;
    if (c.start>t||c.end<=t) continue;
    const lt = t - c.start;
    const kfs = c.keyframes.filter(k=>k.prop==='_all').sort((a,b)=>a.t-b.t);
    if (kfs.length===0) continue;
    // Find segment
    let a=kfs[0], b=kfs[kfs.length-1];
    if (lt<=a.t) return applyKF(c,a);
    if (lt>=b.t) return applyKF(c,b);
    for (let i=0;i<kfs.length-1;i++){
      if(kfs[i].t<=lt && kfs[i+1].t>=lt){a=kfs[i];b=kfs[i+1];break;}
    }
    const pct = (lt-a.t)/(b.t-a.t);
    const e = pct; // linear for now; ease-in-out could be added
    c._kf = {
      x: lerp(a.x,b.x,e), y: lerp(a.y,b.y,e),
      scale: lerp(a.scale,b.scale,e),
      rot: lerp(a.rot,b.rot,e),
      opacity: lerp(a.opacity,b.opacity,e),
      size: lerp(a.size,b.size,e),
    };
  }
}
function applyKF(c,k){ c._kf={x:k.x,y:k.y,scale:k.scale,rot:k.rot,opacity:k.opacity,size:k.size}; }
function lerp(a,b,t){return a+(b-a)*t;}
function drawKeyframeMarkers(){
  // Draw small diamonds on playhead if keyframe at playhead
  const c=selected();if(!c||!c.keyframes)return;
}

// ============================================================
// Import
// ============================================================
function setupImport(){
  const modal = $('#importModal');
  $('#closeImport').addEventListener('click',()=>closeImport());
  // Click on backdrop closes
  modal.addEventListener('click', e => { if (e.target === modal) closeImport(); });
  // Hook all file inputs
  const hookInput = (id, type) => {
    const inp = $(id);
    inp.addEventListener('change', async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      for (const f of files) await addFile(f, type);
      renderLib();
      toast(`Added ${files.length} file(s)`);
      // Auto close after import
      closeImport();
      // Reset so same file can be reselected
      inp.value = '';
    });
  };
  hookInput('#importVideo','video');
  hookInput('#importImage','image');
  hookInput('#importAudio','audio');
  $('#addSample').addEventListener('click',()=>{
    const c=makeWelcome(getNextInsert(),getNextInsert()+8);
    S.clips.push(c);
    renderTimeline();render();updatePlayheadUI();saveHistory();
    toast('Sample added');
    closeImport();
  });
}
function closeImport(){ $('#importModal').classList.add('hidden'); }
function doFiles(list,type){const files=[...list];(async()=>{for(const f of files) await addFile(f,type);renderLib();toast(`Added ${files.length}`);})();}
function addFile(file,type){
  return new Promise((resolve)=>{
    const src=URL.createObjectURL(file);
    const entry={id:uid(),type,src,name:file.name};
    let el;
    if (type==='video') {
      el = document.createElement('video');
      el.muted = true; el.playsInline = true; el.preload = 'auto';
      el.setAttribute('playsinline',''); el.setAttribute('webkit-playsinline','');
      el.crossOrigin = 'anonymous';
    } else if (type==='audio') {
      el = document.createElement('audio');
      el.preload = 'auto';
    } else {
      el = new Image();
    }
    entry.mediaEl = el;
    const finalize = () => {
      entry.duration = el.duration || (type==='image'?5:5);
      entry.mediaDur = entry.duration;
      if (type==='video') S.videoEls.set(entry.id, el);
      else if (type==='image') S.imageEls.set(entry.id, el);
      else S.audioEls.set(entry.id, el);
      entry.thumb = type==='image'?src:'';
      S.mediaLib.push(entry);
      addClip(entry.id, getNextInsert());
      renderTimeline();
      updatePlayheadUI();
      render();
      saveHistory();
      // Generate video thumbnail after a tick
      if (type==='video') {
        setTimeout(()=>{
          try {
            const c=document.createElement('canvas'); c.width=120; c.height=Math.round(120*9/16);
            const cx=c.getContext('2d');
            cx.drawImage(el,0,0,c.width,c.height);
            entry.thumb=c.toDataURL('image/jpeg',0.7);
            renderLib();
          } catch(e){}
        }, 300);
      }
      resolve(entry);
    };
    // Listen for multiple events to be safe across browsers
    let settled = false;
    const onReady = () => { if (settled) return; settled=true; finalize(); };
    el.addEventListener('loadedmetadata', onReady, {once:true});
    el.addEventListener('loadeddata', onReady, {once:true});
    el.addEventListener('canplay', onReady, {once:true});
    // Safety timeout
    setTimeout(()=>{ if(!settled) onReady(); }, 4000);
    // Assign src after hooking listeners (for images that load synchronously)
    el.src = src;
    if (type==='image' && el.complete) onReady();
    // Trigger load for images
    if (type==='image') el.src = src;
  });
}
function renderLib(){
  const lib=$('#mediaLibrary');lib.innerHTML='';
  S.mediaLib.forEach(m=>{const it=document.createElement('div');it.className='media-lib-item';it.innerHTML=(m.thumb?`<img src="${m.thumb}" style="width:100%;height:100%;object-fit:cover">`:`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:22px">${m.type==='audio'?'♪':'▣'}</div>`)+`<div class="lib-label">${escapeHtml(m.name)}</div><div class="lib-badge">${m.type}</div><button class="add-to-timeline">+</button>`;$('.add-to-timeline',it).addEventListener('click',e=>{e.stopPropagation();addClip(m.id,getNextInsert());render();renderTimeline();saveHistory();});lib.appendChild(it);});
}
function addClip(mid,start){const m=S.mediaLib.find(x=>x.id===mid);if(!m)return;let c;if(m.type==='video')c=installClip({id:uid(),type:'video',mediaId:mid,name:m.name,start,end:start+(m.duration||5),offset:0,mediaDur:m.duration||5,z:1,filters:{},speed:1,volume:1,opacity:1,scale:1,rotation:0,x:0.5,y:0.5});else if(m.type==='image')c=installClip({id:uid(),type:'overlay-img',mediaId:mid,name:m.name,start,end:start+4,offset:0,mediaDur:9999,z:3,filters:{},opacity:1,scale:0.5,rotation:0,x:0.5,y:0.5});else if(m.type==='audio')c=installClip({id:uid(),type:'audio',mediaId:mid,name:m.name,start,end:start+(m.duration||5),offset:0,mediaDur:m.duration||5,z:0,speed:1,volume:1,fadeIn:0,fadeOut:0});if(c)S.clips.push(c);}
function getNextInsert(){let t=0;for(const c of S.clips)if(c.type!=='text'&&c.type!=='audio')t=Math.max(t,c.end);return t;}
function makeWelcome(s,e){return installClip({id:uid(),type:'procedural',name:'Welcome',start:s,end:e,offset:0,mediaDur:e-s,z:1,filters:{},speed:1,volume:1,opacity:1,scale:1,rotation:0,x:0.5,y:0.5});}
function addWelcomeClip(){S.clips.push(makeWelcome(0,10));}

// ============================================================
// Text modal (advanced)
// ============================================================
function setupTextModal(){
  $('#closeText').addEventListener('click',()=>{$('#textModal').classList.add('hidden');S.editingTextClip=null;});
  $('#textModal').addEventListener('click',e=>{if(e.target.id==='textModal')$('#textModal').classList.add('hidden');});
  $('#addTextBtn').addEventListener('click',()=>{if(S.editingTextClip)updateText();else addText();});
  // Tabs
  $$('.ttab').forEach(b=>b.addEventListener('click',()=>{$$('.ttab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.ttab-panel').forEach(p=>p.classList.add('hidden'));$('#ttab-'+b.dataset.ttab).classList.remove('hidden');}));
  // Build font grid
  const fg=$('#fontGrid');fg.innerHTML='';
  TEXT_FONTS.forEach(f=>{const el=document.createElement('div');el.className='font-item';el.style.fontFamily=f.css;el.textContent=f.name;el.dataset.css=f.css;el.addEventListener('click',()=>{$$('.font-item').forEach(x=>x.classList.remove('active'));el.classList.add('active');S.textDraft.fontCss=f.css;S.textDraft.font=f.name;});fg.appendChild(el);});
  // Animations
  buildAnimList('animIn', TEXT_ANIMATIONS_IN);
  buildAnimList('animOut', TEXT_ANIMATIONS_OUT);
  buildAnimList('animLoop', TEXT_ANIMATIONS_LOOP);
  // Effects
  const eg=$('#textEffectGrid');eg.innerHTML='';
  TEXT_EFFECTS.forEach(e=>{const b=document.createElement('div');b.className='effect-chip';b.textContent=e.name;b.addEventListener('click',()=>{$$('.effect-chip',eg).forEach(x=>x.classList.remove('active'));b.classList.add('active');S.textDraft.effectCss=e.css;});eg.appendChild(b);});
  // Bubbles
  const bg=$('#bubbleGrid');bg.innerHTML='';
  TEXT_BUBBLES.forEach(b=>{const el=document.createElement('div');el.className='bubble-chip';el.textContent=b;el.addEventListener('click',()=>{$$('.bubble-chip',bg).forEach(x=>x.classList.remove('active'));el.classList.add('active');S.textDraft.bubble=b;});bg.appendChild(el);});
  // Bold/Italic/Underline/Align
  $('#ttab-style .mini-btn').forEach(b=>b.addEventListener('click',()=>{const w=b.dataset.weight;if(w==='left'||w==='center'||w==='right')S.textDraft.align=w;else S.textDraft[w]=!S.textDraft[w];b.classList.toggle('active');}));
  // Presets
  const presets=['Title','Subtitle','Caption','Quote','Neon','Retro','Minimal','Animated'];
  const tp=$('#textPresets');tp.innerHTML='';
  presets.forEach((p,i)=>{const el=document.createElement('div');el.className='text-preset'+(i===0?' active':'');el.textContent=p;el.addEventListener('click',()=>{$$('.text-preset').forEach(x=>x.classList.remove('active'));el.classList.add('active');applyTextPreset(p);});tp.appendChild(el);});
}
function buildAnimList(id, list){
  const wrap=$('#'+id);
  list.forEach(n=>{const b=document.createElement('button');b.type='button';b.className='anim-chip';b.textContent=n;b.addEventListener('click',()=>{$$('.anim-chip',wrap).forEach(x=>x.classList.remove('active'));b.classList.add('active');S.textDraft[id==='animIn'?'animIn':id==='animOut'?'animOut':'animLoop']=n;});wrap.appendChild(b);});
}
function applyTextPreset(p){
  const sets={Title:{size:64,bold:true,strokeW:2,color:'#fff'},Subtitle:{size:36,strokeW:0,color:'#fff'},Caption:{size:24,strokeW:2,color:'#fff'},Quote:{size:32,italic:true,color:'#ffe08a'},Neon:{size:50,color:'#3df2b2',effectCss:'text-shadow:0 0 8px currentColor,0 0 16px currentColor,0 0 32px currentColor;'},Retro:{size:44,color:'#ffb347',fontCss:'Impact, sans-serif'},Minimal:{size:34,color:'#fff'},Animated:{size:50,animIn:'Pop In',animLoop:'Pulse',color:'#fff'}};
  const s=sets[p]||sets.Title;
  Object.assign(S.textDraft,s);
  $('#textSize').val=s.size||38;
  $('#textColor').val(s.color||'#fff');
  $('#textStrokeW').val(s.strokeW||0);
}
function openTextModal(preset){S.textDraft={bold:true,size:38,color:'#fff',stroke:'#000',strokeW:0,opacity:1,animIn:'Fade In',animOut:'None',animLoop:'None',animDur:0.6,fontCss:'sans-serif'};S.editingTextClip=null;$('#textInput').value='';$('#addTextBtn').textContent='Add to Timeline';$('#textModal').classList.remove('hidden');if(preset)applyTextPreset(preset);setTimeout(()=>$('#textInput').focus(),200);}
function openTextFor(c){openTextModal();S.editingTextClip=c;$('#textInput').value=c.text||'';$('#textSize').val=c.size||38;$('#textColor').val=c.color||'#fff';$('#textStroke').val=c.stroke||'#000';$('#textStrokeW').val=c.strokeW||0;$('#textOpacity').val=c.opacity??1;$('#textDur').value=c.duration();$('#textSpacing').val=c.letterSpacing||0;$('#textShadowBlur').val=c.shadowBlur||0;S.textDraft={...c};$('#addTextBtn').textContent='Update';}
function readTextDraft(){
  S.textDraft.text = $('#textInput').value.trim();
  S.textDraft.size = Number($('#textSize').value);
  S.textDraft.color = $('#textColor').value;
  S.textDraft.stroke = $('#textStroke').value;
  S.textDraft.strokeW = Number($('#textStrokeW').value);
  S.textDraft.shadowBlur = Number($('#textShadowBlur').value);
  S.textDraft.shadow = $('#textShadow').value;
  S.textDraft.letterSpacing = Number($('#textSpacing').value);
  S.textDraft.opacity = Number($('#textOpacity').value);
  S.textDraft.dur = Number($('#textDur').value);
  S.textDraft.animDur = Number($('#animDur').value);
}
function addText(){readTextDraft();if(!S.textDraft.text){toast('Enter text');return;}
  const d=S.textDraft;
  const c=installClip({id:uid(),type:'text',text:d.text,fontCss:d.fontCss,size:d.size,color:d.color,stroke:d.stroke,strokeW:d.strokeW,shadow:d.shadow,shadowBlur:d.shadowBlur,letterSpacing:d.letterSpacing,opacity:d.opacity,bold:d.bold,italic:d.italic,underline:d.underline,align:d.align,animIn:d.animIn,animOut:d.animOut,animLoop:d.animLoop,animDur:d.animDur,effectCss:d.effectCss,bubble:d.bubble,start:S.playhead,end:S.playhead+d.dur,offset:0,mediaDur:d.dur,z:10,x:0.5,y:0.35});
  S.clips.push(c);$('#textModal').classList.add('hidden');renderTimeline();render();saveHistory();toast('Text added — drag to position');}
function updateText(){readTextDraft();const c=S.editingTextClip;if(!c)return;Object.assign(c,S.textDraft,{text:S.textDraft.text});c.end=c.start+S.textDraft.dur;$('#textModal').classList.add('hidden');S.editingTextClip=null;render();renderTimeline();saveHistory();toast('Updated');}

// ============================================================
// Preset modal
// ============================================================
function setupPresetModal(){
  const modal = $('#presetModal');
  $('#closePreset').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden');});
  $('#importPreset').addEventListener('change',e=>{const f=e.target.files[0];if(f)importPresetFile(f);e.target.value='';});
  $('#exportPreset').addEventListener('click',exportCurrentAsPreset);
  $('#applyPreset').addEventListener('click',()=>{const c=selected();if(!c||!S._activePreset){toast('Pick a preset first');return;}if(S._activePreset.filters)c.filters={...S._activePreset.filters};render();saveHistory();toast('Preset applied');});
}
function openPresetModal(){
  $('#presetModal').classList.remove('hidden');
  const list=$('#presetList');list.innerHTML='';
  const all=[...BUILTIN_PRESETS,...loadUserPresets()];
  all.forEach(p=>{const el=document.createElement('div');el.className='preset-item';el.innerHTML=`<strong>${escapeHtml(p.name)}</strong><button class="mini-btn">Apply</button>`;$('button',el).addEventListener('click',()=>{const c=selected();if(!c){toast('Select a clip first');return;}if(p.data.filters)c.filters={...p.data.filters};S._activePreset=p.data;render();saveHistory();toast(`Applied "${p.name}"`);});list.appendChild(el);});
}
function importPresetFile(file, fromHome){
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);const user=loadUserPresets();user.push({name:d.name||'Imported',data:d});saveUserPresets(user);toast('Preset imported');if(fromHome)buildHome();else openPresetModal();}catch(e){toast('Invalid preset file');}};
  r.readAsText(file);
}
function exportCurrentAsPreset(){
  const c=selected();if(!c){toast('Select a clip first');return;}
  const name=prompt('Preset name:','My Preset');if(!name)return;
  const data={name,filters:c.filters||{},textStyle:c.type==='text'?{size:c.size,color:c.color,fontCss:c.fontCss}:null};
  const user=loadUserPresets();user.push({name,data});saveUserPresets(user);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${name.replace(/\s+/g,'_')}.kcpreset`;a.click();URL.revokeObjectURL(url);
  toast('Preset saved & downloaded');openPresetModal();
}

// ============================================================
// Export (up to 4K)
// ============================================================
function setupExportModal(){
  const modal = $('#exportModal');
  $('#btnExport').addEventListener('click',()=>modal.classList.remove('hidden'));
  $('#closeExport').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden');});
  $('#startExport').addEventListener('click',doExport);
}
async function doExport(){
  const res=Number($('#expRes').value),fps=Number($('#expFPS').value),br=Number($('#expBitrate').value),wm=$('#expWM').value;
  $('#expProgress').classList.remove('hidden');$('#expResult').classList.add('hidden');$('#startExport').disabled=true;
  const eW=Math.round(res*9/16),eH=res;
  const oW=canvas.width,oH=canvas.height,oDW=canvas._w,oDH=canvas._h;
  canvas.width=eW;canvas.height=eH;canvas._w=eW;canvas._h=eH;
  overlay.style.width=eW+'px';overlay.style.height=eH+'px';overlay.style.left=0;overlay.style.top=0;
  const cStream=canvas.captureStream(fps);
  initAudio();
  const dest=S.audioCtx.createMediaStreamDestination();
  const nodes=[];
  for(const clip of S.clips){
    if(clip.type!=='audio'&&clip.type!=='video')continue;
    const el=S.videoEls.get(clip.mediaId)||S.audioEls.get(clip.mediaId);if(!el)continue;
    try{const src=S.audioCtx.createMediaElementSource(el);const g=S.audioCtx.createGain();g.gain.value=0;src.connect(g).connect(dest);nodes.push({el,src,g,clip});}catch(e){}
  }
  const tracks=[...cStream.getVideoTracks(),...dest.stream.getAudioTracks()].filter(Boolean);
  const combined=new MediaStream(tracks);
  let mime='';for(const m of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'])if(MediaRecorder.isTypeSupported(m)){mime=m;break;}
  const rec=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:br,audioBitsPerSecond:128000});
  const chunks=[];
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=()=>{
    const blob=new Blob(chunks,{type:mime||'video/webm'});const url=URL.createObjectURL(blob);
    $('#exportPreview').src=url;$('#downloadBtn').href=url;$('#downloadBtn').download=`kriticut_${res}p_${Date.now()}.webm`;
    $('#expResult').classList.remove('hidden');$('#expProgress').classList.add('hidden');$('#startExport').disabled=false;
    canvas.width=oW;canvas.height=oH;canvas._w=oDW;canvas._h=oDH;overlay.style.width=oDW+'px';overlay.style.height=oDH+'px';resizeCanvas();render();toast('Export complete!');
    nodes.forEach(({src,g})=>{try{src.disconnect();g.disconnect();}catch(e){}});
  };
  rec.start(100);
  S.playhead=0;pause();
  const t0=performance.now(),a0=S.audioCtx.currentTime;
  nodes.forEach(({el,g,clip})=>{
    el.currentTime=clamp(clip.offset,0,Math.max(0.05,(clip.mediaDur||clip.duration())-0.1));
    el.playbackRate=clip.speed||1;
    g.gain.cancelScheduledValues(a0);g.gain.setValueAtTime(0,a0);g.gain.setValueAtTime(0,a0+clip.start);
    g.gain.linearRampToValueAtTime(clip.volume??1,a0+clip.start+(clip.fadeIn||0)+0.02);
    const endT=clip.end,fo=clip.fadeOut||0;
    if(fo>0&&endT-fo>clip.start){g.gain.setValueAtTime(clip.volume??1,a0+endT-fo);g.gain.linearRampToValueAtTime(0,a0+endT);}
    try{el.play();}catch(e){}setTimeout(()=>{try{el.pause();}catch(e){}},(endT+0.3)*1000);
  });
  const totalD=totalDur();
  const tick=()=>{
    const el=(performance.now()-t0)/1000;S.playhead=Math.min(el,totalD);render();updatePlayheadUI();
    const p=S.playhead/totalD*100;$('#expFill').style.width=p+'%';
    $('#expStatus').textContent=`Exporting ${res}p… ${p.toFixed(0)}% ${fmtTime(S.playhead)}/${fmtTime(totalD)}`;
    if(S.playhead>=totalD){rec.stop();nodes.forEach(({el})=>{try{el.pause();}catch(e){}});
      // Draw watermark if requested
      if(wm!=='0'){
        ctx.save();ctx.resetTransform?ctx.resetTransform():ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='bold 24px sans-serif';ctx.textAlign='right';
        ctx.fillText('KritiCut',eW-20,eH-20);ctx.restore();
      }
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ============================================================
// History
// ============================================================
function saveHistory(){
  S.history=S.history.slice(0,S.historyIdx+1);
  const snap=S.clips.map(c=>{const x={...c};delete x.duration;delete x._kf;return x;});
  S.history.push(JSON.stringify({clips:snap,playhead:S.playhead}));
  if(S.history.length>50)S.history.shift();
  S.historyIdx=S.history.length-1;updateUR();
}
function undo(){if(S.historyIdx>0){S.historyIdx--;loadHist();toast('Undo');}}
function redo(){if(S.historyIdx<S.history.length-1){S.historyIdx++;loadHist();toast('Redo');}}
function loadHist(){const s=JSON.parse(S.history[S.historyIdx]);S.clips=s.clips.map(c=>installClip(c));S.playhead=s.playhead;S.selId=null;stopPlayback();renderTimeline();render();updatePlayheadUI();updateUR();hideClipPanel();}
function updateUR(){$('#btnUndo').disabled=S.historyIdx<=0;$('#btnRedo').disabled=S.historyIdx>=S.history.length-1;}
function setupUndoRedo(){$('#btnUndo').addEventListener('click',undo);$('#btnRedo').addEventListener('click',redo);updateUR();}

// ============================================================
// Keyboard
// ============================================================
function setupKeyboard(){
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select,[contenteditable]'))return;
    if(e.code==='Space'){e.preventDefault();togglePlay();}
    else if(e.code==='KeyS')splitAtPlayhead();
    else if((e.code==='Delete'||e.code==='Backspace')&&S.selId){e.preventDefault();deleteSel();}
    else if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();}
    else if(e.code==='ArrowLeft'){pause();S.playhead=Math.max(0,S.playhead-(e.shiftKey?1:0.1));updatePlayheadUI();render();}
    else if(e.code==='ArrowRight'){pause();S.playhead=Math.min(totalDur(),S.playhead+(e.shiftKey?1:0.1));updatePlayheadUI();render();}
    else if(e.code==='Escape')deselect();
  });
}

})();
