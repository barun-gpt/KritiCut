/* ============================================================
   KritiCut v2.1 — offline-first mobile video editor
   Single-page canvas editor. No build step, no framework.
   ============================================================ */
(() => {
'use strict';

/* ---------------- helpers ---------------- */
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => 'id' + Math.random().toString(36).slice(2, 9);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = s => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const toast = msg => {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
};
const installClip = c => {
  Object.defineProperty(c, 'duration', {
    value: function () { return Math.max(0, this.end - this.start); },
    writable: true, configurable: true, enumerable: false
  });
  return c;
};
const serializeClip = c => {
  const o = {};
  for (const k in c) {
    if (k === '_kf' || k === 'duration') continue;
    if (typeof c[k] === 'function') continue;
    o[k] = c[k];
  }
  return o;
};
const readNum = (key, fallback) => {
  try {
    const n = parseFloat(localStorage.getItem(key));
    return Number.isFinite(n) ? n : fallback;
  } catch (e) { return fallback; }
};
const writeLS = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (e) {} };
const removeLS = key => { try { localStorage.removeItem(key); } catch (e) {} };

const ASPECTS = Object.freeze({ '9:16': 9 / 16, '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5 });
const TL_MIN = 240;
const MAX_HISTORY = 50;

/* ---------------- state ---------------- */
const screenH = window.innerHeight || 800;
const S = {
  clips: [],
  mediaLib: [],
  selId: null,
  playhead: 0,
  playing: false,
  exporting: false,
  zoom: 1,
  pxPerSec: 60,
  aspect: '9:16',
  projectName: 'My Project',
  tab: 'edit',
  tlHeight: clamp(readNum('kc_tlh', 250), TL_MIN, Math.min(600, Math.round(screenH * 0.65))),
  history: [],
  historyIdx: -1,

  videoEls: new Map(),
  imageEls: new Map(),
  audioEls: new Map(),
  audioCtx: null,
  master: null,
  sources: new Map(),
  activeAudio: new Map(),
  primed: new WeakSet(),

  playWall: 0,
  playStart: 0,
  editingTextClip: null,
  textDraft: {},
  textEls: new Map(),

  exportWM: false,
  exportDest: null,
  exportScale: 1,
  exportActive: false,
  exportCancelled: false,
  lastExport: null,

  _dirtyT: null,
  _saveChain: Promise.resolve(),
  _storageWarned: false,
  _restoring: false,
  _importing: false,
  _openingDraft: false,
  _noAutoScroll: false,
  _homeBound: false,
  _dragBound: false,
  _exportStartedAt: 0,
  _exportPrev: null,
  _welcomeId: null,
  _rec: null,
};

/* ---------------- DOM ---------------- */
const canvas = $('#previewCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const overlay = $('#overlayLayer');
const editorScreen = $('#editorScreen');
const homeScreen = $('#homeScreen');

/* ---------------- boot ---------------- */
function boot() {
  try {
    init();
    S._booted = true;
  } catch (err) {
    console.error('KritiCut init error:', err);
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:#ff5470;color:#fff;padding:14px;border-radius:10px;z-index:99999;font-size:13px;font-family:monospace;box-shadow:0 8px 24px rgba(0,0,0,.5)';
    el.textContent = 'KritiCut could not start: ' + (err && err.message ? err.message : err);
    document.body.appendChild(el);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 20), { once: true });
} else {
  setTimeout(boot, 20);
}

window.addEventListener('unhandledrejection', e => console.warn('KritiCut async error:', e.reason));

function init() {
  buildHome();
  setupModals();
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
  attachOverlayDrag();
  updateUR();
  window.addEventListener('pagehide', () => { saveDraft().catch(() => {}); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDraft().catch(() => {});
  });
  registerServiceWorker();
}

/* ---------------- home ---------------- */
function buildHome() {
  if (!S._homeBound) {
    $('#btnNewProject').addEventListener('click', () => {
      startNewProject({ welcome: true });
      toast('New project — tap Import to add media');
    });
    $('#btnOpenProject').addEventListener('click', openDraft);
    $('#btnImportPresetHome').addEventListener('click', () => $('#homePresetFile').click());
    $('#homePresetFile').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (f) importPresetFile(f, true);
      e.target.value = '';
    });
    S._homeBound = true;
  }
  refreshHome();
}

function refreshHome() {
  const tg = $('#templateGrid');
  tg.innerHTML = '';
  (window.TEMPLATES || []).forEach(t => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'template-card';
    el.style.background = t.color;
    el.innerHTML = `<span class="tpl-tag">${esc(t.tag)}</span><span class="tpl-name">${esc(t.name)}</span><span class="tpl-use">Use</span>`;
    el.addEventListener('click', () => {
      startNewProject({ welcome: true, filters: t.preset && t.preset.filters });
      toast(`Template “${t.name}” applied — add your media`);
    });
    tg.appendChild(el);
  });

  const pc = $('#homePresetChips');
  pc.innerHTML = '';
  const presets = [...(window.BUILTIN_PRESETS || []), ...loadUserPresets()];
  if (!presets.length) {
    pc.innerHTML = '<span class="panel-hint">No presets yet — save one from a clip.</span>';
  }
  presets.forEach(p => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.innerHTML = `<span class="chip-preview" style="background:linear-gradient(135deg,#4ea8ff,#25c38e)"></span>${esc(p.name)}`;
    c.addEventListener('click', () => {
      startNewProject({ welcome: true, filters: p.data && sanitizeFilters(p.data.filters) });
      toast(`Preset “${p.name}” loaded`);
    });
    pc.appendChild(c);
  });
}

function startNewProject(opts = {}) {
  resetEditor({
    name: opts.name || 'My Project',
    aspect: opts.aspect || '9:16'
  });
  S._welcomeId = null;
  if (opts.welcome !== false) {
    const w = makeWelcome(0, 10, true);
    if (opts.filters) w.filters = { ...opts.filters };
    S.clips.push(w);
    S._welcomeId = w.id;
  }
  S.history = [];
  S.historyIdx = -1;
  saveHistory();
  showEditor();
  queueSave();
  // The previous project's media blobs are no longer referenced by the draft.
  queueSave().then(() => {
    if (!S.mediaLib.length && !S._importing && !S._restoring) cleanupOrphanMedia(new Set()).catch(() => {});
  }).catch(() => {});
}

function resetEditor(opts = {}) {
  stopPlayback();
  S.clips = [];
  clearMediaLibrary();
  S.selId = null;
  S._welcomeId = null;
  S.playhead = 0;
  S.zoom = 1;
  S.pxPerSec = 60;
  S.aspect = ASPECTS[opts.aspect] ? opts.aspect : '9:16';
  S.projectName = opts.name || 'My Project';
  S.history = [];
  S.historyIdx = -1;
  S.tab = 'edit';
  S.editingTextClip = null;
  clearTextElements();
  const inline = $('#inlinePanel');
  if (inline) inline.remove();
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'edit'));
  hideClipPanel();
  const scroller = $('#timelineScroll');
  if (scroller) scroller.scrollLeft = 0;
  const nameEl = $('#projectName');
  if (nameEl) nameEl.textContent = S.projectName;
  const aspectEl = $('#aspectSelect');
  if (aspectEl) aspectEl.value = S.aspect;
  $('#zoomVal').textContent = S.zoom.toFixed(1) + '×';
  $('#expResult').classList.add('hidden');
  $('#exportPreview').removeAttribute('src');
  if (S.lastExport && S.lastExport.url) {
    try { URL.revokeObjectURL(S.lastExport.url); } catch (e) {}
  }
  S.lastExport = null;
  const dl = $('#downloadBtn');
  if (dl) dl.removeAttribute('href');
}

function showHome() {
  saveDraft().catch(() => {});
  stopPlayback();
  editorScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  refreshHome();
}

function showEditor() {
  homeScreen.classList.add('hidden');
  editorScreen.classList.remove('hidden');
  $('#projectName').textContent = S.projectName;
  $('#aspectSelect').value = S.aspect;
  const zv = $('#zoomVal');
  if (zv) zv.textContent = S.zoom.toFixed(1) + '×';
  setTab(S.tab || 'edit');
  requestAnimationFrame(() => {
    resizeCanvas();
    renderTimeline();
    updatePlayheadUI();
    render();
  });
  setTimeout(() => { resizeCanvas(); renderTimeline(); }, 120);
}

function clearTextElements() {
  for (const el of S.textEls.values()) el.remove();
  S.textEls.clear();
}

/* ---------------- media library primitives ---------------- */
function clearMediaLibrary() {
  for (const m of S.mediaLib) {
    if (m.src) { try { URL.revokeObjectURL(m.src); } catch (e) {} }
  }
  S.mediaLib = [];
  S.videoEls.clear();
  S.imageEls.clear();
  S.audioEls.clear();
  S.sources.clear();
  S.activeAudio.clear();
  const lib = $('#mediaLibrary');
  if (lib) lib.innerHTML = '';
}

function makeWelcome(s = 0, e = 10, starter = false) {
  return installClip({
    id: uid(), type: 'procedural', name: 'Welcome', start: s, end: e,
    offset: 0, mediaDur: e - s, z: 1, filters: {}, speed: 1, volume: 1,
    opacity: 1, scale: 1, rotation: 0, x: 0.5, y: 0.5,
    starter: !!starter
  });
}

function takeWelcomePlaceholder() {
  const id = S._welcomeId;
  S._welcomeId = null;
  if (!id) return null;
  const w = S.clips.find(c => c.id === id);
  if (!w || w.type !== 'procedural') return null;
  S.clips = S.clips.filter(c => !(c.type === 'procedural' && c.starter));
  return w;
}

function getNextInsert() {
  let t = 0;
  for (const c of S.clips) {
    if (c.type === 'text' || c.type === 'audio' || c.type === 'overlay-img') continue;
    t = Math.max(t, c.end);
  }
  return t;
}

function totalDur() {
  let d = 0;
  for (const c of S.clips) {
    if (Number.isFinite(c.end)) d = Math.max(d, c.end);
  }
  return Math.max(1, d);
}

function selected() { return S.clips.find(c => c.id === S.selId) || null; }

/* ---------------- IndexedDB persistence ---------------- */
const DB_NAME = 'kriticut-db';
const DB_STORE = 'kv';
let dbPromise = null;

function dbOpen() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB error'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch(err => { dbPromise = null; throw err; });
  return dbPromise;
}

async function dbGet(key) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(key, value) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage write aborted'));
  });
}
async function dbDel(key) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbKeys() {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function warnStorage(err) {
  console.warn('KritiCut storage:', err);
  if (S._storageWarned) return;
  S._storageWarned = true;
  toast('Device storage is full — drafts/videos may not be saved');
}

async function storeMediaBlob(id, blob) {
  try {
    await dbPut('media:' + id, blob);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) {
    warnStorage(e);
  }
}

async function deleteMediaBlob(id) {
  try { await dbDel('media:' + id); } catch (e) {}
}

async function cleanupOrphanMedia(keepKeys) {
  try {
    const keys = await dbKeys();
    for (const k of keys) {
      if (S._importing) return;
      if (typeof k === 'string' && k.startsWith('media:') && !keepKeys.has(k)) await dbDel(k);
    }
  } catch (e) {}
}

function markDirty() {
  if (S._restoring) return;
  clearTimeout(S._dirtyT);
  S._dirtyT = setTimeout(() => queueSave(), 700);
}

function queueSave() {
  const snapshot = {
    v: 2,
    savedAt: Date.now(),
    name: S.projectName,
    aspect: S.aspect,
    zoom: S.zoom,
    playhead: S.playhead,
    clips: S.clips.map(serializeClip),
    media: S.mediaLib.map(m => ({ id: m.id, name: m.name, type: m.type, duration: m.duration }))
  };
  S._saveChain = S._saveChain.then(async () => {
    try {
      await dbPut('draft', snapshot);
    } catch (e) {
      warnStorage(e);
    }
  }).catch(e => console.warn(e));
  return S._saveChain;
}

function saveDraft() {
  if (S._restoring) return Promise.resolve();
  return queueSave();
}

async function openDraft() {
  if (S._openingDraft) return;
  S._openingDraft = true;
  showLoading('Opening draft…');
  try {
    await S._saveChain.catch(() => {});
    const draft = await dbGet('draft');
    if (!draft) { toast('No saved draft yet'); return; }
    S._restoring = true;
    resetEditor({ name: draft.name || 'My Project', aspect: draft.aspect || '9:16' });
    S.zoom = clamp(Number(draft.zoom) || 1, 0.2, 12);
    S.pxPerSec = 60 * S.zoom;

    const media = Array.isArray(draft.media) ? draft.media : [];
    let restored = 0;
    await Promise.all(media.map(async meta => {
      try {
        const blob = await dbGet('media:' + meta.id);
        if (!blob) return;
        const entry = await restoreMediaEntry(meta, blob);
        if (entry) restored++;
      } catch (e) { console.warn('Could not restore media', meta && meta.name, e); }
    }));

    const known = new Set(S.mediaLib.map(m => m.id));
    let dropped = 0;
    S.clips = (Array.isArray(draft.clips) ? draft.clips : []).map(c => installClip({ ...c })).filter(c => {
      if (c.mediaId && !known.has(c.mediaId)) { dropped++; return false; }
      return Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start;
    });
    const starter = S.clips.find(c => c.starter && c.type === 'procedural');
    const hasVisual = S.clips.some(c => c.type === 'video' || c.type === 'image' || c.type === 'overlay-img');
    S._welcomeId = starter && !hasVisual ? starter.id : null;
    S.playhead = clamp(Number(draft.playhead) || 0, 0, totalDur());
    S.selId = null;
    S._welcomeId = null;
    S.history = [];
    S.historyIdx = -1;
    S._restoring = false;
    saveHistory();
    showEditor();
    if (dropped) toast(`Draft opened — ${dropped} clip(s) skipped (media missing)`);
    else toast(`Draft opened — ${restored} media item(s) restored`);
  } catch (e) {
    console.error(e);
    toast('Could not open the draft');
  } finally {
    S._restoring = false;
    S._openingDraft = false;
    hideLoading();
  }
}

function makeMediaElement(type, src) {
  let el;
  if (type === 'video') {
    el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
  } else if (type === 'audio') {
    el = document.createElement('audio');
    el.preload = 'auto';
  } else {
    el = new Image();
    el.decoding = 'async';
  }
  el.src = src;
  return el;
}

function whenMediaReady(el, type, timeout = 10000) {
  return new Promise(resolve => {
    let done = false;
    const finish = ok => { if (done) return; done = true; resolve(ok); };
    el.addEventListener('loadedmetadata', () => finish(true), { once: true });
    el.addEventListener('loadeddata', () => finish(true), { once: true });
    el.addEventListener('canplay', () => finish(true), { once: true });
    el.addEventListener('error', () => finish(false), { once: true });
    if (type === 'image') {
      if (el.complete && el.naturalWidth > 0) finish(true);
      else {
        el.addEventListener('load', () => finish(true), { once: true });
        el.addEventListener('error', () => finish(false), { once: true });
      }
    }
    if (type !== 'image' && el.readyState > 0) finish(true);
    setTimeout(() => finish(type === 'image' ? el.complete && el.naturalWidth > 0 : el.readyState > 0), timeout);
  });
}

async function restoreMediaEntry(meta, blob) {
  if (!meta || !blob) return null;
  const type = meta.type === 'image' || meta.type === 'audio' ? meta.type : 'video';
  const src = URL.createObjectURL(blob);
  const el = makeMediaElement(type, src);
  const ok = await whenMediaReady(el, type, 8000);
  if (!ok) { try { URL.revokeObjectURL(src); } catch (e) {} return null; }
  const duration = type === 'image' ? 5 : clamp(Number(el.duration) || Number(meta.duration) || 5, 0.2, 24 * 3600);
  const entry = {
    id: meta.id, type: meta.type, name: meta.name || 'Media', src,
    duration, mediaDur: duration, blob,
    thumb: type === 'image' ? src : ''
  };
  S.mediaLib.push(entry);
  if (type === 'video') S.videoEls.set(entry.id, el);
  else if (type === 'image') S.imageEls.set(entry.id, el);
  else S.audioEls.set(entry.id, el);
  if (type === 'video') setTimeout(() => makeVideoThumb(el, entry), 250);
  renderLib();
  return entry;
}

/* ---------------- loading overlay ---------------- */
function showLoading(msg) {
  $('#loadMsg').textContent = msg || 'Loading…';
  $('#loading').classList.remove('hidden');
}
function hideLoading() { $('#loading').classList.add('hidden'); }

/* ---------------- modal plumbing ---------------- */
function setupModals() {
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });
  $$('.close-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      closeModal(b.closest('.modal'));
    });
  });
}

function closeModal(modal) {
  if (!modal) return;
  if (modal.id === 'exportModal' && S.exportActive) { toast('Export is still running'); return; }
  if (modal.id === 'textModal') { hideTextModal(); return; }
  modal.classList.add('hidden');
}

function openImport() {
  pause();
  delete $('#importImage').dataset.overlay;
  renderLib();
  $('#importModal').classList.remove('hidden');
}

/* ---------------- editor chrome ---------------- */
function setupEditorChrome() {
  $('#btnHome').addEventListener('click', showHome);
  $('#btnPreset').addEventListener('click', openPresetModal);
  $('#btnAdd').addEventListener('click', openImport);
  $('#btnSplit').addEventListener('click', splitAtPlayhead);
  $('#btnDelete').addEventListener('click', deleteSelected);
  $('#btnDuplicate').addEventListener('click', duplicateSelected);
  $('#btnKeyframe').addEventListener('click', addKeyframeAtPlayhead);

  const nameEl = $('#projectName');
  const commitName = () => {
    const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'My Project';
    if (nameEl.textContent !== name) nameEl.textContent = name;
    if (name !== S.projectName) {
      S.projectName = name;
      markDirty();
    }
  };
  nameEl.addEventListener('blur', commitName);
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
  });
  nameEl.addEventListener('input', () => {
    if (nameEl.textContent.length > 60) nameEl.textContent = nameEl.textContent.slice(0, 60);
  });
  nameEl.addEventListener('paste', e => {
    e.preventDefault();
    const text = ((e.clipboardData || window.clipboardData) || {}).getData
      ? (e.clipboardData || window.clipboardData).getData('text/plain')
      : '';
    document.execCommand('insertText', false, String(text || '').slice(0, 60));
  });

  $('#aspectSelect').addEventListener('change', e => setAspect(e.target.value));
}

function setAspect(aspect) {
  if (!ASPECTS[aspect]) aspect = '9:16';
  S.aspect = aspect;
  $('#aspectSelect').value = aspect;
  resizeCanvas();
  renderTimeline();
  updatePlayheadUI();
  markDirty();
}

/* ---------------- canvas sizing + render loop ---------------- */
function setupCanvas() {
  requestAnimationFrame(function tick(now) {
    try {
      if (S.exporting) {
        updateExportProgress(now);
      } else if (S.playing) {
        S.playhead = S.playStart + (now - S.playWall) / 1000;
        const d = totalDur();
        if (S.playhead >= d) {
          S.playhead = d;
          pause();
        } else {
          syncMediaPlayback(S.playhead);
          updatePlayheadUI();
        }
      }
      render();
    } catch (e) {
      console.error('KritiCut render error:', e);
    }
    requestAnimationFrame(tick);
  });

  if (window.ResizeObserver) {
    let queued = false;
    const ro = new ResizeObserver(() => {
      if (queued || S.exporting) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!editorScreen.classList.contains('hidden')) resizeCanvas();
      });
    });
    ro.observe($('#previewWrap'));
  }
  window.addEventListener('resize', () => { if (!S.exporting) resizeCanvas(); });
}

function resizeCanvas() {
  if (S.exporting) return;
  if (editorScreen.classList.contains('hidden')) return;
  const wrap = $('#previewWrap');
  const r = wrap.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const ar = ASPECTS[S.aspect] || 9 / 16;
  let w = r.width * 0.94;
  let h = w / ar;
  if (h > r.height * 0.94) {
    h = r.height * 0.94;
    w = h * ar;
  }
  w = Math.max(40, Math.round(w));
  h = Math.max(40, Math.round(h));
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.max(2, Math.round(w * dpr));
  canvas.height = Math.max(2, Math.round(h * dpr));
  canvas._w = w;
  canvas._h = h;
  overlay.style.width = w + 'px';
  overlay.style.height = h + 'px';
  overlay.style.left = Math.round((r.width - w) / 2) + 'px';
  overlay.style.top = Math.round((r.height - h) / 2) + 'px';
  render();
}

/* ---------------- rendering ---------------- */
function render() {
  if (!canvas.width || !canvas.height) return;
  if (editorScreen.classList.contains('hidden')) return;
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if ('filter' in ctx) ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const t = S.playhead;
  const ar = ASPECTS[S.aspect] || 9 / 16;
  let dw, dh, ox, oy;
  if (W / H > ar) { dh = H; dw = H * ar; ox = (W - dw) / 2; oy = 0; }
  else { dw = W; dh = W / ar; ox = 0; oy = (H - dh) / 2; }

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, dw, dh);
  ctx.clip();

  applyKeyframes(t);

  const active = S.clips
    .filter(c => c.start <= t && c.end > t)
    .sort((a, b) => (a.z || 0) - (b.z || 0));

  for (const c of active) {
    if (c.type === 'video' || c.type === 'image' || c.type === 'overlay-img' || c.type === 'procedural') {
      drawMediaClip(c, t, ox, oy, dw, dh);
    }
  }
  for (const c of active) {
    if (c.filters && c.filters.vignette) drawVignette(c, ox, oy, dw, dh);
  }
  if (S.exporting) {
    drawTextClipsOnCanvas(t, ox, oy, dw, dh);
    if (S.exportWM) drawWatermark(ox, oy, dw, dh);
  }
  ctx.restore();

  if (!S.exporting) renderTextOverlays(t);
}

function buildFilterString(f, extraBlur) {
  if (!f && !extraBlur) return 'none';
  let fs = '';
  const n = v => Number.isFinite(+v);
  if (n(f.brightness)) fs += `brightness(${f.brightness}) `;
  if (n(f.contrast)) fs += `contrast(${f.contrast}) `;
  if (n(f.saturate)) fs += `saturate(${f.saturate}) `;
  if (n(f.hueRotate)) fs += `hue-rotate(${f.hueRotate}deg) `;
  if (n(f.sepia)) fs += `sepia(${f.sepia}) `;
  if (n(f.grayscale)) fs += `grayscale(${f.grayscale}) `;
  const blur = (Number(f.blurpx) || 0) + (extraBlur || 0);
  if (blur > 0) fs += `blur(${blur}px) `;
  return fs.trim() || 'none';
}

function effectVisual(c, lt) {
  switch (c.effect) {
    case 'Shake':
      return { dx: Math.sin(lt * 47) * 0.006, dy: Math.cos(lt * 39) * 0.006, rot: Math.sin(lt * 31) * 0.035, scale: 1, alpha: 1 };
    case 'Zoom In':
      return { dx: 0, dy: 0, rot: 0, scale: 1 + ((lt % 4) / 4) * 0.25, alpha: 1 };
    case 'Spin':
      return { dx: 0, dy: 0, rot: (lt % 8) / 8 * Math.PI * 2, scale: 1, alpha: 1 };
    case 'Flicker':
      return { dx: 0, dy: 0, rot: 0, scale: 1, alpha: Math.sin(lt * 25) > 0.55 ? 0.55 : 1 };
    case 'Glitch':
      return { dx: (lt % 2.3) < 0.07 ? 0.012 : 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
    case 'VHS':
      return { dx: Math.sin(lt * 23) * 0.0015, dy: 0, rot: 0, scale: 1, alpha: 1 };
    default:
      return { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
  }
}

function drawMediaClip(c, t, ox, oy, dw, dh) {
  const f = c.filters || {};
  const kf = c._kf || {};
  const scale = Number(kf.scale ?? c.scale ?? 1) || 1;
  const rot = (Number(kf.rot ?? c.rotation ?? 0) || 0) * Math.PI / 180;
  const px = clamp(Number(kf.x ?? c.x ?? 0.5), 0, 1);
  const py = clamp(Number(kf.y ?? c.y ?? 0.5), 0, 1);
  const opacity = clamp(Number(kf.opacity ?? c.opacity ?? 1), 0, 1);
  const ev = effectVisual(c, Math.max(0, (t - c.start) * (c.speed || 1) + (c.offset || 0)));
  const w = dw * scale;
  const h = dh * scale;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;

  const cx = ox + dw * px + ev.dx * dw;
  const cy = oy + dh * py + ev.dy * dh;

  ctx.save();
  ctx.globalAlpha = opacity * ev.alpha;
  if ('filter' in ctx) ctx.filter = buildFilterString(f, c.effect === 'Blur' ? 5 : 0);
  ctx.translate(cx, cy);
  ctx.rotate(rot + (ev.rot || 0));
  ctx.scale(ev.scale || 1, ev.scale || 1);
  if (c.flipX) ctx.scale(-1, 1);
  if (c.flipY) ctx.scale(1, -1);

  let el = null;
  if (c.type === 'procedural') {
    drawWelcome(c, Math.max(0, t - c.start), -w / 2, -h / 2, w, h);
  } else {
    el = c.type === 'video' ? S.videoEls.get(c.mediaId) : S.imageEls.get(c.mediaId);
    if (!el) { ctx.restore(); return; }
    const lt = (t - c.start) * (c.speed || 1) + (c.offset || 0);
    if (c.type === 'video' && !S.playing && !S.exporting) {
      const want = clamp(lt, 0, Math.max(0.05, (c.mediaDur || 1) - 0.05));
      if (Math.abs(el.currentTime - want) > 0.08) { try { el.currentTime = want; } catch (e) {} }
    }
    if (c.effect === 'Kaleido') drawKaleido(el, -w / 2, -h / 2, w, h);
    else drawFit(el, -w / 2, -h / 2, w, h);
  }

  if ('filter' in ctx) ctx.filter = 'none';
  drawWashes(f, w, h, c.overlayColor);
  drawEffectOverlay(c, Math.max(0, t - c.start), w, h);
  ctx.restore();
}

function drawFit(el, x, y, w, h) {
  const vW = el.videoWidth || el.naturalWidth || 0;
  const vH = el.videoHeight || el.naturalHeight || 0;
  if (!vW || !vH) return;
  if (el.readyState !== undefined && el.readyState < 2 && el.tagName === 'VIDEO') return;
  const a = vW / vH;
  let w2 = w, h2 = w / a;
  if (h2 < h) { h2 = h; w2 = h * a; }
  try { ctx.drawImage(el, x + (w - w2) / 2, y + (h - h2) / 2, w2, h2); } catch (e) {}
}

function drawKaleido(el, x, y, w, h) {
  const parts = [[-1, -1, 1, 1], [1, -1, -1, 1], [-1, 1, 1, -1], [1, 1, -1, -1]];
  for (const [qx, qy, mx, my] of parts) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(qx < 0 ? x : x + w / 2, qy < 0 ? y : y + h / 2, w / 2, h / 2);
    ctx.clip();
    ctx.translate(x + (qx < 0 ? w / 4 : w * 3 / 4), y + (qy < 0 ? h / 4 : h * 3 / 4));
    ctx.scale(mx, my);
    drawFit(el, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function isColor(v) {
  return typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i.test(v.trim());
}

function drawWashes(f, w, h, clipOverlayColor) {
  const overlayColor = clipOverlayColor || f.overlayColor;
  if (isColor(overlayColor)) {
    ctx.save();
    ctx.fillStyle = overlayColor;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  const warmth = Number(f.warmth) || 0;
  if (warmth) {
    ctx.save();
    ctx.fillStyle = warmth > 0 ? `rgba(255,170,60,${Math.abs(warmth) * 0.15})` : `rgba(80,150,255,${Math.abs(warmth) * 0.15})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  const tint = Number(f.tint) || 0;
  if (tint) {
    ctx.save();
    ctx.fillStyle = tint > 0 ? `rgba(255,0,120,${Math.abs(tint) * 0.1})` : `rgba(0,255,120,${Math.abs(tint) * 0.1})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  const fade = Number(f.fade) || 0;
  if (fade) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${clamp(fade, 0, 1) * 0.2})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawVignetteRect(x, y, w, h, strength) {
  const s = clamp(strength, 0, 1);
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * (0.45 - s * 0.12), x + w / 2, y + h / 2, Math.max(w, h) * (0.6 + s * 0.25));
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.25 + s * 0.5})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawVignette(c, ox, oy, dw, dh) {
  const v = clamp(Number(c.filters && c.filters.vignette) || 0, 0, 1);
  if (!v) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, dw, dh);
  ctx.clip();
  const g = ctx.createRadialGradient(ox + dw / 2, oy + dh / 2, Math.min(dw, dh) * (0.45 - v * 0.12), ox + dw / 2, oy + dh / 2, Math.max(dw, dh) * (0.6 + v * 0.25));
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.25 + v * 0.5})`);
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, dw, dh);
  ctx.restore();
}

function drawEffectOverlay(c, lt, w, h) {
  switch (c.effect) {
    case 'VHS': {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 14; i++) {
        const y = -h / 2 + ((i * 37 + lt * 60) % h);
        ctx.fillRect(-w / 2, y, w, 1 + (i % 2));
      }
      ctx.fillStyle = 'rgba(0,180,255,0.05)';
      ctx.fillRect(-w / 2, -h / 2, w * 0.35, h);
      ctx.fillStyle = 'rgba(255,0,120,0.04)';
      ctx.fillRect(w / 2 - w * 0.35, -h / 2, w * 0.35, h);
      ctx.restore();
      break;
    }
    case 'Glitch': {
      if ((lt % 2.3) < 0.09) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 4; i++) {
          const y = -h / 2 + ((i * 97 + lt * 500) % h);
          const bh = 4 + (i % 3) * 5;
          ctx.fillStyle = i % 2 ? 'rgba(255,0,128,0.22)' : 'rgba(0,255,255,0.22)';
          ctx.fillRect(-w / 2, y, w, bh);
        }
        ctx.restore();
      }
      break;
    }
    case 'Vignette': {
      drawVignetteRect(-w / 2, -h / 2, w, h, 0.55);
      break;
    }
    default: break;
  }
}

function drawWelcome(c, t, x, y, w, h) {
  const hue = (t * 25) % 360;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, `hsl(${hue},75%,55%)`);
  g.addColorStop(0.5, `hsl(${(hue + 60) % 360},75%,45%)`);
  g.addColorStop(1, `hsl(${(hue + 140) % 360},75%,35%)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `hsla(${(hue + i * 30) % 360},90%,65%,0.55)`;
    const bx = x + (Math.sin(t * 0.8 + i) * 0.5 + 0.5) * w;
    const by = y + ((t * 40 + i * 70) % h);
    ctx.beginPath();
    ctx.arc(bx, by, 15 + Math.sin(t * 2 + i) * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  const lines = ['Welcome to', 'KritiCut', 'Trim · Split · Keyframe', '4K Export · Filters', 'Templates & Presets', 'All features FREE'];
  ctx.font = `bold ${Math.round(w * 0.08)}px -apple-system,sans-serif`;
  ctx.fillText(lines[Math.floor(t / 1.8) % lines.length], x + w / 2, y + h / 2);
  ctx.font = `${Math.round(w * 0.035)}px -apple-system,sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Tap Import to add media · Text tab for titles', x + w / 2, y + h / 2 + w * 0.09);
  ctx.restore();
}

function drawWatermark(ox, oy, dw, dh) {
  ctx.save();
  const size = Math.max(14, Math.round(dw * 0.028));
  ctx.font = `bold ${size}px -apple-system,sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText('KritiCut', ox + dw - size, oy + dh - size * 0.7);
  ctx.restore();
}

/* ---------------- text on the live preview (DOM) ---------------- */
const SAFE_EFFECT_PROPS = new Set([
  'text-shadow', 'color', '-webkit-text-stroke', '-webkit-text-stroke-color', '-webkit-text-stroke-width',
  'background', 'background-image', '-webkit-background-clip', 'background-clip', '-webkit-text-fill-color',
  'filter', 'opacity', '-webkit-box-reflect'
]);

function safeEffectStyle(css) {
  const out = {};
  if (!css || typeof css !== 'string') return out;
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    if (!val || !SAFE_EFFECT_PROPS.has(prop)) continue;
    if (/url\s*\(|expression|javascript:/i.test(val)) continue;
    if (!(prop in out)) out[prop] = val;
  }
  return out;
}

function setStyles(el, styles) {
  for (const k in styles) {
    if (styles[k] == null || styles[k] === '') el.style.removeProperty(k);
    else el.style.setProperty(k, String(styles[k]));
  }
}

function bubbleStyle(bubble) {
  switch (bubble) {
    case 'Rectangle': return { background: 'rgba(0,0,0,0.65)', padding: '6px 12px', 'border-radius': '2px' };
    case 'Rounded': return { background: 'rgba(0,0,0,0.65)', padding: '6px 14px', 'border-radius': '14px' };
    case 'Pill': return { background: 'rgba(0,0,0,0.65)', padding: '6px 20px', 'border-radius': '999px' };
    case 'Cloud': return { background: '#fff', color: '#111', padding: '10px 18px', 'border-radius': '50% / 42%' };
    case 'Arrow Down': return { background: '#fff', color: '#111', padding: '6px 14px 18px', 'clip-path': 'polygon(0 0,100% 0,100% 78%,50% 100%,0 78%)' };
    case 'Arrow Up': return { background: '#fff', color: '#111', padding: '18px 14px 6px', 'clip-path': 'polygon(0 22%,50% 0,100% 22%,100% 100%,0 100%)' };
    case 'Quote': return { 'border-left': '4px solid rgba(255,255,255,0.85)', padding: '2px 0 2px 12px', 'font-style': 'italic', 'text-align': 'left' };
    case 'Callout': return { background: '#fff', color: '#111', padding: '8px 14px', 'border-radius': '14px' };
    case 'Sticker': return { background: '#fff', color: '#111', padding: '8px 14px', 'border-radius': '10px', 'box-shadow': '0 5px 14px rgba(0,0,0,0.45)' };
    case 'Neon Box': return { border: '2px solid currentColor', padding: '6px 14px', 'border-radius': '10px', 'box-shadow': '0 0 12px currentColor' };
    default: return {};
  }
}

function applyTextStyles(el, c, preview) {
  const text = preview ? (c.text || 'Your text') : (c.text || '');
  if (el.textContent !== text) el.textContent = text;
  const size = preview ? clamp(Number(c.size) || 38, 12, 46) : (Number(c.size) || 38);
  el.style.fontFamily = c.fontCss || 'sans-serif';
  el.style.fontSize = size + 'px';
  el.style.fontWeight = c.bold === false ? '500' : '800';
  el.style.fontStyle = c.italic ? 'italic' : 'normal';
  el.style.textDecoration = c.underline ? 'underline' : 'none';
  el.style.color = c.color || '#ffffff';
  el.style.textAlign = c.align || 'center';
  el.style.letterSpacing = (Number(c.letterSpacing) || 0) + 'px';
  el.style.lineHeight = String(Number(c.lineHeight) || 1.2);
  el.style.textShadow = Number(c.shadowBlur) > 0
    ? `0 0 ${Number(c.shadowBlur)}px ${c.shadow || '#000'}, 0 2px 6px rgba(0,0,0,0.6)`
    : '0 2px 6px rgba(0,0,0,0.7)';
  el.style.webkitTextStroke = Number(c.strokeW) > 0 ? `${Number(c.strokeW)}px ${c.stroke || '#000'}` : '';

  setStyles(el, {
    background: '', 'background-image': '', '-webkit-background-clip': '', 'background-clip': '',
    '-webkit-text-fill-color': '', filter: '', padding: '', 'border-radius': '', border: '',
    'box-shadow': '', 'clip-path': '', '-webkit-box-reflect': ''
  });

  setStyles(el, bubbleStyle(c.bubble));
  if (isColor(c.bg)) el.style.background = c.bg;
  else if (c.bg) el.style.removeProperty('background');
  setStyles(el, safeEffectStyle(c.effectCss));
}

function animName(name) {
  const map = {
    'Fade In': 'kc-fadein', 'Fade Out': 'kc-fadeout',
    'Pop In': 'kc-popin', 'Pop Out': 'kc-popout',
    'Slide Up': 'kc-slideup', 'Slide Up Out': 'kc-slideupout',
    'Slide Down': 'kc-slidedown', 'Slide Down Out': 'kc-slidedownout',
    'Slide Left': 'kc-slideleft', 'Slide Left Out': 'kc-slideleftout',
    'Slide Right': 'kc-slideright', 'Slide Right Out': 'kc-sliderightout',
    'Scale In': 'kc-scalein', 'Scale Out': 'kc-scaleout',
    'Blur In': 'kc-blurin', 'Blur Out': 'kc-blurout',
    'Spin In': 'kc-spinin', 'Typewriter': 'kc-typewriter',
    'Pulse': 'kc-pulse', 'Bounce': 'kc-bounce', 'Wave': 'kc-wave', 'Shake': 'kc-shake',
    'Glow': 'kc-glow', 'Rainbow': 'kc-rainbow', 'Neon Flicker': 'kc-flicker', 'Blink': 'kc-blink'
  };
  return map[name] || 'kc-fadein';
}

function renderTextOverlays(t) {
  const seen = new Set();
  for (const c of S.clips) {
    if (c.type !== 'text') continue;
    if (c.start > t || c.end <= t) continue;
    seen.add(c.id);
    let el = S.textEls.get(c.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = c.id;
      overlay.appendChild(el);
      S.textEls.set(c.id, el);
    }
    let inner = el.firstElementChild;
    if (!inner || !inner.classList.contains('kc-text-inner')) {
      el.textContent = '';
      inner = document.createElement('span');
      inner.className = 'kc-text-inner';
      el.appendChild(inner);
    }
    const styleSig = [c.text, c.fontCss, c.color, c.stroke, c.strokeW, c.shadow, c.shadowBlur,
      c.letterSpacing, c.lineHeight, c.bold, c.italic, c.underline, c.align, c.bg, c.bubble, c.effectCss].join('|');
    if (inner.dataset.sig !== styleSig) {
      applyTextStyles(inner, c, false);
      inner.dataset.sig = styleSig;
    }

    const editable = !S.playing && !S.exporting;
    const cls = 'overlay-text' + (S.selId === c.id ? ' selected' : '') + (editable ? ' draggable' : '');
    if (el.className !== cls) el.className = cls;

    const kf = c._kf || {};
    const px = clamp(Number(kf.x ?? c.x ?? 0.5), 0, 1);
    const py = clamp(Number(kf.y ?? c.y ?? 0.35), 0, 1);
    const size = Number(kf.size ?? c.size ?? 38);
    const rot = Number(kf.rot ?? c.rotation ?? 0);
    const op = clamp(Number(kf.opacity ?? c.opacity ?? 1), 0, 1);
    el.style.left = (px * 100) + '%';
    el.style.top = (py * 100) + '%';
    el.style.fontSize = size + 'px';
    inner.style.fontSize = size + 'px';
    el.style.opacity = String(op);
    el.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${Number(kf.scale ?? 1) || 1})`;

    const lt = t - c.start;
    const dur = c.duration();
    const ad = clamp(Number(c.animDur) || 0.6, 0.2, 5);
    let anim = '';
    if (c.animIn && c.animIn !== 'None' && lt < ad) anim = `${animName(c.animIn)} ${ad}s both`;
    else if (c.animOut && c.animOut !== 'None' && lt > dur - ad) anim = `${animName(c.animOut)} ${ad}s both`;
    else if (c.animLoop && c.animLoop !== 'None') anim = `${animName(c.animLoop)} 1.2s infinite`;
    if (inner.dataset.anim !== anim) {
      inner.style.animation = anim;
      inner.dataset.anim = anim;
    }
    if (anim && typeof inner.getAnimations === 'function') {
      for (const a of inner.getAnimations()) {
        try { a.currentTime = Math.max(0, lt * 1000); } catch (e) {}
      }
    }
  }
  for (const [id, el] of [...S.textEls.entries()]) {
    if (!seen.has(id)) { el.remove(); S.textEls.delete(id); }
  }
}

let dragState = null;
function attachOverlayDrag() {
  if (S._dragBound) return;
  S._dragBound = true;
  const getP = e => (e.touches && e.touches[0]) || e;
  overlay.addEventListener('mousedown', startDrag);
  overlay.addEventListener('touchstart', startDrag, { passive: false });

  function startDrag(e) {
    if (S.playing || S.exporting) return;
    const div = e.target.closest('.overlay-text');
    if (!div) return;
    if (e.cancelable) e.preventDefault();
    const clip = S.clips.find(c => c.id === div.dataset.id);
    if (!clip) return;
    select(clip.id);
    const p = getP(e);
    const r = overlay.getBoundingClientRect();
    dragState = { clip, sx: p.clientX, sy: p.clientY, ox: Number(clip.x ?? 0.5), oy: Number(clip.y ?? 0.35), r, moved: false };
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  }
  function moveDrag(e) {
    if (!dragState) return;
    if (e.cancelable) e.preventDefault();
    const p = getP(e);
    if (!dragState.moved) {
      if (Math.abs(p.clientX - dragState.sx) <= 2 && Math.abs(p.clientY - dragState.sy) <= 2) return;
      dragState.moved = true;
    }
    dragState.clip.x = clamp(dragState.ox + (p.clientX - dragState.sx) / Math.max(1, dragState.r.width), 0, 1);
    dragState.clip.y = clamp(dragState.oy + (p.clientY - dragState.sy) / Math.max(1, dragState.r.height), 0, 1);
    render();
  }
  function endDrag() {
    document.removeEventListener('mousemove', moveDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', moveDrag);
    document.removeEventListener('touchend', endDrag);
    if (dragState) {
      const moved = dragState.moved;
      dragState = null;
      if (moved) saveHistory();
    }
  }
}

/* ---------------- playback + audio graph ---------------- */
function setupTransport() {
  $('#btnPlay').addEventListener('click', togglePlay);
  $('#bigPlay').addEventListener('click', togglePlay);
  $('#btnPrevFrame').addEventListener('click', () => {
    pause();
    S.playhead = Math.max(0, S.playhead - 1 / 30);
    updatePlayheadUI();
    render();
  });
  $('#btnNextFrame').addEventListener('click', () => {
    pause();
    S.playhead = Math.min(totalDur(), S.playhead + 1 / 30);
    updatePlayheadUI();
    render();
  });
}

function togglePlay() { S.playing ? pause() : play(); }

function ensureAudio() {
  if (S.audioCtx) {
    if (S.audioCtx.state === 'suspended') S.audioCtx.resume().catch(() => {});
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    S.audioCtx = new AC();
    S.master = S.audioCtx.createGain();
    S.master.gain.value = 1;
    S.master.connect(S.audioCtx.destination);
    return true;
  } catch (e) {
    console.warn('Audio unavailable', e);
    return false;
  }
}

function primeMediaForPlayback() {
  if (!S.audioCtx) return;
  const activeMedia = new Set(S.clips.filter(c => c.start <= S.playhead && c.end > S.playhead).map(c => c.mediaId));
  for (const [mid, el] of [...S.videoEls, ...S.audioEls]) {
    if (activeMedia.has(mid) || S.primed.has(el)) continue;
    S.primed.add(el);
    try {
      el.muted = true;
      const p = el.play();
      Promise.resolve(p).then(() => {
        try { el.pause(); el.currentTime = 0; } catch (e) {}
        el.muted = false;
      }).catch(() => { el.muted = false; });
    } catch (e) { el.muted = false; }
  }
}

function play() {
  if (S.exporting) return;
  if (!S.clips.length) { toast('Add media to the timeline first'); return; }
  if (S.playhead >= totalDur() - 0.03) S.playhead = 0;
  ensureAudio();
  S.playing = true;
  S.playWall = performance.now();
  S.playStart = S.playhead;
  primeMediaForPlayback();
  syncMediaPlayback(S.playhead);
  $('#playIcon').innerHTML = '<path fill="currentColor" d="M6 4h4v16H6zm8 0h4v16h-4z"/>';
  $('#bigPlay').classList.add('hidden');
}

function pause() {
  stopPlayback();
  $('#playIcon').innerHTML = '<path fill="currentColor" d="M8 5v14l11-7z"/>';
  $('#bigPlay').classList.remove('hidden');
  render();
}

function stopPlayback() {
  S.playing = false;
  for (const id of [...S.activeAudio.keys()]) stopClipAudio(id);
  for (const el of [...S.videoEls.values(), ...S.audioEls.values()]) {
    try { el.pause(); } catch (e) {}
  }
  if (S.master && !S.exporting) { try { S.master.gain.value = 1; } catch (e) {} }
  if (!$('#playIcon')) return;
  $('#playIcon').innerHTML = '<path fill="currentColor" d="M8 5v14l11-7z"/>';
  $('#bigPlay').classList.remove('hidden');
}

function mediaElementForClip(c) {
  if (c.type === 'video') return S.videoEls.get(c.mediaId) || null;
  if (c.type === 'audio') return S.audioEls.get(c.mediaId) || null;
  return null;
}

function getAudioSource(mediaId) {
  if (!S.audioCtx) return null;
  const el = S.videoEls.get(mediaId) || S.audioEls.get(mediaId);
  if (!el) return null;
  const existing = S.sources.get(mediaId);
  if (existing && existing.el === el) return existing;
  try {
    const src = S.audioCtx.createMediaElementSource(el);
    const rec = { el, src };
    S.sources.set(mediaId, rec);
    return rec;
  } catch (e) {
    return null;
  }
}

function startClipAudio(c, t) {
  const el = mediaElementForClip(c);
  if (!el) return null;
  const state = { el, gain: null, lastV: null };
  if (ensureAudio()) {
    const rec = getAudioSource(c.mediaId);
    if (rec) {
      try {
        const g = S.audioCtx.createGain();
        g.gain.value = 0;
        rec.src.connect(g);
        g.connect(S.master);
        if (S.exportDest) g.connect(S.exportDest);
        state.gain = g;
      } catch (e) {
        state.gain = null;
      }
    }
  }
  try {
    el.muted = false;
    el.volume = 1;
    el.playbackRate = clamp(Number(c.speed) || 1, 0.25, 4);
    const lt = clamp((t - c.start) * (c.speed || 1) + (c.offset || 0), 0, Math.max(0.05, (c.mediaDur || 1) - 0.05));
    el.currentTime = lt;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
  S.activeAudio.set(c.id, state);
  applyClipVolume(c, t, state);
  return state;
}

function applyClipVolume(c, t, state) {
  const dur = Math.max(0.001, c.duration());
  const lt = clamp(t - c.start, 0, dur);
  let v = clamp(Number(c.volume ?? 1) || 0, 0, 2);
  if (Number(c.fadeIn) > 0 && lt < Number(c.fadeIn)) v *= clamp(lt / Number(c.fadeIn), 0, 1);
  if (Number(c.fadeOut) > 0 && dur - lt < Number(c.fadeOut)) v *= clamp((dur - lt) / Number(c.fadeOut), 0, 1);
  if (state.gain && S.audioCtx) {
    if (state.lastV == null || Math.abs(state.lastV - v) > 0.01) {
      try { state.gain.gain.setTargetAtTime(v, S.audioCtx.currentTime, 0.02); } catch (e) { state.gain.gain.value = v; }
      state.lastV = v;
    }
  } else {
    try { state.el.volume = clamp(v, 0, 1); } catch (e) {}
  }
}

function stopClipAudio(id) {
  const st = S.activeAudio.get(id);
  if (!st) return;
  if (st.gain) { try { st.gain.disconnect(); } catch (e) {} }
  S.activeAudio.delete(id);
}

function syncMediaPlayback(t) {
  const used = new Set();
  for (const c of S.clips) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const active = c.start <= t && c.end > t;
    const state = S.activeAudio.get(c.id);
    if (!active) {
      if (state) stopClipAudio(c.id);
      continue;
    }
    let st = state;
    if (!st) st = startClipAudio(c, t);
    if (!st) continue;
    const lt = clamp((t - c.start) * (c.speed || 1) + (c.offset || 0), 0, Math.max(0.05, (c.mediaDur || 1) - 0.05));
    if (!st.el.paused && Math.abs(st.el.currentTime - lt) > 0.3) {
      try { st.el.currentTime = lt; } catch (e) {}
    }
    const rate = clamp(Number(c.speed) || 1, 0.25, 4);
    if (st.el.playbackRate !== rate) { try { st.el.playbackRate = rate; } catch (e) {} }
    applyClipVolume(c, t, st);
    used.add(c.mediaId);
  }
  for (const [mid, el] of [...S.videoEls, ...S.audioEls]) {
    if (!used.has(mid) && !el.paused) { try { el.pause(); } catch (e) {} }
  }
}

/* ---------------- timeline ---------------- */
function setupTimeline() {
  const sc = $('#timelineScroll');
  sc.addEventListener('mousedown', onRulerDown);
  sc.addEventListener('touchstart', onRulerDown, { passive: false });
  const tracks = $('#tracks');
  tracks.addEventListener('mousedown', onClipDown);
  tracks.addEventListener('touchstart', onClipDown, { passive: false });
}

function pointerClientX(e) {
  return (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
}

function onRulerDown(e) {
  if (e.target.closest('.clip')) return;
  // On touch, leave empty track swipes to the native horizontal scroller.
  // Tapping/dragging the ruler still scrubs.
  if (e.touches && e.touches.length && !e.target.closest('.ruler')) return;
  if (e.cancelable) e.preventDefault();
  S._noAutoScroll = true;
  seekFromClientX(pointerClientX(e));
  const mv = ev => {
    if (ev.cancelable) ev.preventDefault();
    seekFromClientX(pointerClientX(ev));
  };
  const up = () => {
    S._noAutoScroll = false;
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', mv);
    document.removeEventListener('touchend', up);
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
  document.addEventListener('touchmove', mv, { passive: false });
  document.addEventListener('touchend', up);
}

function seekFromClientX(cx) {
  const sc = $('#timelineScroll');
  const r = sc.getBoundingClientRect();
  const x = cx - r.left + sc.scrollLeft;
  S.playhead = clamp(x / S.pxPerSec, 0, totalDur());
  pause();
  updatePlayheadUI();
  render();
}

function niceStep(pxPerSec) {
  const min = 80 / pxPerSec;
  for (const n of [0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60, 120]) {
    if (n >= min * 0.7) return n;
  }
  return 120;
}

function targetTrack(c) {
  if (c.type === 'audio') return 'audio';
  if (c.type === 'text') return 'text';
  if (c.type === 'overlay-img') return 'overlay';
  return 'video';
}

function renderTimeline() {
  if (!editorScreen || editorScreen.classList.contains('hidden')) return;
  const sc = $('#timelineScroll');
  const pxps = S.pxPerSec;
  const td = totalDur();
  const totalPx = Math.max(sc.clientWidth || 600, Math.ceil(td * pxps + 160));
  const ruler = $('#ruler');
  ruler.style.width = totalPx + 'px';
  $('#tracks').style.width = totalPx + 'px';
  ruler.innerHTML = '';

  const step = niceStep(pxps);
  let i = 0;
  for (let t = 0; t <= td + step; t += step, i++) {
    const tk = document.createElement('div');
    tk.className = 'ruler-tick' + (i % 2 === 0 ? ' major' : '');
    tk.style.left = (t * pxps) + 'px';
    tk.textContent = fmtTime(t);
    ruler.appendChild(tk);
  }

  const lanes = { video: $('#videoClips'), overlay: $('#overlayClips'), text: $('#textClips'), audio: $('#audioClips') };
  for (const k in lanes) {
    lanes[k].innerHTML = '';
    lanes[k].style.width = totalPx + 'px';
  }

  // Track clip containers must span the full scrolled width, not just the viewport.
  $$('.track-clips').forEach(el => { el.style.width = totalPx + 'px'; });

  for (const c of S.clips) {
    const el = document.createElement('div');
    const lane = targetTrack(c);
    let cls = lane === 'overlay' ? 'image' : lane;
    if (c.type === 'procedural') cls = 'video';
    el.className = 'clip ' + cls;
    el.dataset.id = c.id;
    el.style.left = Math.max(0, c.start * pxps) + 'px';
    el.style.width = Math.max(6, (c.end - c.start) * pxps) + 'px';
    const name = c.type === 'text' ? (c.text || 'Text').slice(0, 22)
      : c.type === 'procedural' ? 'Sample'
        : (c.name || (c.type === 'audio' ? 'Audio' : 'Clip'));
    el.title = name;
    el.innerHTML = '<div class="trim-handle trim-left"></div><div class="clip-name">' + esc(name) +
      '</div><div class="trim-handle trim-right"></div>' + (c.keyframes && c.keyframes.length ? '<div class="kf-dot"></div>' : '');
    if (c.keyframes && c.keyframes.length) {
      const kfd = document.createElement('div');
      kfd.className = 'kf-ticks';
      c.keyframes.filter(k => k.prop === '_all').forEach(k => {
        const d = document.createElement('div');
        d.className = 'kf-tick';
        d.style.left = clamp(k.t, 0, c.end - c.start) * pxps + 'px';
        kfd.appendChild(d);
      });
      el.appendChild(kfd);
    }
    if (S.selId === c.id) el.classList.add('selected');
    lanes[lane].appendChild(el);
  }
  updatePlayheadUI();
}

let clipDrag = null;
function onClipDown(e) {
  const el = e.target.closest('.clip');
  if (!el) return;
  const clip = S.clips.find(c => c.id === el.dataset.id);
  if (!clip) return;
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();
  const trimLeft = e.target.classList.contains('trim-left');
  const trimRight = e.target.classList.contains('trim-right');
  select(clip.id);
  pause();
  S._noAutoScroll = true;
  clipDrag = {
    id: clip.id,
    type: trimLeft ? 'trimLeft' : trimRight ? 'trimRight' : 'move',
    sx: pointerClientX(e),
    os: clip.start,
    oe: clip.end,
    oo: clip.offset || 0,
    moved: false
  };
  const mv = ev => {
    if (ev.cancelable) ev.preventDefault();
    applyClipDrag(pointerClientX(ev));
  };
  const up = () => {
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', mv);
    document.removeEventListener('touchend', up);
    S._noAutoScroll = false;
    if (clipDrag) {
      clipDrag = null;
      saveHistory();
      refreshPanel();
    }
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
  document.addEventListener('touchmove', mv, { passive: false });
  document.addEventListener('touchend', up);
}

function applyClipDrag(cx) {
  if (!clipDrag) return;
  const c = S.clips.find(x => x.id === clipDrag.id);
  if (!c) return;
  if (!clipDrag.moved) {
    if (Math.abs(cx - clipDrag.sx) <= 2) return;
    clipDrag.moved = true;
  }
  const dx = (cx - clipDrag.sx) / S.pxPerSec;
  if (clipDrag.type === 'move') {
    c.start = Math.max(0, clipDrag.os + dx);
    c.end = c.start + (clipDrag.oe - clipDrag.os);
  } else if (clipDrag.type === 'trimLeft') {
    let ns = clamp(clipDrag.os + dx, 0, clipDrag.oe - 0.2);
    if (c.type === 'video' || c.type === 'audio') {
      const sp = Number(c.speed) || 1;
      const newOffset = clipDrag.oo + (ns - clipDrag.os) * sp;
      const minStart = clipDrag.os - clipDrag.oo / sp;
      if (newOffset < 0) ns = Math.max(0, minStart);
      c.offset = Math.max(0, clipDrag.oo + (ns - clipDrag.os) * sp);
    }
    c.start = ns;
  } else if (clipDrag.type === 'trimRight') {
    let ne = Math.max(c.start + 0.2, clipDrag.oe + dx);
    if (c.type === 'video' || c.type === 'audio') {
      const maxDur = ((c.mediaDur || ne) - (c.offset || 0)) / (c.speed || 1);
      ne = Math.min(ne, c.start + maxDur);
    }
    c.end = Math.max(c.start + 0.2, ne);
  }
  renderTimeline();
  render();
  updatePlayheadUI();
}

function updatePlayheadUI() {
  const sc = $('#timelineScroll');
  if (!sc) return;
  const left = S.playhead * S.pxPerSec;
  $('#playheadLine').style.left = left + 'px';
  $('#curTime').textContent = fmtTime(S.playhead);
  $('#totTime').textContent = fmtTime(totalDur());
  if (S._noAutoScroll) return;
  const viewL = sc.scrollLeft;
  const viewR = viewL + sc.clientWidth;
  if (left < viewL + 24 || left > viewR - 50) {
    sc.scrollLeft = clamp(left - sc.clientWidth * 0.4, 0, Math.max(0, sc.scrollWidth));
  }
}

/* ---------------- selection + clip panel ---------------- */
function select(id) {
  S.selId = id;
  $$('.clip').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
  if (S.tab !== 'edit') renderTab(S.tab);
  else showClipPanel();
  render();
}

function deselect() {
  S.selId = null;
  $$('.clip').forEach(el => el.classList.remove('selected'));
  hideClipPanel();
  if (S.tab !== 'edit') renderTab(S.tab);
  render();
}

function showClipPanel() {
  const c = selected();
  if (!c) { hideClipPanel(); return; }
  const con = $('#clipPanelContent');
  con.innerHTML = '';
  const mk = (icon, label, fn, danger) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'clip-action' + (danger ? ' danger' : '');
    b.innerHTML = `<span style="font-size:17px">${icon}</span><span>${label}</span>`;
    b.addEventListener('click', fn);
    con.appendChild(b);
    return b;
  };
  const info = document.createElement('div');
  info.className = 'clip-action';
  info.style.pointerEvents = 'none';
  info.innerHTML = `<strong>${esc(c.type === 'text' ? (c.text || 'Text') : (c.name || c.type))}</strong><span>${c.duration().toFixed(1)}s</span>`;
  con.appendChild(info);

  mk('✂', 'Split', () => { if (!splitAt(c, S.playhead)) toast('Playhead is outside this clip'); });
  mk('🗑', 'Delete', deleteSelected, true);
  mk('⧉', 'Dup', duplicateSelected);
  mk('◆', 'Key', addKeyframeAtPlayhead);
  if (c.type === 'text') {
    mk('✎', 'Edit', () => openTextFor(c));
  }
  if (c.type !== 'audio' && c.type !== 'text') {
    mk('↔', 'Flip H', () => { c.flipX = !c.flipX; render(); saveHistory(); });
    mk('↕', 'Flip V', () => { c.flipY = !c.flipY; render(); saveHistory(); });
    mk('↻', 'Rotate', () => { c.rotation = ((Number(c.rotation) || 0) + 90) % 360; render(); saveHistory(); });
  }
  if (c.type === 'video' || c.type === 'audio') {
    slider(con, 'Speed', 0.25, 4, 0.05, c.speed ?? 1, v => {
      setSpeed(c, v);
      renderTimeline();
    }, v => v.toFixed(2) + '×');
  }
  if (c.type === 'video' || c.type === 'audio') {
    slider(con, 'Volume', 0, 2, 0.05, c.volume ?? 1, v => { c.volume = v; }, v => Math.round(v * 100) + '%');
  }
  if (c.type === 'text') {
    slider(con, 'Size', 12, 180, 1, c.size ?? 38, v => { c.size = v; }, v => Math.round(v) + 'px');
    slider(con, 'Rotation', -180, 180, 1, c.rotation ?? 0, v => { c.rotation = v; }, v => Math.round(v) + '°');
  } else if (c.type === 'image' || c.type === 'overlay-img' || c.type === 'video') {
    slider(con, 'Opacity', 0, 1, 0.05, c.opacity ?? 1, v => { c.opacity = v; }, v => Math.round(v * 100) + '%');
    slider(con, 'Scale', 0.2, 3, 0.05, c.scale ?? 1, v => { c.scale = v; }, v => v.toFixed(2) + '×');
  }
  if (c.type === 'image' || c.type === 'overlay-img' || c.type === 'text' || c.type === 'video') {
    mk('⤢', 'Reset', () => {
      c.scale = 1;
      c.opacity = 1;
      c.rotation = 0;
      c.flipX = false;
      c.flipY = false;
      c.x = 0.5;
      c.y = c.type === 'text' ? 0.35 : 0.5;
      if (c.type === 'text') c.size = 38;
      render();
      renderTimeline();
      saveHistory();
    });
  }
  $('#clipPanel').classList.remove('hidden');
}

function hideClipPanel() {
  const p = $('#clipPanel');
  if (p) p.classList.add('hidden');
}

function refreshPanel() {
  if (S.tab === 'edit') showClipPanel();
  else renderTab(S.tab);
}

function slider(parent, label, min, max, step, value, onInput, format) {
  const row = document.createElement('div');
  row.className = 'slider-row';
  const lab = document.createElement('label');
  const span = document.createElement('span');
  lab.textContent = label;
  lab.appendChild(span);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = clamp(Number(value) || 0, min, max);
  const paint = v => { span.textContent = format ? format(v) : String(v); };
  paint(Number(input.value));
  input.addEventListener('input', () => {
    const v = Number(input.value);
    paint(v);
    onInput(v);
    render();
  });
  input.addEventListener('change', () => { saveHistory(); });
  row.appendChild(lab);
  row.appendChild(input);
  parent.appendChild(row);
  return input;
}

function setSpeed(c, s) {
  s = clamp(Number(s) || 1, 0.25, 4);
  let sourceRange = (c.end - c.start) * (Number(c.speed) || 1);
  if (Number.isFinite(c.mediaDur)) sourceRange = Math.min(sourceRange, Math.max(0.2, c.mediaDur - (c.offset || 0)));
  c.speed = s;
  c.end = c.start + Math.max(0.2, sourceRange / s);
}

function splitAtPlayhead() {
  const t = S.playhead;
  const targets = S.clips.filter(c => c.start < t - 0.05 && c.end > t + 0.05);
  if (!targets.length) { toast('No clip at playhead'); return; }
  targets.forEach(c => splitAt(c, t));
  renderTimeline();
  refreshPanel();
  render();
  saveHistory();
  toast(`Split ${targets.length} clip${targets.length > 1 ? 's' : ''}`);
}

function splitAt(c, t) {
  if (t <= c.start + 0.05 || t >= c.end - 0.05) return false;
  const right = installClip(JSON.parse(JSON.stringify(serializeClip(c))));
  right.id = uid();
  right.start = t;
  right.end = c.end;
  right.offset = (c.offset || 0) + (t - c.start) * (c.speed || 1);
  const cut = t - c.start;
  const keys = c.keyframes || [];
  right.keyframes = keys.filter(k => k.t >= cut).map(k => ({ ...k, t: k.t - cut }));
  c.keyframes = keys.filter(k => k.t <= cut).map(k => ({ ...k }));
  c.end = t;
  S.clips.push(right);
  return true;
}

function deleteSelected() {
  const c = selected();
  if (!c) { toast('Select a clip first'); return; }
  stopClipAudio(c.id);
  if (S._welcomeId === c.id) S._welcomeId = null;
  S.clips = S.clips.filter(x => x.id !== c.id);
  S.selId = null;
  hideClipPanel();
  renderTimeline();
  render();
  saveHistory();
  toast('Deleted');
}

function duplicateSelected() {
  const c = selected();
  if (!c) { toast('Select a clip first'); return; }
  const copy = installClip(JSON.parse(JSON.stringify(serializeClip(c))));
  copy.id = uid();
  const dur = c.end - c.start;
  copy.start = c.end;
  copy.end = copy.start + dur;
  copy.keyframes = (c.keyframes || []).map(k => ({ ...k }));
  S.clips.push(copy);
  S.selId = copy.id;
  renderTimeline();
  refreshPanel();
  render();
  saveHistory();
  toast('Duplicated');
}

/* ---------------- bottom tabs + inline panels ---------------- */
function setupTabs() {
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
}

function setTab(tab) {
  S.tab = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  hideClipPanel();
  renderTab(tab);
}

function renderTab(tab) {
  const existing = $('#inlinePanel');
  if (existing) existing.remove();
  if (tab === 'edit') {
    if (selected()) showClipPanel();
    return;
  }
  const panel = document.createElement('div');
  panel.id = 'inlinePanel';
  panel.className = 'clip-panel';
  const sc = document.createElement('div');
  sc.className = 'panel-scroll';
  panel.appendChild(sc);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-btn panel-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Close panel');
  close.addEventListener('click', () => setTab('edit'));
  panel.appendChild(close);

  const clip = selected();
  const needClip = () => { if (!clip) { toast('Select a clip first'); return null; } return clip; };

  if (tab === 'filters') {
    const groups = {};
    (window.PRESETS_FILTERS || []).forEach(f => { (groups[f.group] = groups[f.group] || []).push(f); });
    Object.entries(groups).forEach(([group, list]) => {
      const h = document.createElement('div');
      h.className = 'panel-group-title';
      h.textContent = group;
      sc.appendChild(h);
      const wrap = document.createElement('div');
      wrap.className = 'chip-row';
      sc.appendChild(wrap);
      list.forEach(f => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.innerHTML = '<span class="chip-preview" style="background:linear-gradient(135deg,#4ea8ff,#25c38e)"></span>' + esc(f.name);
        chip.addEventListener('click', () => {
          const c = needClip();
          if (!c) return;
          c.filters = { ...f.values };
          c.overlayColor = f.overlay ? f.overlay.color : null;
          $$('.chip', panel).forEach(x => x.classList.remove('active'));
          chip.classList.add('active');
          render();
          saveHistory();
        });
        wrap.appendChild(chip);
      });
    });
  } else if (tab === 'adjust') {
    if (!clip) {
      sc.appendChild(hint('Select a clip to adjust brightness, contrast and more.'));
    } else {
      (window.PRESETS_ADJUST || []).forEach(([key, label, min, max, def, step]) => {
        const cur = clip.filters && clip.filters[key] != null ? clip.filters[key] : def;
        slider(sc, label, min, max, step, cur, v => {
          clip.filters = clip.filters || {};
          clip.filters[key] = v;
        }, v => key === 'hueRotate' ? Math.round(v) + '°' : (step < 0.1 ? v.toFixed(2) : v.toFixed(1)));
      });
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'chip chip-reset';
    reset.innerHTML = '<span class="chip-preview" style="background:var(--danger)"></span>Reset';
    reset.addEventListener('click', () => {
      const c = needClip();
      if (!c) return;
      c.filters = {};
      c.effect = null;
      c.overlayColor = null;
      render();
      renderTab('adjust');
      saveHistory();
      toast('Adjustments reset');
    });
    sc.appendChild(reset);
  } else if (tab === 'effects') {
    (window.PRESETS_EFFECTS || []).forEach(n => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (clip && (clip.effect || 'None') === n ? ' active' : '');
      chip.innerHTML = '<span class="chip-preview" style="background:linear-gradient(135deg,#f093fb,#f5576c)"></span>' + esc(n);
      chip.addEventListener('click', () => {
        const c = needClip();
        if (!c) return;
        c.effect = n === 'None' ? null : n;
        $$('.chip', panel).forEach(x => x.classList.remove('active'));
        chip.classList.add('active');
        render();
        saveHistory();
      });
      sc.appendChild(chip);
    });
  } else if (tab === 'audio') {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'clip-action';
    add.innerHTML = '<span style="font-size:18px">＋</span><span>Add audio</span>';
    add.addEventListener('click', () => {
      pause();
      const input = $('#importAudio');
      input.click();
    });
    sc.appendChild(add);
    if (clip && (clip.type === 'audio' || clip.type === 'video')) {
      slider(sc, 'Volume', 0, 2, 0.05, clip.volume ?? 1, v => { clip.volume = v; }, v => Math.round(v * 100) + '%');
      slider(sc, 'Fade in', 0, 3, 0.1, clip.fadeIn ?? 0, v => { clip.fadeIn = v; }, v => v.toFixed(1) + 's');
      slider(sc, 'Fade out', 0, 3, 0.1, clip.fadeOut ?? 0, v => { clip.fadeOut = v; }, v => v.toFixed(1) + 's');
      slider(sc, 'Speed', 0.25, 4, 0.05, clip.speed ?? 1, v => { setSpeed(clip, v); renderTimeline(); }, v => v.toFixed(2) + '×');
    } else {
      sc.appendChild(hint('Select a video or audio clip to change volume, fades and speed.'));
    }
  } else if (tab === 'text') {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'clip-action';
    add.innerHTML = '<span style="font-size:18px">＋</span><span>Add text</span>';
    add.addEventListener('click', () => openTextModal());
    sc.appendChild(add);
    const texts = S.clips.filter(c => c.type === 'text');
    texts.forEach(c => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.innerHTML = '<span class="chip-preview" style="background:linear-gradient(135deg,#ffb347,#ff7a59);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px">T</span>' + esc((c.text || 'Text').slice(0, 12));
      chip.addEventListener('click', () => { select(c.id); openTextFor(c); });
      sc.appendChild(chip);
    });
    if (!texts.length) sc.appendChild(hint('Add a title, subtitle or caption. Drag it on the preview to position it.'));
  } else if (tab === 'overlay') {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'clip-action';
    add.innerHTML = '<span style="font-size:18px">＋</span><span>Add image</span>';
    add.addEventListener('click', () => {
      pause();
      const input = $('#importImage');
      input.dataset.overlay = '1';
      input.click();
    });
    sc.appendChild(add);
    if (clip && (clip.type === 'overlay-img' || clip.type === 'image')) {
      slider(sc, 'Opacity', 0, 1, 0.05, clip.opacity ?? 1, v => { clip.opacity = v; }, v => Math.round(v * 100) + '%');
      slider(sc, 'Scale', 0.2, 3, 0.05, clip.scale ?? 1, v => { clip.scale = v; }, v => v.toFixed(2) + '×');
      slider(sc, 'Rotate', -180, 180, 1, clip.rotation ?? 0, v => { clip.rotation = v; }, v => Math.round(v) + '°');
    } else {
      sc.appendChild(hint('Overlay images play on top of the video. Use import → Photo for a full-frame photo.'));
    }
  } else if (tab === 'keyframes') {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'clip-action';
    add.innerHTML = '<span style="font-size:18px">◆</span><span>Add key</span>';
    add.addEventListener('click', addKeyframeAtPlayhead);
    sc.appendChild(add);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'clip-action danger';
    rm.innerHTML = '<span style="font-size:18px">✕</span><span>Remove</span>';
    rm.addEventListener('click', removeKeyframeAtPlayhead);
    sc.appendChild(rm);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'clip-action';
    clear.innerHTML = '<span style="font-size:18px">⟳</span><span>Clear all</span>';
    clear.addEventListener('click', () => {
      const c = needClip();
      if (!c) return;
      c.keyframes = [];
      renderTimeline();
      render();
      saveHistory();
      toast('Keyframes cleared');
    });
    sc.appendChild(clear);
    sc.appendChild(hint('Select a clip, move the playhead, change scale/position/opacity, then tap Add key. Add another key later — KritiCut animates between them.'));
    if (clip && clip.keyframes && clip.keyframes.length) {
      sc.appendChild(hint(`${clip.keyframes.length} keyframe(s) on this clip`));
    }
  }

  $('#resizeHandle').before(panel);
}

function hint(text) {
  const d = document.createElement('div');
  d.className = 'panel-hint';
  d.textContent = text;
  return d;
}

/* ---------------- zoom ---------------- */
function setupZoom() {
  $('#btnZoomIn').addEventListener('click', () => setZoom(S.zoom * 1.25));
  $('#btnZoomOut').addEventListener('click', () => setZoom(S.zoom / 1.25));
}

function setZoom(z) {
  S.zoom = clamp(z, 0.2, 12);
  S.pxPerSec = 60 * S.zoom;
  $('#zoomVal').textContent = S.zoom.toFixed(1) + '×';
  renderTimeline();
  updatePlayheadUI();
}

/* ---------------- timeline resize ---------------- */
function setupResize() {
  const h = $('#resizeHandle');
  const section = $('#timelineSection');
  section.style.height = S.tlHeight + 'px';
  let drag = false, sy = 0, sh = 0;
  const maxH = () => Math.min(600, Math.round((window.innerHeight || 800) * 0.65));
  const begin = y => {
    drag = true; sy = y; sh = S.tlHeight;
    h.classList.add('active');
    document.body.classList.add('resizing');
  };
  const move = y => {
    if (!drag) return;
    const nh = clamp(sh + (y - sy), TL_MIN, maxH());
    S.tlHeight = Math.round(nh);
    section.style.height = S.tlHeight + 'px';
    requestAnimationFrame(resizeCanvas);
  };
  const end = () => {
    if (!drag) return;
    drag = false;
    h.classList.remove('active');
    document.body.classList.remove('resizing');
    writeLS('kc_tlh', S.tlHeight);
    setTimeout(resizeCanvas, 50);
  };
  h.addEventListener('mousedown', e => { begin(e.clientY); e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (drag) { move(e.clientY); e.preventDefault(); } });
  window.addEventListener('mouseup', end);
  h.addEventListener('touchstart', e => { begin(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', e => { if (drag) { move(e.touches[0].clientY); e.preventDefault(); } }, { passive: false });
  window.addEventListener('touchend', end);
  h.addEventListener('dblclick', () => {
    S.tlHeight = 250;
    section.style.height = '250px';
    removeLS('kc_tlh');
    resizeCanvas();
    toast('Timeline reset');
  });
}

/* ---------------- keyframes ---------------- */
function addKeyframeAtPlayhead() {
  const c = selected();
  if (!c) { toast('Select a clip first'); return; }
  const t = S.playhead - c.start;
  if (t < -0.01 || t > c.duration() + 0.01) { toast('Playhead is outside this clip'); return; }
  const kf = c._kf || {};
  const key = {
    t: clamp(t, 0, c.duration()),
    prop: '_all',
    x: kf.x ?? c.x ?? 0.5,
    y: kf.y ?? c.y ?? 0.35,
    scale: kf.scale ?? c.scale ?? 1,
    rot: kf.rot ?? c.rotation ?? 0,
    opacity: kf.opacity ?? c.opacity ?? 1,
    size: kf.size ?? c.size ?? 38
  };
  c.keyframes = (c.keyframes || []).filter(k => Math.abs(k.t - key.t) > 0.05);
  c.keyframes.push(key);
  c.keyframes.sort((a, b) => a.t - b.t);
  renderTimeline();
  render();
  saveHistory();
  $('#kfHint').classList.remove('hidden');
  setTimeout(() => $('#kfHint').classList.add('hidden'), 900);
  toast('Keyframe added');
}

function removeKeyframeAtPlayhead() {
  const c = selected();
  if (!c || !c.keyframes || !c.keyframes.length) { toast('No keyframes on this clip'); return; }
  const t = S.playhead - c.start;
  const before = c.keyframes.length;
  c.keyframes = c.keyframes.filter(k => Math.abs(k.t - t) > 0.1);
  if (before === c.keyframes.length) { toast('No keyframe at the playhead'); return; }
  renderTimeline();
  render();
  saveHistory();
  toast('Keyframe removed');
}

function applyKeyframes(t) {
  for (const c of S.clips) {
    c._kf = null;
    if (!c.keyframes || !c.keyframes.length) continue;
    if (c.start > t || c.end <= t) continue;
    const lt = t - c.start;
    const kfs = c.keyframes.filter(k => k.prop === '_all').sort((a, b) => a.t - b.t);
    if (!kfs.length) continue;
    if (lt <= kfs[0].t) { setKF(c, kfs[0]); continue; }
    const last = kfs[kfs.length - 1];
    if (lt >= last.t) { setKF(c, last); continue; }
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i], b = kfs[i + 1];
      if (a.t <= lt && b.t >= lt) {
        const p = clamp((lt - a.t) / Math.max(0.0001, b.t - a.t), 0, 1);
        c._kf = {
          x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p),
          scale: lerp(a.scale, b.scale, p), rot: lerp(a.rot, b.rot, p),
          opacity: lerp(a.opacity, b.opacity, p), size: lerp(a.size, b.size, p)
        };
        break;
      }
    }
  }
}

function setKF(c, k) {
  c._kf = { x: k.x, y: k.y, scale: k.scale, rot: k.rot, opacity: k.opacity, size: k.size };
}

function lerp(a, b, t) { return (Number(a) || 0) + ((Number(b) || 0) - (Number(a) || 0)) * t; }

/* ---------------- import ---------------- */
function setupImport() {
  hookMediaInput('#importVideo', 'video');
  hookMediaInput('#importImage', 'image');
  hookMediaInput('#importAudio', 'audio');

  $('#addSample').addEventListener('click', () => {
    const previous = takeWelcomePlaceholder();
    const start = previous ? previous.start : getNextInsert();
    const c = makeWelcome(start, start + 10);
    if (previous && previous.filters) c.filters = { ...previous.filters };
    if (previous && previous.effect) c.effect = previous.effect;
    if (previous && previous.overlayColor) c.overlayColor = previous.overlayColor;
    S.clips.push(c);
    closeModal($('#importModal'));
    renderTimeline();
    select(c.id);
    render();
    saveHistory();
    toast('Sample clip added');
  });
}

function hookMediaInput(selector, type) {
  const input = $(selector);
  input.addEventListener('change', async e => {
    const files = [...(e.target.files || [])];
    input.value = '';
    if (!files.length) return;
    if (S._importing) { toast('An import is already running'); return; }
    S._importing = true;
    const asOverlay = type === 'image' && input.dataset.overlay === '1';
    delete input.dataset.overlay;
    let added = 0;
    try {
      for (const file of files) {
        try {
          const entry = await addFile(file, type, { asOverlay });
          if (entry) added++;
        } catch (err) {
          console.warn('Import failed', file && file.name, err);
          toast(`Could not import “${file && file.name ? file.name : 'file'}”`);
        }
      }
    } finally {
      S._importing = false;
    }
    renderLib();
    if (added) {
      saveHistory();
      toast(`Added ${added} file${added > 1 ? 's' : ''}`);
    } else {
      toast('Nothing was imported');
    }
  });
}

async function addFile(file, type, opts = {}) {
  if (!file) return null;
  const looksRight = type === 'video' ? file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(file.name)
    : type === 'audio' ? file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(file.name)
      : file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif|heic)$/i.test(file.name);
  if (!looksRight) { toast(`“${file.name}” does not look like ${type}`); return null; }

  const src = URL.createObjectURL(file);
  const el = makeMediaElement(type, src);
  const ok = await whenMediaReady(el, type, 12000);
  if (!ok) {
    try { URL.revokeObjectURL(src); } catch (e) {}
    toast(`Could not read “${file.name}”`);
    return null;
  }
  const duration = type === 'image' ? 5 : clamp(Number(el.duration) || 5, 0.2, 24 * 3600);
  const entry = {
    id: uid(), type, name: file.name, src, duration, mediaDur: duration, blob: file,
    thumb: type === 'image' ? src : ''
  };
  S.mediaLib.push(entry);
  if (type === 'video') S.videoEls.set(entry.id, el);
  else if (type === 'image') S.imageEls.set(entry.id, el);
  else S.audioEls.set(entry.id, el);

  await storeMediaBlob(entry.id, file);

  const welcome = (type === 'video' || (type === 'image' && !opts.asOverlay)) ? takeWelcomePlaceholder() : null;
  const start = (type === 'audio' || opts.asOverlay)
    ? clamp(S.playhead, 0, Math.max(0, totalDur()))
    : getNextInsert();
  const clip = addClip(entry.id, start, { asOverlay: !!opts.asOverlay, select: true });
  if (clip) {
    if (welcome) {
      if (welcome.filters) clip.filters = { ...welcome.filters };
      if (welcome.effect) clip.effect = welcome.effect;
      if (welcome.overlayColor) clip.overlayColor = welcome.overlayColor;
    }
    select(clip.id);
  }
  if (type === 'video') setTimeout(() => makeVideoThumb(el, entry), 300);
  renderLib();
  renderTimeline();
  render();
  updatePlayheadUI();
  return entry;
}

function makeVideoThumb(el, entry) {
  if (!entry || entry._thumbDone) return;
  const draw = () => {
    try {
      if (!el.videoWidth || !el.videoHeight) return;
      const size = 160;
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      const c2 = cv.getContext('2d');
      const scale = Math.max(size / el.videoWidth, size / el.videoHeight);
      const w = el.videoWidth * scale, h = el.videoHeight * scale;
      c2.drawImage(el, (size - w) / 2, (size - h) / 2, w, h);
      entry.thumb = cv.toDataURL('image/jpeg', 0.7);
      entry._thumbDone = true;
      renderLib();
    } catch (e) {}
  };
  if (el.readyState >= 2) draw();
  else el.addEventListener('loadeddata', draw, { once: true });
}

function addClip(mediaId, start, opts = {}) {
  const m = S.mediaLib.find(x => x.id === mediaId);
  if (!m) return null;
  const asOverlay = !!opts.asOverlay;
  let c = null;
  if (m.type === 'video') {
    const dur = clamp(Number(m.duration) || 5, 0.2, 24 * 3600);
    c = {
      id: uid(), type: 'video', mediaId, name: m.name, start, end: start + dur,
      offset: 0, mediaDur: dur, z: 1, filters: {}, speed: 1, volume: 1,
      opacity: 1, scale: 1, rotation: 0, x: 0.5, y: 0.5
    };
  } else if (m.type === 'image') {
    c = {
      id: uid(), type: asOverlay ? 'overlay-img' : 'image', mediaId, name: m.name,
      start, end: start + clamp(Number(m.duration) || 5, 0.5, 600), offset: 0, mediaDur: 600, z: asOverlay ? 3 : 1,
      filters: {}, opacity: 1, scale: asOverlay ? 0.5 : 1, rotation: 0, x: 0.5, y: 0.5
    };
  } else if (m.type === 'audio') {
    const dur = clamp(Number(m.duration) || 5, 0.2, 24 * 3600);
    c = {
      id: uid(), type: 'audio', mediaId, name: m.name, start, end: start + dur,
      offset: 0, mediaDur: dur, z: 0, filters: {}, speed: 1, volume: 1,
      fadeIn: 0, fadeOut: 0
    };
  }
  if (!c) return null;
  installClip(c);
  S.clips.push(c);
  if (opts.select !== false) S.selId = c.id;
  renderTimeline();
  render();
  updatePlayheadUI();
  return c;
}

function renderLib() {
  const lib = $('#mediaLibrary');
  if (!lib) return;
  lib.innerHTML = '';
  if (!S.mediaLib.length) {
    const empty = document.createElement('div');
    empty.className = 'media-empty';
    empty.textContent = 'Imported video, photos and audio appear here.';
    lib.appendChild(empty);
    return;
  }
  for (const m of S.mediaLib) {
    const it = document.createElement('div');
    it.className = 'media-lib-item';
    const thumb = m.thumb
      ? `<img src="${m.thumb}" alt="">`
      : `<div class="media-placeholder">${m.type === 'audio' ? '♪' : '▣'}</div>`;
    it.innerHTML = thumb +
      `<span class="lib-badge">${esc(m.type)}</span>` +
      `<span class="lib-label">${esc(m.name)}</span>` +
      `<span class="lib-actions"><button type="button" class="lib-btn add" aria-label="Add to timeline">＋</button>` +
      `<button type="button" class="lib-btn del" aria-label="Remove media">✕</button></span>`;
    $('.lib-btn.add', it).addEventListener('click', e => {
      e.stopPropagation();
      const start = m.type === 'audio' ? clamp(S.playhead, 0, totalDur()) : getNextInsert();
      const c = addClip(m.id, start, {});
      if (c) {
        select(c.id);
        saveHistory();
        toast('Added to timeline');
      }
    });
    $('.lib-btn.del', it).addEventListener('click', e => {
      e.stopPropagation();
      deleteMedia(m.id);
    });
    it.addEventListener('click', () => {
      const start = m.type === 'audio' ? clamp(S.playhead, 0, totalDur()) : getNextInsert();
      const c = addClip(m.id, start, {});
      if (c) { select(c.id); saveHistory(); }
    });
    lib.appendChild(it);
  }
}

function deleteMedia(id) {
  const m = S.mediaLib.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Remove “${m.name}” from this project?`)) return;
  const used = S.clips.filter(c => c.mediaId === id).length;
  if (used && !confirm(`${used} clip(s) on the timeline use this media and will be removed too. Continue?`)) return;
  const removedClipIds = S.clips.filter(c => c.mediaId === id).map(c => c.id);
  S.clips = S.clips.filter(c => c.mediaId !== id);
  if (!S.clips.some(c => c.id === S.selId)) S.selId = null;
  S.mediaLib = S.mediaLib.filter(x => x.id !== id);
  S.videoEls.delete(id); S.imageEls.delete(id); S.audioEls.delete(id);
  if (S.sources.has(id)) {
    try { S.sources.get(id).src.disconnect(); } catch (e) {}
    S.sources.delete(id);
  }
  for (const clipId of removedClipIds) stopClipAudio(clipId);
  try { URL.revokeObjectURL(m.src); } catch (e) {}
  deleteMediaBlob(id);
  renderLib();
  renderTimeline();
  render();
  hideClipPanel();
  saveHistory();
  toast('Media removed');
}

/* ---------------- text modal ---------------- */
const TEXT_PRESETS = ['Title', 'Subtitle', 'Caption', 'Quote', 'Neon', 'Retro', 'Minimal', 'Animated'];

function defaultTextDraft() {
  return {
    text: '', fontCss: 'sans-serif', fontName: 'Sans', size: 38, color: '#ffffff',
    stroke: '#000000', strokeW: 0, shadow: '#000000', shadowBlur: 0,
    letterSpacing: 0, lineHeight: 1.2, opacity: 1, bg: null,
    bold: true, italic: false, underline: false, align: 'center',
    animIn: 'Fade In', animOut: 'None', animLoop: 'None', animDur: 0.6,
    effectName: 'None', effectCss: '', bubble: 'None', presetName: 'Title',
    dur: 3, x: 0.5, y: 0.35, rotation: 0
  };
}

function textClipData(d) {
  return {
    text: d.text.trim(),
    fontCss: d.fontCss, size: d.size, color: d.color, stroke: d.stroke, strokeW: d.strokeW,
    shadow: d.shadow, shadowBlur: d.shadowBlur, letterSpacing: d.letterSpacing,
    lineHeight: d.lineHeight, opacity: d.opacity, bold: d.bold, italic: d.italic,
    underline: d.underline, align: d.align, bg: d.bg, animIn: d.animIn, animOut: d.animOut,
    animLoop: d.animLoop, animDur: d.animDur, effectName: d.effectName, effectCss: d.effectCss,
    bubble: d.bubble
  };
}

function setupTextModal() {
  $('#textInput').addEventListener('input', () => { readTextForm(); updateTextPreview(); });
  ['textSize', 'textColor', 'textStroke', 'textShadow', 'textShadowBlur', 'textSpacing', 'textLineH', 'textOpacity', 'textDur', 'animDur'].forEach(id => {
    $('#' + id).addEventListener('input', () => { readTextForm(); updateTextPreview(); });
  });
  $('#textBg').addEventListener('input', e => {
    S.textDraft.bg = e.target.value;
    updateTextPreview();
  });
  $('#textBgClear').addEventListener('click', () => {
    S.textDraft.bg = null;
    updateTextPreview();
  });

  $$('#ttab-style .mini-btn').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.align) {
        S.textDraft.align = b.dataset.align;
      } else if (b.dataset.style) {
        const key = b.dataset.style;
        S.textDraft[key] = !S.textDraft[key];
      }
      updateTextPreview();
      syncTextButtons();
    });
  });

  $$('.ttab').forEach(b => {
    b.addEventListener('click', () => {
      $$('.ttab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $$('.ttab-panel').forEach(p => p.classList.add('hidden'));
      const panel = $('#ttab-' + b.dataset.ttab);
      if (panel) panel.classList.remove('hidden');
    });
  });

  buildFontGrid();
  buildAnimList('animIn', window.TEXT_ANIMATIONS_IN || []);
  buildAnimList('animOut', window.TEXT_ANIMATIONS_OUT || []);
  buildAnimList('animLoop', window.TEXT_ANIMATIONS_LOOP || []);
  buildTextEffects();
  buildTextBubbles();
  buildTextPresetChips();

  $('#addTextBtn').addEventListener('click', () => {
    if (S.editingTextClip) updateTextClip();
    else addTextClip();
  });
}

function readTextForm() {
  const d = S.textDraft;
  d.text = $('#textInput').value;
  d.size = Number($('#textSize').value) || 38;
  d.color = $('#textColor').value;
  d.stroke = $('#textStroke').value;
  d.strokeW = Number($('#textStrokeW').value) || 0;
  d.shadow = $('#textShadow').value;
  d.shadowBlur = Number($('#textShadowBlur').value) || 0;
  d.letterSpacing = Number($('#textSpacing').value) || 0;
  d.lineHeight = Number($('#textLineH').value) || 1.2;
  d.opacity = clamp(Number($('#textOpacity').value), 0, 1);
  d.dur = clamp(Number($('#textDur').value) || 3, 0.5, 600);
  d.animDur = clamp(Number($('#animDur').value) || 0.6, 0.2, 2);
}

function updateTextPreview() {
  const el = $('#textPreviewInner');
  if (!el) return;
  applyTextStyles(el, { ...S.textDraft, text: S.textDraft.text || 'Your text' }, true);
  el.style.opacity = String(clamp(Number(S.textDraft.opacity ?? 1), 0, 1));
  el.style.transform = `rotate(${Number(S.textDraft.rotation) || 0}deg)`;
}

function syncTextButtons() {
  const d = S.textDraft;
  $$('#ttab-style .mini-btn').forEach(b => {
    if (b.dataset.align) b.classList.toggle('active', d.align === b.dataset.align);
    else if (b.dataset.style) b.classList.toggle('active', !!d[b.dataset.style]);
  });
  $$('#fontGrid .font-item').forEach(el => el.classList.toggle('active', el.dataset.css === d.fontCss));
  $$('#animIn .anim-chip').forEach(b => b.classList.toggle('active', b.textContent === d.animIn));
  $$('#animOut .anim-chip').forEach(b => b.classList.toggle('active', b.textContent === d.animOut));
  $$('#animLoop .anim-chip').forEach(b => b.classList.toggle('active', b.textContent === d.animLoop));
  $$('#textEffectGrid .effect-chip').forEach(b => b.classList.toggle('active', b.textContent === d.effectName));
  $$('#bubbleGrid .bubble-chip').forEach(b => b.classList.toggle('active', b.textContent === d.bubble));
  $$('.text-preset').forEach(b => b.classList.toggle('active', b.textContent === d.presetName));
  updateTextPreview();
}

function syncTextUI() {
  const d = S.textDraft;
  $('#textInput').value = d.text || '';
  $('#textSize').value = clamp(Number(d.size) || 38, 12, 180);
  $('#textStrokeW').value = clamp(Number(d.strokeW) || 0, 0, 8);
  $('#textShadowBlur').value = clamp(Number(d.shadowBlur) || 0, 0, 30);
  $('#textSpacing').value = clamp(Number(d.letterSpacing) || 0, -5, 20);
  $('#textLineH').value = clamp(Number(d.lineHeight) || 1.2, 0.8, 2.5);
  $('#textOpacity').value = clamp(Number(d.opacity ?? 1), 0, 1);
  $('#textDur').value = clamp(Number(d.dur) || 3, 0.5, 600);
  $('#animDur').value = clamp(Number(d.animDur) || 0.6, 0.2, 2);
  safeColor('#textColor', d.color || '#ffffff');
  safeColor('#textStroke', d.stroke || '#000000');
  safeColor('#textShadow', d.shadow || '#000000');
  safeColor('#textBg', d.bg || '#000000');
  syncTextButtons();
}

function safeColor(selector, value) {
  const el = $(selector);
  if (/^#[0-9a-f]{6}$/i.test(value)) el.value = value;
  else el.value = '#000000';
}

function buildFontGrid() {
  const fg = $('#fontGrid');
  fg.innerHTML = '';
  (window.TEXT_FONTS || []).forEach(f => {
    const el = document.createElement('div');
    el.className = 'font-item';
    el.textContent = f.name;
    el.style.fontFamily = f.css;
    el.dataset.css = f.css;
    el.dataset.name = f.name;
    el.addEventListener('click', () => {
      S.textDraft.fontCss = f.css;
      S.textDraft.fontName = f.name;
      syncTextButtons();
    });
    fg.appendChild(el);
  });
}

function buildAnimList(id, list) {
  const wrap = $('#' + id);
  const label = wrap.querySelector('.anim-label');
  wrap.innerHTML = '';
  if (label) wrap.appendChild(label);
  const prop = id === 'animIn' ? 'animIn' : id === 'animOut' ? 'animOut' : 'animLoop';
  list.forEach(name => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'anim-chip';
    b.textContent = name;
    b.addEventListener('click', () => {
      S.textDraft[prop] = name;
      syncTextButtons();
    });
    wrap.appendChild(b);
  });
}

function buildTextEffects() {
  const eg = $('#textEffectGrid');
  eg.innerHTML = '';
  (window.TEXT_EFFECTS || []).forEach(eff => {
    const b = document.createElement('div');
    b.className = 'effect-chip';
    b.textContent = eff.name;
    b.addEventListener('click', () => {
      S.textDraft.effectName = eff.name;
      S.textDraft.effectCss = eff.css;
      syncTextButtons();
    });
    eg.appendChild(b);
  });
}

function buildTextBubbles() {
  const bg = $('#bubbleGrid');
  bg.innerHTML = '';
  (window.TEXT_BUBBLES || []).forEach(name => {
    const el = document.createElement('div');
    el.className = 'bubble-chip';
    el.textContent = name;
    el.addEventListener('click', () => {
      S.textDraft.bubble = name;
      syncTextButtons();
    });
    bg.appendChild(el);
  });
}

function buildTextPresetChips() {
  const tp = $('#textPresets');
  tp.innerHTML = '';
  TEXT_PRESETS.forEach(name => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'text-preset';
    el.textContent = name;
    el.addEventListener('click', () => applyTextPreset(name));
    tp.appendChild(el);
  });
}

function applyTextPreset(name) {
  const sets = {
    Title: { size: 64, bold: true, strokeW: 2, color: '#ffffff', fontCss: 'sans-serif', effectName: 'Shadow', effectCss: 'text-shadow:3px 3px 0 rgba(0,0,0,0.8),6px 6px 12px rgba(0,0,0,0.5);' },
    Subtitle: { size: 36, bold: false, strokeW: 0, color: '#ffffff', fontCss: 'sans-serif', effectName: 'None', effectCss: '' },
    Caption: { size: 24, bold: true, strokeW: 2, color: '#ffffff', fontCss: 'sans-serif', effectName: 'None', effectCss: '' },
    Quote: { size: 32, bold: false, italic: true, color: '#ffe08a', fontCss: 'Georgia, serif', bubble: 'Quote', effectName: 'None', effectCss: '' },
    Neon: { size: 50, bold: true, color: '#3df2b2', effectName: 'Neon', effectCss: 'text-shadow:0 0 8px currentColor,0 0 16px currentColor,0 0 32px currentColor;' },
    Retro: { size: 44, bold: true, color: '#ffb347', fontCss: 'Impact, sans-serif', effectName: 'Retro', effectCss: 'text-shadow:3px 3px 0 #ff5470,6px 6px 0 #4ea8ff;' },
    Minimal: { size: 34, bold: false, color: '#ffffff', fontCss: 'sans-serif', bubble: 'None', effectName: 'None', effectCss: '' },
    Animated: { size: 50, bold: true, color: '#ffffff', animIn: 'Pop In', animLoop: 'Pulse', effectName: 'None', effectCss: '' }
  };
  const set = sets[name] || sets.Title;
  const keep = { text: S.textDraft.text, dur: S.textDraft.dur, x: S.textDraft.x, y: S.textDraft.y, rotation: S.textDraft.rotation };
  S.textDraft = { ...defaultTextDraft(), ...set, ...keep, presetName: name };
  syncTextUI();
}

function openTextModal(preset) {
  pause();
  S.textDraft = defaultTextDraft();
  S.editingTextClip = null;
  $('#addTextBtn').textContent = 'Add to Timeline';
  $$('.ttab').forEach(x => x.classList.toggle('active', x.dataset.ttab === 'style'));
  $$('.ttab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'ttab-style'));
  $('#textModal').classList.remove('hidden');
  if (preset) applyTextPreset(preset);
  syncTextUI();
  setTimeout(() => { try { $('#textInput').focus(); } catch (e) {} }, 200);
}

function openTextFor(c) {
  pause();
  S.editingTextClip = c;
  const base = defaultTextDraft();
  S.textDraft = {
    ...base,
    ...textClipData({ ...base, ...c }),
    text: c.text || '',
    dur: c.duration(),
    x: c.x ?? 0.5,
    y: c.y ?? 0.35,
    rotation: c.rotation || 0,
    presetName: ''
  };
  $('#addTextBtn').textContent = 'Update Text';
  $('#textModal').classList.remove('hidden');
  syncTextUI();
}

function hideTextModal() {
  $('#textModal').classList.add('hidden');
  S.editingTextClip = null;
  $('#addTextBtn').textContent = 'Add to Timeline';
}

function addTextClip() {
  readTextForm();
  if (!S.textDraft.text.trim()) { toast('Enter some text first'); return; }
  const d = S.textDraft;
  const start = clamp(S.playhead, 0, Math.max(0, totalDur() - 0.1));
  const c = installClip({
    id: uid(), type: 'text', ...textClipData(d),
    start, end: start + d.dur, offset: 0, mediaDur: d.dur, z: 10,
    x: d.x ?? 0.5, y: d.y ?? 0.35, rotation: d.rotation || 0, keyframes: []
  });
  S.clips.push(c);
  hideTextModal();
  renderTimeline();
  select(c.id);
  render();
  saveHistory();
  toast('Text added — drag it on the preview');
}

function updateTextClip() {
  readTextForm();
  const c = S.editingTextClip;
  if (!c) { hideTextModal(); return; }
  if (!S.textDraft.text.trim()) { toast('Enter some text first'); return; }
  const d = S.textDraft;
  Object.assign(c, textClipData(d));
  c.end = c.start + d.dur;
  if (Number.isFinite(d.rotation)) c.rotation = d.rotation;
  hideTextModal();
  renderTimeline();
  refreshPanel();
  render();
  saveHistory();
  toast('Text updated');
}


/* ---------------- preset validation ---------------- */
const FILTER_LIMITS = {
  brightness: [0.1, 3], contrast: [0.1, 3], saturate: [0, 4], hueRotate: [-180, 180],
  sepia: [0, 1], grayscale: [0, 1], blurpx: [0, 20], warmth: [-1, 1],
  tint: [-1, 1], fade: [0, 1], vignette: [0, 1]
};

function sanitizeFilters(f) {
  const out = {};
  if (!f || typeof f !== 'object') return out;
  for (const k in FILTER_LIMITS) {
    if (f[k] == null || f[k] === '') continue;
    const v = Number(f[k]);
    if (Number.isFinite(v)) out[k] = clamp(v, FILTER_LIMITS[k][0], FILTER_LIMITS[k][1]);
  }
  return out;
}

const TEXT_STYLE_KEYS = [
  'fontCss', 'fontName', 'size', 'color', 'stroke', 'strokeW', 'shadow', 'shadowBlur',
  'letterSpacing', 'lineHeight', 'opacity', 'bold', 'italic', 'underline', 'align',
  'bg', 'animIn', 'animOut', 'animLoop', 'animDur', 'effectName', 'effectCss', 'bubble'
];

function sanitizeTextStyle(t) {
  if (!t || typeof t !== 'object') return null;
  const out = {};
  for (const k of TEXT_STYLE_KEYS) {
    const v = t[k];
    if (v == null) continue;
    if (k === 'fontCss' || k === 'fontName') {
      if (typeof v === 'string' && v.length < 120 && !/url\s*\(|javascript:|expression/i.test(v)) out[k] = v;
    } else if (k === 'color' || k === 'stroke' || k === 'shadow' || k === 'bg') {
      if (isColor(v)) out[k] = String(v).slice(0, 40);
    } else if (k === 'effectCss') {
      if (typeof v === 'string' && v.length < 600) out[k] = v;
    } else if (k === 'effectName') {
      if (typeof v === 'string' && ['None', ...((window.TEXT_EFFECTS || []).map(e => e.name))].includes(v)) out[k] = v;
    } else if (k === 'animIn' || k === 'animOut' || k === 'animLoop') {
      const list = k === 'animIn' ? window.TEXT_ANIMATIONS_IN : k === 'animOut' ? window.TEXT_ANIMATIONS_OUT : window.TEXT_ANIMATIONS_LOOP;
      if (Array.isArray(list) && list.includes(v)) out[k] = v;
    } else if (k === 'bubble') {
      if (Array.isArray(window.TEXT_BUBBLES) && window.TEXT_BUBBLES.includes(v)) out[k] = v;
    } else if (k === 'align') {
      if (['left', 'center', 'right'].includes(v)) out[k] = v;
    } else if (k === 'bold' || k === 'italic' || k === 'underline') {
      if (typeof v === 'boolean') out[k] = v;
    } else {
      const n = Number(v);
      if (Number.isFinite(n)) {
        const lim = k === 'size' ? [8, 400] : k === 'strokeW' ? [0, 12] : k === 'shadowBlur' ? [0, 60]
          : k === 'letterSpacing' ? [-10, 30] : k === 'lineHeight' ? [0.7, 3] : k === 'opacity' ? [0, 1]
            : k === 'animDur' ? [0.2, 2] : [0, 1];
        out[k] = clamp(n, lim[0], lim[1]);
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

function sanitizePresetData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const effect = typeof data.effect === 'string' && (window.PRESETS_EFFECTS || []).includes(data.effect) ? data.effect : null;
  return { filters: sanitizeFilters(data.filters), effect, textStyle: sanitizeTextStyle(data.textStyle) };
}

/* ---------------- presets ---------------- */
function setupPresetModal() {
  $('#importPreset').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) importPresetFile(f, false);
    e.target.value = '';
  });
  $('#exportPreset').addEventListener('click', saveCurrentAsPreset);
}

function openPresetModal() {
  pause();
  const list = $('#presetList');
  list.innerHTML = '';
  const c = selected();
  if (c && !$('#presetName').value) $('#presetName').value = (c.name || c.type + ' preset').slice(0, 40);
  const all = [
    ...(window.BUILTIN_PRESETS || []).map(p => ({ name: p.name, data: p.data, builtin: true })),
    ...loadUserPresets().map((p, i) => ({ name: p.name, data: p.data, builtin: false, index: i }))
  ];
  if (!all.length) list.appendChild(hint('No presets saved yet.'));
  all.forEach(p => {
    const row = document.createElement('div');
    row.className = 'preset-item';
    row.innerHTML = `<strong>${esc(p.name)}</strong><span class="preset-actions"></span>`;
    const actions = $('.preset-actions', row);
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'mini-btn';
    apply.textContent = 'Apply';
    apply.addEventListener('click', () => {
      const clip = selected();
      if (!clip) { toast('Select a clip first'); return; }
      applyPresetToClip(clip, p.data);
      toast(`Applied “${p.name}”`);
      closeModal($('#presetModal'));
    });
    actions.appendChild(apply);
    if (!p.builtin) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'mini-btn';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (!confirm(`Delete preset “${p.name}”?`)) return;
        const list = loadUserPresets();
        list.splice(p.index, 1);
        if (!saveUserPresets(list)) { toast('Could not save presets'); return; }
        openPresetModal();
        refreshHome();
      });
      actions.appendChild(del);
    }
    list.appendChild(row);
  });
  $('#presetModal').classList.remove('hidden');
}

function applyPresetToClip(c, data) {
  const clean = sanitizePresetData(data);
  if (!clean) return;
  c.filters = { ...clean.filters };
  c.effect = clean.effect;
  c.overlayColor = null;
  if (clean.textStyle && c.type === 'text') Object.assign(c, clean.textStyle);
  renderTimeline();
  render();
  refreshPanel();
  saveHistory();
}

function importPresetFile(file, fromHome) {
  if (!file) return;
  if (file.size > 512 * 1024) { toast('Preset file is too large'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let d = JSON.parse(String(reader.result));
      if (d && d.data && typeof d.data === 'object' && !Array.isArray(d.data) && !d.filters) d = { ...d.data, name: d.name || d.data.name };
      if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('bad preset');
      const name = String(d.name || file.name.replace(/\.[^.]+$/, '') || 'Imported').slice(0, 40);
      const entry = { name, data: sanitizePresetData(d) };
      const user = loadUserPresets();
      user.push(entry);
      if (!saveUserPresets(user)) { toast('Could not save the preset (storage full)'); return; }
      toast('Preset imported');
      refreshHome();
      if (!fromHome) openPresetModal();
    } catch (e) {
      toast('Invalid preset file');
    }
  };
  reader.onerror = () => toast('Could not read the preset file');
  reader.readAsText(file);
}

function saveCurrentAsPreset() {
  const c = selected();
  if (!c) { toast('Select a clip first'); return; }
  const name = ($('#presetName').value || c.name || c.type + ' preset').trim().slice(0, 40);
  if (!name) { toast('Give the preset a name'); return; }
  const textStyle = c.type === 'text'
    ? { size: c.size, color: c.color, fontCss: c.fontCss, strokeW: c.strokeW, bold: c.bold, italic: c.italic, effectCss: c.effectCss, bubble: c.bubble }
    : null;
  const data = { name, filters: { ...(c.filters || {}) }, effect: c.effect || null, textStyle };
  const user = loadUserPresets();
  user.push({ name, data });
  if (!saveUserPresets(user)) { toast('Could not save the preset (storage full)'); return; }
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name.replace(/\s+/g, '_') + '.kcpreset');
  refreshHome();
  openPresetModal();
  toast('Preset saved');
}

/* ---------------- export ---------------- */
function setupExportModal() {
  $('#btnExport').addEventListener('click', () => {
    document.body.classList.remove('exporting');
    $('#exportModal').classList.remove('hidden');
  });
  $('#startExport').addEventListener('click', () => {
    doExport().catch(err => {
      console.error('Export failed', err);
      restoreAfterExport();
      toast('Export failed: ' + (err && err.message ? err.message : err));
    });
  });
  $('#expCancel').addEventListener('click', () => finishExport(true));
  $('#downloadBtn').addEventListener('click', async e => {
    if (!S.lastExport) return;
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      e.preventDefault();
      try {
        const ok = await shareLastExport();
        if (!ok) toast('Download is not available in this app');
      } catch (err) {
        toast('Share failed: ' + (err && err.message ? err.message : err));
      }
    }
  });
}

function exportDimensions(res) {
  const ar = ASPECTS[S.aspect] || 9 / 16;
  let w, h;
  if (ar <= 1) { w = res; h = res / ar; }
  else { h = res; w = res * ar; }
  w = Math.max(2, Math.round(w / 2) * 2);
  h = Math.max(2, Math.round(h / 2) * 2);
  return { w, h };
}

async function doExport() {
  if (S.exportActive) return;
  if (!S.clips.length) { toast('Add at least one clip first'); return; }
  if (!window.MediaRecorder || !canvas.captureStream) { toast('Video export is not supported in this browser'); return; }
  stopPlayback();

  const res = Number($('#expRes').value) || 720;
  const fps = Number($('#expFPS').value) || 30;
  const br = Number($('#expBitrate').value) || 12000000;
  const wm = $('#expWM').value;
  const { w: eW, h: eH } = exportDimensions(res);

  S._exportPrev = { playhead: S.playhead };
  const cssW = canvas._w || (canvas.getBoundingClientRect && canvas.getBoundingClientRect().width) || eW;
  S.exportScale = eW / Math.max(1, cssW);
  S.exportWM = wm !== '0';
  S.exportCancelled = false;

  ensureAudio();
  if (S.audioCtx && S.audioCtx.state !== 'running') {
    try { await S.audioCtx.resume(); } catch (e) {}
  }
  if (S.master) { try { S.master.gain.value = 0; } catch (e) {} }

  try {
    S.exportDest = S.audioCtx ? S.audioCtx.createMediaStreamDestination() : null;
    S.exportActive = true;
    S.exporting = true;
    document.body.classList.add('exporting');
    S.playhead = 0;
    canvas.width = eW;
    canvas.height = eH;
    canvas._w = eW;
    canvas._h = eH;
    render();

    $('#expProgress').classList.remove('hidden');
    $('#expResult').classList.add('hidden');
    $('#expFill').style.width = '0%';
    $('#expStatus').textContent = 'Preparing…';
    $('#startExport').disabled = true;
    $('#expCancel').classList.remove('hidden');

    const videoStream = canvas.captureStream(fps);
    const tracks = [...videoStream.getVideoTracks()];
    if (S.exportDest) tracks.push(...S.exportDest.stream.getAudioTracks());
    const combined = new MediaStream(tracks.filter(Boolean));
    const mime = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4'
    ].find(m => {
      try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; }
    }) || '';
    if (!mime) throw new Error('No supported recording format');

    const rec = new MediaRecorder(combined, {
      mimeType: mime,
      videoBitsPerSecond: br,
      audioBitsPerSecond: 128000
    });
    S._rec = rec;
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = err => {
      console.error('Recorder error', err);
      toast('Recording failed');
      finishExport(true);
    };
    rec.onstop = () => {
      const cancelled = S.exportCancelled;
      const type = (mime.split(';')[0] || 'video/webm');
      restoreAfterExport();
      if (cancelled) { toast('Export cancelled'); return; }
      if (!chunks.length) { toast('Export produced no video data'); return; }
      const blob = new Blob(chunks, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      if (S.lastExport && S.lastExport.url) {
        try { URL.revokeObjectURL(S.lastExport.url); } catch (e) {}
      }
      const url = URL.createObjectURL(blob);
      S.lastExport = { blob, url, ext };
      $('#exportPreview').src = url;
      $('#downloadBtn').href = url;
      $('#downloadBtn').download = `kriticut_${res}p_${Date.now()}.${ext}`;
      $('#expResult').classList.remove('hidden');
      toast('Export complete!');
    };

    S._exportStartedAt = performance.now();
    rec.start(250);
    render();
  } catch (e) {
    const rec = S._rec;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch (err) {}
    }
    restoreAfterExport();
    throw e;
  }
}

function updateExportProgress(now) {
  if (!S.exportActive) return;
  const total = totalDur();
  const elapsed = (now - S._exportStartedAt) / 1000;
  S.playhead = clamp(elapsed, 0, total);
  syncMediaPlayback(S.playhead);
  const p = clamp((S.playhead / total) * 100, 0, 100);
  const fill = $('#expFill');
  if (fill) fill.style.width = p + '%';
  const status = $('#expStatus');
  if (status) status.textContent = `Exporting ${$('#expRes').value}p… ${p.toFixed(0)}% · ${fmtTime(S.playhead)} / ${fmtTime(total)}`;
  updatePlayheadUI();
  if (S.playhead >= total) finishExport(false);
}

function finishExport(cancelled) {
  if (!S.exportActive) return;
  S.exportCancelled = !!cancelled;
  S.exportActive = false;
  S.exporting = false;
  document.body.classList.remove('exporting');
  stopPlayback();
  if (S.master) { try { S.master.gain.value = 1; } catch (e) {} }
  S.exportDest = null;
  const rec = S._rec;
  if (rec && rec.state !== 'inactive') {
    try { rec.stop(); } catch (e) { restoreAfterExport(); }
  } else {
    restoreAfterExport();
  }
}

function restoreAfterExport() {
  S.exportActive = false;
  S.exporting = false;
  S.exportWM = false;
  S.exportScale = 1;
  S.exportDest = null;
  S._rec = null;
  document.body.classList.remove('exporting');
  if (S.master) { try { S.master.gain.value = 1; } catch (e) {} }
  $('#expProgress').classList.add('hidden');
  $('#expCancel').classList.add('hidden');
  $('#startExport').disabled = false;
  $('#expFill').style.width = '0%';
  const prev = S._exportPrev;
  S._exportPrev = null;
  if (prev && Number.isFinite(prev.playhead)) S.playhead = clamp(prev.playhead, 0, totalDur());
  resizeCanvas();
  renderTimeline();
  updatePlayheadUI();
  render();
}

async function shareLastExport() {
  const le = S.lastExport;
  if (!le) return false;
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform() || !C.Plugins) return false;
  const F = C.Plugins.Filesystem;
  const Sh = C.Plugins.Share;
  if (!F || !Sh) return false;
  const b64 = await blobToBase64(le.blob);
  const name = $('#downloadBtn').download || `kriticut.${le.ext}`;
  const res = await F.writeFile({ path: name, data: b64, directory: 'CACHE' });
  if (res && res.uri) {
    if (Sh.share) await Sh.share({ title: 'KritiCut export', url: res.uri });
    return true;
  }
  return false;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    try { URL.revokeObjectURL(url); } catch (e) {}
  }, 1000);
}

/* ---------------- history ---------------- */
function saveHistory() {
  if (S._restoring) { updateUR(); return; }
  S.history = S.history.slice(0, S.historyIdx + 1);
  S.history.push(JSON.stringify({ clips: S.clips.map(serializeClip), playhead: S.playhead, welcomeId: S._welcomeId }));
  if (S.history.length > MAX_HISTORY) S.history.shift();
  S.historyIdx = S.history.length - 1;
  updateUR();
  markDirty();
}

function undo() {
  if (S.historyIdx <= 0) { toast('Nothing to undo'); return; }
  S.historyIdx--;
  loadHist();
  toast('Undo');
}

function redo() {
  if (S.historyIdx >= S.history.length - 1) { toast('Nothing to redo'); return; }
  S.historyIdx++;
  loadHist();
  toast('Redo');
}

function loadHist() {
  const snap = S.history[S.historyIdx];
  if (!snap) return;
  try {
    const d = JSON.parse(snap);
    S.clips = (d.clips || []).map(installClip);
    S._welcomeId = d.welcomeId || null;
    S.playhead = clamp(Number(d.playhead) || 0, 0, totalDur());
    S.selId = null;
    stopPlayback();
    hideClipPanel();
    if (S.tab !== 'edit') renderTab(S.tab);
    renderTimeline();
    render();
    updatePlayheadUI();
    updateUR();
    markDirty();
  } catch (e) { console.warn('History restore failed', e); }
}

function updateUR() {
  const u = $('#btnUndo'), r = $('#btnRedo');
  if (!u || !r) return;
  u.disabled = S.historyIdx <= 0;
  r.disabled = S.historyIdx >= S.history.length - 1;
}

function setupUndoRedo() {
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  updateUR();
}

/* ---------------- keyboard ---------------- */
function setupKeyboard() {
  window.addEventListener('keydown', e => {
    const t = e.target;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      saveDraft().then(() => toast('Draft saved')).catch(() => toast('Could not save the draft'));
      return;
    }
    if (t && t.matches && t.matches('input,textarea,select,[contenteditable]')) {
      if (e.key === 'Escape' && t.id === 'projectName') t.blur();
      return;
    }
    if (editorScreen.classList.contains('hidden')) return;
    const openModal = $$('.modal').some(m => !m.classList.contains('hidden'));
    if (openModal) {
      if (e.code === 'Escape') {
        const m = $$('.modal').find(x => !x.classList.contains('hidden'));
        if (m) closeModal(m);
      }
      return;
    }
    if (e.code === 'Space' && !(t && t.closest && t.closest('button,a'))) { e.preventDefault(); togglePlay(); }
    else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); splitAtPlayhead(); }
    else if ((e.code === 'Delete' || e.code === 'Backspace') && S.selId) { e.preventDefault(); deleteSelected(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); pause(); S.playhead = Math.max(0, S.playhead - (e.shiftKey ? 1 : 1 / 30)); updatePlayheadUI(); render(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); pause(); S.playhead = Math.min(totalDur(), S.playhead + (e.shiftKey ? 1 : 1 / 30)); updatePlayheadUI(); render(); }
    else if (e.code === 'Escape') { deselect(); }
  });
}

/* ---------------- service worker ---------------- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return;
  const register = () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed', err));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/* ---------------- text rendered into the exported video ---------------- */
function textAnimState(c, lt, dur) {
  const st = { alpha: 1, scale: 1, dx: 0, dy: 0, rot: 0, blur: 0, reveal: 1, glow: 0, hue: 0 };
  const ad = clamp(Number(c.animDur) || 0.6, 0.2, 5);
  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  const applyIn = (name, p) => {
    const e = ease(p);
    switch (name) {
      case 'Fade In': st.alpha = e; break;
      case 'Pop In': st.alpha = Math.min(1, p * 2); st.scale = p < 0.7 ? 0.3 + 0.8 * (p / 0.7) : 1.1 - 0.1 * ((p - 0.7) / 0.3); break;
      case 'Slide Up': st.dy = (1 - e) * 0.28; st.alpha = p; break;
      case 'Slide Down': st.dy = -(1 - e) * 0.28; st.alpha = p; break;
      case 'Slide Left': st.dx = (1 - e) * 0.32; st.alpha = p; break;
      case 'Slide Right': st.dx = -(1 - e) * 0.32; st.alpha = p; break;
      case 'Typewriter': st.reveal = p; break;
      case 'Scale In': st.scale = 3 - 2 * e; st.alpha = e; break;
      case 'Blur In': st.blur = (1 - e) * 20; st.alpha = e; break;
      case 'Spin In': st.rot = -360 * (1 - e); st.scale = e; st.alpha = e; break;
      case 'Wave': st.rot = Math.sin(p * Math.PI * 4) * 5; st.alpha = p; break;
      default: break;
    }
  };
  const applyOut = (name, p) => {
    const e = ease(p);
    switch (name) {
      case 'Fade Out': st.alpha = 1 - e; break;
      case 'Pop Out': st.alpha = 1 - e; st.scale = 1 - 0.7 * e; break;
      case 'Slide Up Out': st.dy = -e * 0.28; st.alpha = 1 - e; break;
      case 'Slide Down Out': st.dy = e * 0.28; st.alpha = 1 - e; break;
      case 'Slide Left Out': st.dx = -e * 0.32; st.alpha = 1 - e; break;
      case 'Slide Right Out': st.dx = e * 0.32; st.alpha = 1 - e; break;
      case 'Scale Out': st.scale = 1 + 2 * e; st.alpha = 1 - e; break;
      case 'Blur Out': st.blur = e * 20; st.alpha = 1 - e; break;
      default: break;
    }
  };

  if (c.animIn && c.animIn !== 'None' && lt < ad) applyIn(c.animIn, clamp(lt / ad, 0, 1));
  else if (c.animOut && c.animOut !== 'None' && lt > dur - ad) applyOut(c.animOut, clamp((lt - (dur - ad)) / ad, 0, 1));
  else if (c.animLoop && c.animLoop !== 'None') {
    switch (c.animLoop) {
      case 'Pulse': st.scale = 1 + Math.sin(lt * 4) * 0.08; break;
      case 'Bounce': st.dy = -Math.abs(Math.sin(lt * 4)) * 0.03; break;
      case 'Wave': st.rot = Math.sin(lt * 4) * 5; break;
      case 'Shake': st.dx = Math.sin(lt * 30) * 0.008; break;
      case 'Glow': st.glow = 1; break;
      case 'Rainbow': st.hue = (lt * 120) % 360; break;
      case 'Neon Flicker': st.alpha = Math.sin(lt * 20) > 0.3 ? 1 : 0.6; break;
      case 'Blink': st.alpha = Math.floor(lt * 2) % 2 ? 1 : 0.2; break;
      default: break;
    }
  }
  return st;
}

function roundRectPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function bubblePalette(name) {
  switch (name) {
    case 'Rectangle': return { bg: 'rgba(0,0,0,0.65)', fg: null, radius: 2 };
    case 'Rounded': return { bg: 'rgba(0,0,0,0.65)', fg: null, radius: 14 };
    case 'Pill': return { bg: 'rgba(0,0,0,0.65)', fg: null, radius: 999 };
    case 'Cloud': return { bg: '#ffffff', fg: '#111111', radius: 26 };
    case 'Arrow Down': return { bg: '#ffffff', fg: '#111111', radius: 6, arrow: 'down' };
    case 'Arrow Up': return { bg: '#ffffff', fg: '#111111', radius: 6, arrow: 'up' };
    case 'Quote': return { bg: null, fg: null, radius: 0, quote: true };
    case 'Callout': return { bg: '#ffffff', fg: '#111111', radius: 14 };
    case 'Sticker': return { bg: '#ffffff', fg: '#111111', radius: 10 };
    case 'Neon Box': return { bg: 'rgba(0,0,0,0.15)', fg: null, radius: 10, neon: true };
    default: return { bg: null, fg: null, radius: 0 };
  }
}

function wrapTextLines(text, maxWidth, size) {
  const lines = [];
  const pushChars = word => {
    let cur = '';
    for (const ch of word) {
      if (cur && ctx.measureText(cur + ch).width > maxWidth) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
  };
  for (const para of String(text).split('\n')) {
    if (!para) { lines.push(''); continue; }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
      if (line) lines.push(line);
      if (ctx.measureText(word).width > maxWidth) { pushChars(word); line = ''; }
      else line = word;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function drawTextClipsOnCanvas(t, ox, oy, dw, dh) {
  const scale = S.exportScale || 1;
  for (const c of S.clips) {
    if (c.type !== 'text') continue;
    if (c.start > t || c.end <= t) continue;
    const rawText = String(c.text || '');
    if (!rawText.trim()) continue;
    const kf = c._kf || {};
    const anim = textAnimState(c, t - c.start, c.duration());
    const opacity = clamp(Number(kf.opacity ?? c.opacity ?? 1), 0, 1) * anim.alpha;
    if (opacity <= 0.01) continue;

    const x = ox + dw * clamp(Number(kf.x ?? c.x ?? 0.5), 0, 1) + anim.dx * dw;
    const y = oy + dh * clamp(Number(kf.y ?? c.y ?? 0.35), 0, 1) + anim.dy * dh;
    const size = clamp(Number(kf.size ?? c.size ?? 38), 8, 400) * scale;
    const rot = (Number(kf.rot ?? c.rotation ?? 0) + anim.rot) * Math.PI / 180;
    const sc = (Number(kf.scale ?? 1) || 1) * anim.scale;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    let filter = '';
    if (anim.blur > 0) filter += `blur(${anim.blur * scale}px) `;
    if (anim.hue > 0) filter += `hue-rotate(${anim.hue}deg) `;
    if (filter && 'filter' in ctx) ctx.filter = filter;

    const italic = c.italic || c.bubble === 'Quote';
    ctx.font = `${italic ? 'italic ' : ''}${c.bold === false ? '500' : '800'} ${size}px ${c.fontCss || 'sans-serif'}`;
    if ('letterSpacing' in ctx) {
      try { ctx.letterSpacing = ((Number(c.letterSpacing) || 0) * scale) + 'px'; } catch (e) {}
    }
    ctx.textBaseline = 'middle';

    const bubble = bubblePalette(c.bubble);
    let text = rawText;
    if (bubble.quote && !/^[“"]/.test(text)) text = '“' + text + '”';
    const padX = (c.bubble === 'None' ? (c.bg ? 8 : 0) : c.bubble === 'Pill' ? 20 : 14) * scale;
    const padY = (c.bubble === 'None' ? (c.bg ? 4 : 0) : 8) * scale;
    const maxWidth = Math.max(size * 2, dw * 0.9 - padX * 2);
    const lines = wrapTextLines(text, maxWidth, size);
    const lineH = size * (Number(c.lineHeight) || 1.2);
    const totalH = lines.length * lineH;
    let maxW = 0;
    for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
    const boxW = maxW + padX * 2;
    const boxH = totalH + padY * 2;
    let revealChars = Infinity;
    if (anim.reveal < 1) {
      let totalChars = 0;
      for (const line of lines) totalChars += line.length;
      revealChars = Math.ceil(totalChars * anim.reveal);
    }

    const eff = safeEffectStyle(c.effectCss);
    const strokeFromEffect = eff['-webkit-text-stroke'] || eff['-webkit-text-stroke-width'];
    let strokeW = Number(c.strokeW) || 0;
    let strokeColor = c.stroke || '#000000';
    if (strokeFromEffect) {
      const m = String(strokeFromEffect).match(/([0-9.]+)px\s*(.*)/);
      if (m) { strokeW = Number(m[1]) || strokeW; if (m[2]) strokeColor = m[2].trim(); }
      if (strokeColor === 'currentColor') strokeColor = c.color || '#ffffff';
    }
    const colorTransparent = String(eff.color || eff['-webkit-text-fill-color'] || '').includes('transparent');
    const bubbleBg = c.bg || bubble.bg;
    const textColor = bubble.fg && (!c.color || c.color === '#ffffff') && !c.bg ? bubble.fg : (c.color || '#ffffff');

    // Bubble / background
    if (bubbleBg) {
      ctx.save();
      ctx.fillStyle = bubbleBg;
      if (bubble.arrow === 'down') {
        ctx.beginPath();
        ctx.moveTo(-boxW / 2, -boxH / 2 - padY);
        ctx.lineTo(boxW / 2, -boxH / 2 - padY);
        ctx.lineTo(boxW / 2, boxH / 2 - padY * 0.2);
        ctx.lineTo(0, boxH / 2 + padY);
        ctx.lineTo(-boxW / 2, boxH / 2 - padY * 0.2);
        ctx.closePath();
        ctx.fill();
      } else if (bubble.arrow === 'up') {
        ctx.beginPath();
        ctx.moveTo(-boxW / 2, -boxH / 2 + padY * 0.2);
        ctx.lineTo(0, -boxH / 2 - padY);
        ctx.lineTo(boxW / 2, -boxH / 2 + padY * 0.2);
        ctx.lineTo(boxW / 2, boxH / 2 + padY);
        ctx.lineTo(-boxW / 2, boxH / 2 + padY);
        ctx.closePath();
        ctx.fill();
      } else {
        roundRectPath(-boxW / 2, -boxH / 2, boxW, boxH, bubble.radius * scale);
        ctx.fill();
      }
      if (bubble.neon) {
        ctx.strokeStyle = c.color || '#3df2b2';
        ctx.lineWidth = 2 * scale;
        ctx.shadowColor = c.color || '#3df2b2';
        ctx.shadowBlur = 16 * scale;
        roundRectPath(-boxW / 2, -boxH / 2, boxW, boxH, bubble.radius * scale);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
    if (bubble.quote) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-boxW / 2 - 6 * scale, -boxH / 2, 4 * scale, boxH);
      ctx.restore();
    }

    // Effect colours / shadow
    let fillStyle = textColor;
    let gradient = null;
    const bgGradient = String(eff.background || eff['background-image'] || '');
    if (/gradient/i.test(bgGradient)) {
      const stops = [...bgGradient.matchAll(/#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)].map(m => m[0]);
      if (stops.length) {
        gradient = ctx.createLinearGradient(-maxW / 2, 0, maxW / 2, 0);
        stops.forEach((col, i) => gradient.addColorStop(i / Math.max(1, stops.length - 1), col));
      }
    }
    let shadowBlur = Number(c.shadowBlur) > 0 ? Number(c.shadowBlur) * scale : 4 * scale;
    let shadowColor = Number(c.shadowBlur) > 0 ? (c.shadow || '#000000') : 'rgba(0,0,0,0.6)';
    const shadowRule = String(eff['text-shadow'] || '');
    const sh = shadowRule.match(/(?:0\s+){0,2}([0-9.]+)px\s+(.*)/);
    if (sh) {
      shadowBlur = (Number(sh[1]) || 0) * scale;
      if (/currentColor/i.test(shadowRule)) shadowColor = c.color || '#ffffff';
      else {
        const colMatch = shadowRule.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/i);
        if (colMatch) shadowColor = colMatch[0];
      }
    }
    if (anim.glow) shadowBlur = 24 * scale, shadowColor = c.color || '#ffffff';
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;

    const align = c.align || 'center';
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (revealChars !== Infinity) {
        line = line.slice(0, Math.max(0, revealChars));
        revealChars -= lines[i].length;
      }
      let lx;
      if (align === 'left') { lx = -maxW / 2; ctx.textAlign = 'left'; }
      else if (align === 'right') { lx = maxW / 2; ctx.textAlign = 'right'; }
      else { lx = 0; ctx.textAlign = 'center'; }
      const ly = -totalH / 2 + lineH * (i + 0.5);
      if (strokeW > 0) {
        ctx.lineWidth = Math.max(1, strokeW * scale * 2);
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, lx, ly);
      }
      if (!colorTransparent || gradient || bubble.fg) {
        ctx.fillStyle = gradient || (bubble.fg && (!c.color || c.color === '#ffffff') && !c.bg ? bubble.fg : fillStyle);
        if (strokeW > 0 && colorTransparent) ctx.fillStyle = gradient || strokeColor;
        if (!(strokeW > 0 && colorTransparent && !gradient)) ctx.fillText(line, lx, ly);
      }
      if (c.underline) {
        const uw = ctx.measureText(line).width;
        let ux = lx;
        if (align === 'center') ux = lx - uw / 2;
        else if (align === 'right') ux = lx - uw;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = gradient ? (textColor || '#ffffff') : (c.color || textColor || '#ffffff');
        ctx.lineWidth = Math.max(1, size * 0.05);
        ctx.beginPath();
        ctx.moveTo(ux, ly + size * 0.34);
        ctx.lineTo(ux + uw, ly + size * 0.34);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

})();
