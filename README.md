# KritiCut

A full-featured, offline-first video editor that runs in the browser and ships to Android with Capacitor. Every premium-style feature is free and local — no accounts, no uploads, no watermarks unless you ask for one.

![status](https://img.shields.io/badge/status-active-3df2b2) ![license](https://img.shields.io/badge/use-personal%20%26%20commercial-6ea8ff)

## Features

- **Multi-track timeline** — video/photo, overlay, text and audio tracks with drag-to-move, trim handles, split, duplicate and delete.
- **Keyframes** — animate position, scale, rotation, opacity and text size between points in time.
- **Filters & adjustments** — 40+ colour presets plus brightness, contrast, saturation, hue, warmth, tint, fade, vignette, blur and grayscale.
- **Creative effects** — shake, zoom-in, spin, flicker, glitch, VHS, blur, kaleidoscope and vignette, all rendered deterministically.
- **Text studio** — 12 fonts, in/out/loop animations, stroke, shadow, spacing, line height, opacity, backgrounds, 10 speech-bubble styles and 12 text effects. Drag text directly on the preview.
- **Audio** — per-clip volume, fades and speed, mixed through the Web Audio graph.
- **Export** — 480p to 2160p, 24/30/60 fps, selectable bitrate and optional watermark; exports WebM (or MP4 where the browser supports it) with the mixed audio track.
- **Aspect ratios** — 9:16, 16:9, 1:1 and 4:5 with responsive preview.
- **Autosave** — projects and imported media live in IndexedDB; reopen the last draft from the home screen.
- **Installable PWA** — service worker caches the app shell for offline use.

## Run it

The web app is plain HTML/CSS/JS with no build step. Any static server works:

```bash
npm run dev
```

Then open <http://localhost:8080>. The server prints a LAN URL so you can test on a phone on the same Wi-Fi. You can also serve the repository root with `python3 -m http.server 8080`.

> A secure origin (`localhost` or HTTPS) is required for service workers and some media APIs. Opening `index.html` via `file://` works for basic editing but not for the PWA cache.

## Android

The Android app is a thin Capacitor wrapper around the same web app. `www/` is generated, never committed.

```bash
npm install
npm run build          # creates www/ from the repo root
npx cap add android    # once
npm run assets         # launcher icons + splash screens
npx cap sync android
npx cap open android   # or ./gradlew assembleDebug
```

`npm run android:add` / `npm run android:sync` wrap these steps.

The `Build Android APK` GitHub Actions workflow does this automatically and uploads `app-debug.apk`. The `Web checks` workflow runs the smoke test and the web build on every push/PR.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Home screen, editor markup and modals |
| `styles.css` | Design tokens, editor layout, responsive rules |
| `app.js` | All editor logic: state, rendering, timeline, audio, import, export, drafts |
| `filters.js` | Filter presets, adjustment definitions, effect names |
| `text-features.js` | Fonts, text animations/effects/bubbles + injected keyframes |
| `presets-data.js` | Project templates, built-in presets, user-preset storage |
| `manifest.json`, `sw.js`, `icons/` | PWA metadata, offline cache, app icons |
| `scripts/serve.mjs` | Zero-dependency dev server |
| `scripts/build-www.mjs` | Generates `www/` for Capacitor |
| `resources/icon.png` | Source art for Android launcher icons and splash screens |
| `tests/smoke.mjs` | Headless jsdom test of the real HTML + JS |

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `S` | Split at playhead |
| `Delete` / `Backspace` | Delete selected clip |
| `←` / `→` | Step one frame (`Shift` = 1 second) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z`, `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + S` | Save draft |
| `Esc` | Deselect / close modal |

## Testing

```bash
npm ci
npm test
```

The smoke test boots `index.html` with the real scripts in jsdom using stubbed canvas, audio and recorder APIs. It covers project creation, splitting, undo/redo, filters, text, keyframes, aspect changes, presets, a full export pass, and draft save/reopen.

## Notes & limits

- Export runs in real time (a 30-second video takes about 30 seconds) because it records the canvas and Web Audio graph.
- Format support depends on the browser. Chromium-based browsers export WebM (VP9/VP8 + Opus); MP4 is used only when `MediaRecorder` reports support.
- Large media files are kept in IndexedDB; the browser may evict them under storage pressure. Use `Ctrl/Cmd + S` before clearing site data.
- There is no cloud sync, account or analytics. Everything stays on the device.
- Not affiliated with CapCut, VN or any other editor.

## License

MIT — see [LICENSE](LICENSE). Bundled fonts fall back to system fonts and no third-party assets are redistributed.
