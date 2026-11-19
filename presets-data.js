/* ============================================================
   KritiCut — home templates, built-in presets and user presets
   ============================================================ */
(function () {
  'use strict';

  window.TEMPLATES = [
    { id: 't1', name: 'Travel Vlog', color: 'linear-gradient(135deg,#4ea8ff,#25c38e)', tag: 'TRAVEL', preset: { filters: { brightness: 1.1, contrast: 1.1, saturate: 1.3, warmth: 0.05 } } },
    { id: 't2', name: 'Cinematic', color: 'linear-gradient(135deg,#111,#333)', tag: 'FILM', preset: { filters: { brightness: 0.9, contrast: 1.3, saturate: 0.85 } } },
    { id: 't3', name: 'Foodie', color: 'linear-gradient(135deg,#ff7a59,#ffb347)', tag: 'FOOD', preset: { filters: { brightness: 1.05, contrast: 1.2, saturate: 1.4, sepia: 0.05 } } },
    { id: 't4', name: 'Vintage', color: 'linear-gradient(135deg,#c8a06a,#8b5a2b)', tag: 'RETRO', preset: { filters: { brightness: 1, contrast: 0.9, saturate: 0.8, sepia: 0.4 } } },
    { id: 't5', name: 'Selfie Glow', color: 'linear-gradient(135deg,#ffb6d9,#ffd6e8)', tag: 'BEAUTY', preset: { filters: { brightness: 1.1, contrast: 0.95, saturate: 1.1, blurpx: 0.2 } } },
    { id: 't6', name: 'Cyberpunk', color: 'linear-gradient(135deg,#ff00a0,#00f0ff)', tag: 'VFX', preset: { filters: { brightness: 1.05, contrast: 1.3, saturate: 1.5, hueRotate: -25 } } },
    { id: 't7', name: 'BW Moody', color: 'linear-gradient(135deg,#000,#555)', tag: 'MONO', preset: { filters: { grayscale: 1, contrast: 1.3, brightness: 0.95 } } },
    { id: 't8', name: 'Anime Pop', color: 'linear-gradient(135deg,#ff5470,#4ea8ff)', tag: 'ANIME', preset: { filters: { brightness: 1.1, contrast: 1.25, saturate: 1.6 } } },
    { id: 't9', name: 'TikTok Beat', color: 'linear-gradient(135deg,#25c38e,#ff5470)', tag: 'TREND', preset: { filters: { brightness: 1.05, contrast: 1.2, saturate: 1.3 } } },
    { id: 't10', name: 'Nordic', color: 'linear-gradient(135deg,#cfe8ff,#94c5ff)', tag: 'CHILL', preset: { filters: { brightness: 1.1, contrast: 0.95, saturate: 0.75, hueRotate: -10 } } }
  ];

  window.BUILTIN_PRESETS = [
    { name: 'YouTuber Vlog', data: { filters: { brightness: 1.08, contrast: 1.1, saturate: 1.15 } } },
    { name: 'Reels Pop', data: { filters: { brightness: 1.1, contrast: 1.2, saturate: 1.35 }, textStyle: { size: 48, bold: true, strokeW: 2 } } },
    { name: 'Golden Hour', data: { filters: { brightness: 1.05, contrast: 1.1, saturate: 1.1, warmth: 0.25, sepia: 0.1 } } },
    { name: 'Cool Blue', data: { filters: { brightness: 1.05, contrast: 1.05, saturate: 1.1, hueRotate: -15 } } },
    { name: 'Clean Minimal', data: { filters: { brightness: 1.1, contrast: 1, saturate: 0.95 } } }
  ];

  const KEY = 'kriticut_user_presets';
  window.USER_PRESETS_KEY = KEY;

  window.loadUserPresets = function () {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data.filter(p => p && typeof p.name === 'string' && p.data && typeof p.data === 'object') : [];
    } catch (e) {
      return [];
    }
  };

  window.saveUserPresets = function (list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : []));
      return true;
    } catch (e) {
      return false;
    }
  };
})();
