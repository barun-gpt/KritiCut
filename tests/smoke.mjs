#!/usr/bin/env node
/* Headless smoke test: boots the real index.html + app.js in jsdom with
 * canvas/media/audio/recorder stubs and exercises the main editor flows.
 * Run with: npm test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdom: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.indexedDB = indexedDB;
    window.IDBKeyRange = window.IDBKeyRange || undefined;

    const noop = () => {};
    const gradient = { addColorStop: noop };
    const ctx2d = new Proxy({
      measureText: text => ({ width: String(text).length * 10 }),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      createPattern: () => ({}),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: noop,
      drawImage: noop,
      save: noop,
      restore: noop
    }, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'symbol') return undefined;
        return noop;
      },
      set(target, prop, value) { target[prop] = value; return true; }
    });

    window.HTMLCanvasElement.prototype.getContext = function () { return ctx2d; };
    window.HTMLCanvasElement.prototype.captureStream = function () { return new window.MediaStream(); };
    window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,eA=='; };
    window.HTMLCanvasElement.prototype.toBlob = function (cb) {
      setTimeout(() => cb(new window.Blob(['x'], { type: 'image/png' })), 0);
    };

    class FakeMediaStream {
      constructor() { this.tracks = []; }
      addTrack(t) { this.tracks.push(t); }
      getTracks() { return this.tracks; }
      getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
      getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
    }
    window.MediaStream = FakeMediaStream;

    window.MediaRecorder = class {
      static isTypeSupported() { return true; }
      constructor(stream) { this.stream = stream; this.state = 'inactive'; }
      start() { this.state = 'recording'; }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        setTimeout(() => {
          if (this.ondataavailable) this.ondataavailable({ data: new window.Blob(['video'], { type: 'video/webm' }) });
          if (this.onstop) this.onstop();
        }, 0);
      }
    };

    const gain = () => ({
      gain: { value: 1, setValueAtTime: noop, linearRampToValueAtTime: noop, cancelScheduledValues: noop },
      connect() { return this; },
      disconnect: noop
    });
    window.AudioContext = class {
      constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
      resume() { return Promise.resolve(); }
      createGain() { return gain(); }
      createMediaElementSource() { return { connect() { return this; }, disconnect: noop }; }
      createMediaStreamDestination() { return { stream: new window.MediaStream(), connect() { return this; } }; }
    };
    window.webkitAudioContext = window.AudioContext;

    window.HTMLMediaElement.prototype.play = function () { this.paused = false; return Promise.resolve(); };
    window.HTMLMediaElement.prototype.pause = function () { this.paused = true; };
    window.HTMLMediaElement.prototype.load = noop;

    // Pretend every media URL loads instantly so import/restore can be tested.
    const srcDesc = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'src');
    Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
      configurable: true,
      get() { return srcDesc.get.call(this); },
      set(v) {
        srcDesc.set.call(this, v);
        const el = this;
        setTimeout(() => {
          if (el.tagName === 'VIDEO') {
            Object.defineProperty(el, 'videoWidth', { value: 640, configurable: true });
            Object.defineProperty(el, 'videoHeight', { value: 360, configurable: true });
          }
          Object.defineProperty(el, 'readyState', { value: 2, configurable: true });
          Object.defineProperty(el, 'duration', { value: 12, configurable: true });
          el.dispatchEvent(new window.Event('loadedmetadata'));
          el.dispatchEvent(new window.Event('loadeddata'));
        }, 0);
      }
    });

    const OrigImage = window.Image;
    window.Image = function () {
      const img = new OrigImage();
      let src = '';
      Object.defineProperty(img, 'src', {
        configurable: true,
        get() { return src; },
        set(v) {
          src = v;
          setTimeout(() => {
            Object.defineProperty(img, 'complete', { value: true, configurable: true });
            Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { value: 800, configurable: true });
            img.dispatchEvent(new window.Event('load'));
          }, 0);
        }
      });
      return img;
    };
    window.Image.prototype = OrigImage.prototype;

    let urlN = 0;
    window.URL.createObjectURL = () => 'blob:test/' + (++urlN);
    window.URL.revokeObjectURL = noop;

    window.confirm = () => true;
    window.alert = noop;
    window.scrollTo = noop;
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: noop, removeEventListener: noop }));

    const makeRect = (w, h) => ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} });
    window.Element.prototype.getBoundingClientRect = function () {
      if (this.id === 'previewWrap') return makeRect(400, 700);
      if (this.id === 'timelineScroll') return makeRect(640, 200);
      if (this.id === 'previewCanvas') return makeRect(376, 668);
      return makeRect(400, 300);
    };
    Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { return 320; }, configurable: true });
    Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { get() { return 44; }, configurable: true });
    window.HTMLElement.prototype.scrollIntoView = noop;
  }
});

const { window } = dom;
const { document } = window;
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const click = el => {
  if (!el) throw new Error('click target missing');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
let failed = 0;
const check = (cond, label) => {
  if (cond) console.log('  ✓ ' + label);
  else { failed++; console.error('  ✗ ' + label); }
};

const scriptOrder = ['filters.js', 'text-features.js', 'presets-data.js', 'app.js'];
for (const file of scriptOrder) {
  const script = document.createElement('script');
  script.textContent = fs.readFileSync(path.join(ROOT, file), 'utf8');
  document.body.appendChild(script);
}

try {
  await wait(250);
  console.log('\nBoot & home');
  check(!$('#homeScreen').classList.contains('hidden'), 'home screen is visible');
  check($$('.template-card').length === 10, '10 project templates rendered');
  check(errors.length === 0, 'no startup errors');

  console.log('\nProject + timeline');
  click($('#btnNewProject'));
  await wait(120);
  check(!$('#editorScreen').classList.contains('hidden'), 'editor opened');
  check($$('#videoClips .clip').length >= 1, 'welcome clip created');
  check($('#previewCanvas').width > 0, 'preview canvas sized');

  click($('#btnAdd'));
  await wait(30);
  click($('#addSample'));
  await wait(80);
  check($$('.clip').some(el => /Sample/.test(el.title)), 'sample replaced the starter clip');
  const beforeSplit = $$('.clip').length;

  click($('#btnPlay'));
  await wait(260);
  check($('#bigPlay').classList.contains('hidden'), 'playback started');
  click($('#btnPlay'));
  await wait(60);
  check(!$('#bigPlay').classList.contains('hidden'), 'playback paused');

  const scroller = $('#timelineScroll');
  scroller.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 60, clientY: 5 }));
  await wait(30);
  click($('#btnSplit'));
  await wait(60);
  check($$('.clip').length === beforeSplit + 1, 'split added a clip');

  click($('#btnUndo'));
  await wait(50);
  check($$('.clip').length === beforeSplit, 'undo restored the clip count');
  click($('#btnRedo'));
  await wait(50);
  check($$('.clip').length === beforeSplit + 1, 'redo re-applied the split');

  console.log('\nMedia import');
  click($('#btnAdd'));
  await wait(30);
  const file = new window.File([new Uint8Array([0, 1, 2, 3, 4])], 'clip.mp4', { type: 'video/mp4' });
  const fileInput = $('#importVideo');
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fire(fileInput, 'change');
  await wait(500);
  check($$('#mediaLibrary .media-lib-item').length === 1, 'media library shows the imported video');
  check($$('#videoClips .clip').length >= beforeSplit + 2, 'video clip added to the timeline');
  click($('#importModal .close-btn'));
  await wait(20);

  console.log('\nTabs, text and keyframes');
  click($('[data-tab="filters"]'));
  await wait(30);
  check(!!$('#inlinePanel'), 'filters panel rendered');
  click($('[data-tab="text"]'));
  await wait(30);
  const addText = $$('#inlinePanel .clip-action').find(b => /Add text/i.test(b.textContent));
  click(addText);
  await wait(40);
  check(!$('#textModal').classList.contains('hidden'), 'text modal opened');
  const ta = $('#textInput');
  ta.value = 'Hello KritiCut';
  fire(ta, 'input');
  click($('#addTextBtn'));
  await wait(80);
  check($$('#overlayLayer .overlay-text').length === 1, 'text overlay rendered on preview');
  check($$('#textClips .clip').length === 1, 'text clip on the text track');

  click($('[data-tab="keyframes"]'));
  await wait(30);
  const addKey = $$('#inlinePanel .clip-action').find(b => /Add key/i.test(b.textContent));
  click(addKey);
  await wait(50);
  check($$('.kf-tick').length >= 1 || $$('.kf-dot').length >= 1, 'keyframe marker rendered');

  console.log('\nAspect, presets, export dialog');
  const aspect = $('#aspectSelect');
  aspect.value = '16:9';
  fire(aspect, 'change');
  await wait(50);
  check(aspect.value === '16:9', 'aspect changed');
  click($('#btnPreset'));
  await wait(30);
  check(!$('#presetModal').classList.contains('hidden'), 'presets modal opened');
  click($('#presetModal .close-btn'));
  await wait(20);
  click($('#btnExport'));
  await wait(30);
  check(!$('#exportModal').classList.contains('hidden'), 'export modal opened');
  click($('#exportModal .close-btn'));
  await wait(20);

  console.log('\nExport pipeline');
  click($('#btnExport'));
  await wait(20);
  // Fast-forward the rAF clock so the real-time recorder finishes quickly.
  const realRaf = window.requestAnimationFrame;
  const realCancel = window.cancelAnimationFrame;
  let fakeTs = window.performance.now();
  window.requestAnimationFrame = cb => window.setTimeout(() => { fakeTs += 250; cb(fakeTs); }, 4);
  window.cancelAnimationFrame = id => window.clearTimeout(id);
  click($('#startExport'));
  await wait(2200);
  window.requestAnimationFrame = realRaf;
  window.cancelAnimationFrame = realCancel;
  check(!$('#expResult').classList.contains('hidden'), 'export produced a video blob');
  check(/^blob:/.test($('#downloadBtn').href), 'download link points at the export');
  if (!$('#exportModal').classList.contains('hidden')) {
    const cancel = $('#expCancel');
    if (cancel && !cancel.classList.contains('hidden')) click(cancel);
    await wait(100);
    click($('#exportModal .close-btn'));
    await wait(20);
  }

  console.log('\nDraft persistence');
  const beforeDraft = $$('.clip').length;
  await wait(900);
  click($('#btnHome'));
  await wait(300);
  check(!$('#homeScreen').classList.contains('hidden'), 'returned home');
  click($('#btnOpenProject'));
  await wait(600);
  check(!$('#editorScreen').classList.contains('hidden'), 'draft reopened editor');
  check($$('.clip').length === beforeDraft, 'draft restored all clips');
  check($$('#overlayLayer .overlay-text').length === 1, 'draft restored text overlay');

  await wait(200);
} catch (err) {
  failed++;
  console.error('\nFATAL:', err && err.stack ? err.stack : err);
}

if (errors.length) {
  console.error('\nConsole/runtime errors:');
  for (const e of errors.slice(0, 12)) console.error(' - ' + e);
  failed++;
}

try { window.close(); } catch (e) {}
if (failed) {
  console.error(`\nSmoke test FAILED (${failed} problem${failed === 1 ? '' : 's'}).\n`);
  process.exit(1);
}
console.log('\nSmoke test passed.\n');
process.exit(0);
