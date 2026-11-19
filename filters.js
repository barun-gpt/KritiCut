/* ============================================================
   KritiCut — filter library
   Colour recipes used by the editor and the preset system.
   Value keys map 1:1 to the canvas/CSS rendering pipeline:
     brightness, contrast, saturate, hueRotate, sepia, grayscale,
     blurpx, warmth, tint, fade, vignette
   `overlay` is an optional colour wash painted over the clip.
   ============================================================ */
(function () {
  'use strict';

  window.PRESETS_FILTERS = [
    /* --- Essentials --- */
    { name: 'Original', group: 'Original', values: {}, overlay: null },
    { name: 'Vivid', group: 'Popular', values: { brightness: 1.12, contrast: 1.18, saturate: 1.35 }, overlay: null },
    { name: 'Natural', group: 'Popular', values: { brightness: 1.05, contrast: 1.05, saturate: 1.05 }, overlay: null },

    /* --- Life --- */
    { name: 'Bloom', group: 'Life', values: { brightness: 1.08, contrast: 1.05, saturate: 1.25, sepia: 0.08 }, overlay: null },
    { name: 'Cream', group: 'Life', values: { brightness: 1.1, contrast: 0.95, saturate: 0.85, sepia: 0.12 }, overlay: { color: 'rgba(255,220,180,0.08)' } },
    { name: 'Fresh', group: 'Life', values: { brightness: 1.1, contrast: 1.08, saturate: 1.2, hueRotate: -5 }, overlay: null },
    { name: 'Foodie', group: 'Life', values: { brightness: 1.05, contrast: 1.2, saturate: 1.4, warmth: 0.1 }, overlay: { color: 'rgba(255,180,80,0.06)' } },
    { name: 'Sweet', group: 'Life', values: { brightness: 1.1, saturate: 1.3, sepia: 0.15, contrast: 0.95 }, overlay: { color: 'rgba(255,200,220,0.1)' } },

    /* --- Cinematic --- */
    { name: 'Cinematic', group: 'Cinematic', values: { brightness: 0.92, contrast: 1.25, saturate: 0.85 }, overlay: { color: 'rgba(0,0,0,0.08)' } },
    { name: 'Noir', group: 'Cinematic', values: { brightness: 0.95, contrast: 1.35, saturate: 0.1, grayscale: 0.7 }, overlay: null },
    { name: 'Teal Orange', group: 'Cinematic', values: { contrast: 1.2, saturate: 1.1, hueRotate: -8, warmth: 0.15 }, overlay: null },
    { name: 'Movie 60s', group: 'Cinematic', values: { brightness: 1.05, contrast: 1.1, sepia: 0.35, saturate: 0.8 }, overlay: null },
    { name: 'Kodak', group: 'Cinematic', values: { brightness: 1.05, contrast: 1.15, saturate: 1.15, sepia: 0.08, warmth: 0.15 }, overlay: null },
    { name: 'Hollywood', group: 'Cinematic', values: { brightness: 0.9, contrast: 1.3, saturate: 0.9 }, overlay: { color: 'rgba(20,40,80,0.15)' } },

    /* --- Travel --- */
    { name: 'Maldives', group: 'Travel', values: { brightness: 1.1, contrast: 1.1, saturate: 1.4, hueRotate: -10 }, overlay: { color: 'rgba(80,180,255,0.08)' } },
    { name: 'Tokyo', group: 'Travel', values: { brightness: 1.05, contrast: 1.1, saturate: 1.2, warmth: 0.1 }, overlay: { color: 'rgba(255,180,200,0.08)' } },
    { name: 'Sahara', group: 'Travel', values: { brightness: 1.05, contrast: 1.15, saturate: 1.1, sepia: 0.2 }, overlay: { color: 'rgba(255,180,80,0.1)' } },
    { name: 'Nordic', group: 'Travel', values: { brightness: 1.1, contrast: 0.95, saturate: 0.75, hueRotate: -10 }, overlay: { color: 'rgba(180,220,255,0.1)' } },

    /* --- Portrait --- */
    { name: 'Portrait', group: 'Portrait', values: { brightness: 1.1, contrast: 0.95, saturate: 1.05, blurpx: 0.1 }, overlay: { color: 'rgba(255,220,200,0.1)' } },
    { name: 'Skin Smooth', group: 'Portrait', values: { brightness: 1.08, contrast: 0.9, saturate: 0.95, blurpx: 0.3 }, overlay: { color: 'rgba(255,220,210,0.12)' } },
    { name: 'Glam', group: 'Portrait', values: { brightness: 1.1, contrast: 1.1, saturate: 1.2, sepia: 0.05 }, overlay: { color: 'rgba(255,200,220,0.15)' } },

    /* --- Retro --- */
    { name: 'Vintage', group: 'Retro', values: { brightness: 1, contrast: 0.9, saturate: 0.75, sepia: 0.4 }, overlay: { color: 'rgba(180,120,60,0.12)' } },
    { name: 'Retro', group: 'Retro', values: { brightness: 1.05, contrast: 1.05, saturate: 0.9, sepia: 0.25 }, overlay: { color: 'rgba(255,160,80,0.08)' } },
    { name: 'VHS', group: 'Retro', values: { brightness: 1.1, contrast: 1.2, saturate: 1.3, hueRotate: -10 }, overlay: { color: 'rgba(0,150,255,0.05)' } },
    { name: 'Film', group: 'Retro', values: { brightness: 1, contrast: 1.1, saturate: 0.85, sepia: 0.15 }, overlay: { color: 'rgba(80,40,0,0.1)' } },
    { name: '80s', group: 'Retro', values: { brightness: 1.1, contrast: 1.15, saturate: 1.4, hueRotate: -20 }, overlay: { color: 'rgba(255,80,200,0.08)' } },
    { name: '90s', group: 'Retro', values: { brightness: 1.05, contrast: 1.05, saturate: 0.9, sepia: 0.1 }, overlay: { color: 'rgba(200,220,255,0.1)' } },

    /* --- Mood --- */
    { name: 'Warm', group: 'Mood', values: { brightness: 1.05, contrast: 1.05, saturate: 1.15, warmth: 0.2, sepia: 0.12 }, overlay: { color: 'rgba(255,160,60,0.08)' } },
    { name: 'Cool', group: 'Mood', values: { brightness: 1.05, contrast: 1.05, saturate: 1.1, hueRotate: -15 }, overlay: { color: 'rgba(80,150,255,0.1)' } },
    { name: 'B&W', group: 'Mood', values: { grayscale: 1, contrast: 1.15 }, overlay: null },
    { name: 'Fade', group: 'Mood', values: { brightness: 1.1, contrast: 0.85, saturate: 0.8, fade: 0.15 }, overlay: null },
    { name: 'Dreamy', group: 'Mood', values: { brightness: 1.15, contrast: 0.95, saturate: 1.2, blurpx: 0.5 }, overlay: { color: 'rgba(255,220,255,0.12)' } },
    { name: 'Mono', group: 'Mood', values: { grayscale: 1, contrast: 1.3, brightness: 0.95 }, overlay: null },
    { name: 'Aqua', group: 'Mood', values: { brightness: 1.05, saturate: 1.15, hueRotate: -20 }, overlay: { color: 'rgba(80,200,255,0.15)' } },
    { name: 'Sunset', group: 'Mood', values: { brightness: 1, contrast: 1.1, saturate: 1.3, warmth: 0.25, sepia: 0.1 }, overlay: { color: 'rgba(255,100,40,0.1)' } },

    /* --- Social --- */
    { name: 'Clarendon', group: 'Social', values: { brightness: 1.1, contrast: 1.15, saturate: 1.25 }, overlay: { color: 'rgba(0,150,255,0.08)' } },
    { name: 'Gingham', group: 'Social', values: { brightness: 1.05, contrast: 0.9, saturate: 0.8, sepia: 0.1 }, overlay: null },
    { name: 'Juno', group: 'Social', values: { contrast: 1.15, saturate: 1.2, warmth: 0.15 }, overlay: { color: 'rgba(255,180,0,0.08)' } },
    { name: 'Lark', group: 'Social', values: { brightness: 1.1, contrast: 1.1, saturate: 0.9 }, overlay: null },
    { name: 'Ludwig', group: 'Social', values: { brightness: 1.05, contrast: 1.1, saturate: 1.2, sepia: 0.05 }, overlay: null },
    { name: 'Valencia', group: 'Social', values: { brightness: 1.08, contrast: 1, saturate: 1.1, sepia: 0.15 }, overlay: { color: 'rgba(255,180,80,0.08)' } },
    { name: 'X Pro', group: 'Social', values: { contrast: 1.2, saturate: 1.3, sepia: 0.1 }, overlay: { color: 'rgba(180,100,255,0.08)' } },

    /* --- Premium --- */
    { name: 'Cyberpunk', group: 'Premium', values: { brightness: 1.05, contrast: 1.3, saturate: 1.5, hueRotate: -25 }, overlay: { color: 'rgba(255,0,180,0.1)' } },
    { name: 'Anime', group: 'Premium', values: { brightness: 1.1, contrast: 1.25, saturate: 1.6 }, overlay: null },
    { name: 'HDR', group: 'Premium', values: { brightness: 1.08, contrast: 1.4, saturate: 1.4 }, overlay: null },
    { name: 'Neon', group: 'Premium', values: { brightness: 1, contrast: 1.3, saturate: 1.5 }, overlay: { color: 'rgba(0,255,200,0.1)' } },
    { name: 'Glitch', group: 'Premium', values: { contrast: 1.3, saturate: 1.4, hueRotate: 10 }, overlay: { color: 'rgba(255,0,80,0.08)' } }
  ];

  /* [key, label, min, max, default, step] */
  window.PRESETS_ADJUST = [
    ['brightness', 'Brightness', 0.3, 2, 1, 0.01],
    ['contrast', 'Contrast', 0.3, 2, 1, 0.01],
    ['saturate', 'Saturation', 0, 2.5, 1, 0.01],
    ['hueRotate', 'Hue', -180, 180, 0, 1],
    ['warmth', 'Warmth', -1, 1, 0, 0.01],
    ['tint', 'Tint', -1, 1, 0, 0.01],
    ['sepia', 'Sepia', 0, 1, 0, 0.01],
    ['grayscale', 'B&W', 0, 1, 0, 0.01],
    ['blurpx', 'Blur', 0, 5, 0, 0.1],
    ['vignette', 'Vignette', 0, 1, 0, 0.01],
    ['fade', 'Fade', 0, 1, 0, 0.01]
  ];

  window.PRESETS_EFFECTS = ['None', 'Vignette', 'Shake', 'VHS', 'Zoom In', 'Spin', 'Glitch', 'Kaleido', 'Blur', 'Flicker'];
})();
