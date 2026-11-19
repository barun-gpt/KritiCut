/* ================= KritiCut Filters Library ================= */
/* Premium filter recipes inspired by CapCut, VN, VSCO, Instagram, TikTok.
 * Each filter is a set of CSS-filter values + optional overlay color. */

window.PRESETS_FILTERS = [
  // --- Essentials ---
  { name: 'Original', group: 'Original', values: {}, overlay: null },
  { name: 'Vivid', group: 'Popular', values: { brightness: 1.12, contrast: 1.18, saturate: 1.35 }, overlay: null },
  { name: 'Natural', group: 'Popular', values: { brightness: 1.05, contrast: 1.05, saturate: 1.05 }, overlay: null },

  // --- CapCut "Food" / "Life" ---
  { name: 'Bloom', group: 'Life', values: { brightness: 1.08, contrast: 1.05, saturate: 1.25, sepia: 0.08 }, overlay: null },
  { name: 'Cream', group: 'Life', values: { brightness: 1.1, contrast: 0.95, saturate: 0.85, sepia: 0.12 }, overlay: { color: 'rgba(255,220,180,0.08)'} },
  { name: 'Fresh', group: 'Life', values: { brightness: 1.1, contrast: 1.08, saturate: 1.2, hueRotate: -5 }, overlay: null },
  { name: 'Foodie', group: 'Life', values: { brightness: 1.05, contrast: 1.2, saturate: 1.4, warmth: 0.1 }, overlay: { color: 'rgba(255,180,80,0.06)'} },
  { name: 'Sweet', group: 'Life', values: { brightness: 1.1, saturate: 1.3, sepia: 0.15, contrast: 0.95 }, overlay: { color: 'rgba(255,200,220,0.1)'} },

  // --- Cinematic / Moody ---
  { name: 'Cinematic', group: 'Cinematic', values: { brightness: 0.92, contrast: 1.25, saturate: 0.85 }, overlay: { color: 'rgba(0,0,0,0.08)'} },
  { name: 'Noir', group: 'Cinematic', values: { brightness: 0.95, contrast: 1.35, saturate: 0.1, grayscale: 0.7 }, overlay: null },
  { name: 'TealOrange', group: 'Cinematic', values: { contrast: 1.2, saturate: 1.1, tealShift: 1 }, overlay: null },
  { name: 'Movie60s', group: 'Cinematic', values: { brightness: 1.05, contrast: 1.1, sepia: 0.35, saturate: 0.8 }, overlay: null },
  { name: 'Kodak', group: 'Cinematic', values: { brightness: 1.05, contrast: 1.15, saturate: 1.15, sepia: 0.08, warmth: 0.15 }, overlay: null },
  { name: 'Hollywood', group: 'Cinematic', values: { brightness: 0.9, contrast: 1.3, saturate: 0.9 }, overlay: { color: 'rgba(20,40,80,0.15)'} },

  // --- Travel / Landscape ---
  { name: 'Maldives', group: 'Travel', values: { brightness: 1.1, contrast: 1.1, saturate: 1.4, hueRotate: -10 }, overlay: { color: 'rgba(80,180,255,0.08)'} },
  { name: 'Tokyo', group: 'Travel', values: { brightness: 1.05, contrast: 1.1, saturate: 1.2, warmth: 0.1 }, overlay: { color: 'rgba(255,180,200,0.08)'} },
  { name: 'Sahara', group: 'Travel', values: { brightness: 1.05, contrast: 1.15, saturate: 1.1, sepia: 0.2 }, overlay: { color: 'rgba(255,180,80,0.1)'} },
  { name: 'Nordic', group: 'Travel', values: { brightness: 1.1, contrast: 0.95, saturate: 0.75, hueRotate: -10 }, overlay: { color: 'rgba(180,220,255,0.1)'} },

  // --- Portrait / Selfie ---
  { name: 'Portrait', group: 'Portrait', values: { brightness: 1.1, contrast: 0.95, saturate: 1.05, blurpx: 0.1 }, overlay: { color: 'rgba(255,220,200,0.1)'} },
  { name: 'SkinSmooth', group: 'Portrait', values: { brightness: 1.08, contrast: 0.9, saturate: 0.95, blurpx: 0.3 }, overlay: { color: 'rgba(255,220,210,0.12)'} },
  { name: 'Glam', group: 'Portrait', values: { brightness: 1.1, contrast: 1.1, saturate: 1.2, sepia: 0.05 }, overlay: { color: 'rgba(255,200,220,0.15)'} },

  // --- Retro / Vintage ---
  { name: 'Vintage', group: 'Retro', values: { brightness: 1.0, contrast: 0.9, saturate: 0.75, sepia: 0.4 }, overlay: { color: 'rgba(180,120,60,0.12)'} },
  { name: 'Retro', group: 'Retro', values: { brightness: 1.05, contrast: 1.05, saturate: 0.9, sepia: 0.25 }, overlay: { color: 'rgba(255,160,80,0.08)'} },
  { name: 'VHS', group: 'Retro', values: { brightness: 1.1, contrast: 1.2, saturate: 1.3, hueRotate: -10 }, overlay: { color: 'rgba(0,150,255,0.05)'} },
  { name: 'Film', group: 'Retro', values: { brightness: 1.0, contrast: 1.1, saturate: 0.85, sepia: 0.15 }, overlay: { color: 'rgba(80,40,0,0.1)'} },
  { name: '80s', group: 'Retro', values: { brightness: 1.1, contrast: 1.15, saturate: 1.4, hueRotate: -20 }, overlay: { color: 'rgba(255,80,200,0.08)'} },
  { name: '90s', group: 'Retro', values: { brightness: 1.05, contrast: 1.05, saturate: 0.9, sepia: 0.1 }, overlay: { color: 'rgba(200,220,255,0.1)'} },

  // --- Mood ---
  { name: 'Warm', group: 'Mood', values: { brightness: 1.05, contrast: 1.05, saturate: 1.15, warmth: 0.2, sepia: 0.12 }, overlay: { color: 'rgba(255,160,60,0.08)'} },
  { name: 'Cool', group: 'Mood', values: { brightness: 1.05, contrast: 1.05, saturate: 1.1, hueRotate: -15 }, overlay: { color: 'rgba(80,150,255,0.1)'} },
  { name: 'BW', group: 'Mood', values: { grayscale: 1, contrast: 1.15 }, overlay: null },
  { name: 'Fade', group: 'Mood', values: { brightness: 1.1, contrast: 0.85, saturate: 0.8 }, overlay: null },
  { name: 'Dreamy', group: 'Mood', values: { brightness: 1.15, contrast: 0.95, saturate: 1.2, blurpx: 0.5 }, overlay: { color: 'rgba(255,220,255,0.12)'} },
  { name: 'Mono', group: 'Mood', values: { grayscale: 1, contrast: 1.3, brightness: 0.95 }, overlay: null },
  { name: 'Aqua', group: 'Mood', values: { brightness: 1.05, saturate: 1.15, hueRotate: -20 }, overlay: { color: 'rgba(80,200,255,0.15)'} },
  { name: 'Sunset', group: 'Mood', values: { brightness: 1.0, contrast: 1.1, saturate: 1.3, warmth: 0.25, sepia: 0.1 }, overlay: { color: 'rgba(255,100,40,0.1)'} },

  // --- TikTok / Instagram vibe ---
  { name: 'Clarendon', group: 'Social', values: { brightness: 1.1, contrast: 1.15, saturate: 1.25 }, overlay: { color: 'rgba(0,150,255,0.08)'} },
  { name: 'Gingham', group: 'Social', values: { brightness: 1.05, contrast: 0.9, saturate: 0.8, sepia: 0.1 }, overlay: null },
  { name: 'Juno', group: 'Social', values: { contrast: 1.15, saturate: 1.2, warmth: 0.15 }, overlay: { color: 'rgba(255,180,0,0.08)'} },
  { name: 'Lark', group: 'Social', values: { brightness: 1.1, contrast: 1.1, saturate: 0.9 }, overlay: null },
  { name: 'Ludwig', group: 'Social', values: { brightness: 1.05, contrast: 1.1, saturate: 1.2, sepia: 0.05 }, overlay: null },
  { name: 'Valencia', group: 'Social', values: { brightness: 1.08, contrast: 1.0, saturate: 1.1, sepia: 0.15 }, overlay: { color: 'rgba(255,180,80,0.08)'} },
  { name: 'XPro', group: 'Social', values: { contrast: 1.2, saturate: 1.3, sepia: 0.1 }, overlay: { color: 'rgba(180,100,255,0.08)'} },

  // --- Special / Premium ---
  { name: 'Cyberpunk', group: 'Premium', values: { brightness: 1.05, contrast: 1.3, saturate: 1.5, hueRotate: -25 }, overlay: { color: 'rgba(255,0,180,0.1)'} },
  { name: 'Anime', group: 'Premium', values: { brightness: 1.1, contrast: 1.25, saturate: 1.6 }, overlay: null },
  { name: 'HDR', group: 'Premium', values: { brightness: 1.08, contrast: 1.4, saturate: 1.4 }, overlay: null },
  { name: 'Neon', group: 'Premium', values: { brightness: 1.0, contrast: 1.3, saturate: 1.5 }, overlay: { color: 'rgba(0,255,200,0.1)'} },
  { name: 'Glitch', group: 'Premium', values: { contrast: 1.3, saturate: 1.4, hueRotate: 10 }, overlay: { color: 'rgba(255,0,80,0.08)'} },
];

window.PRESETS_ADJUST = [
  ['brightness','Brightness',0.3,2,1,0.01],
  ['contrast','Contrast',0.3,2,1,0.01],
  ['saturate','Saturation',0,2.5,1,0.01],
  ['hueRotate','Hue',-180,180,0,1],
  ['warmth','Warmth',-1,1,0,0.01],
  ['tint','Tint',-1,1,0,0.01],
  ['sepia','Sepia',0,1,0,0.01],
  ['grayscale','B&W',0,1,0,0.01],
  ['blurpx','Sharpen/Blur',0,5,0,0.1],
  ['vignette','Vignette',0,1,0,0.01],
  ['fade','Fade',0,1,0,0.01],
  ['sharpen','Sharpen',0,2,0,0.01],
];

window.PRESETS_EFFECTS = ['None','Vignette','Shake','VHS','Zoom In','Spin','Glitch','Kaleido','Blur','Flicker'];

/* ================= Text feature library ================= */
window.TEXT_FONTS = [
  { name: 'Inter', css: 'Inter, -apple-system, sans-serif' },
  { name: 'Sans', css: 'Arial, Helvetica, sans-serif' },
  { name: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { name: 'Mono', css: '"Courier New", Courier, monospace' },
  { name: 'Cursive', css: '"Brush Script MT", cursive' },
  { name: 'Impact', css: 'Impact, "Arial Black", sans-serif' },
  { name: 'Handwriting', css: '"Comic Sans MS", cursive' },
  { name: 'Futura', css: '"Trebuchet MS", sans-serif' },
  { name: 'Classic', css: '"Palatino Linotype", serif' },
  { name: 'Bebas', css: '"Arial Narrow", Impact, sans-serif' },
  { name: 'Comic', css: '"Comic Sans MS", cursive' },
  { name: 'Didot', css: 'Didot, "Times New Roman", serif' },
];

window.TEXT_ANIMATIONS_IN = ['None','Fade In','Pop In','Slide Up','Slide Down','Slide Left','Slide Right','Typewriter','Scale In','Blur In','Spin In','Wave'];
window.TEXT_ANIMATIONS_OUT = ['None','Fade Out','Pop Out','Slide Up Out','Slide Down Out','Slide Left Out','Slide Right Out','Scale Out','Blur Out'];
window.TEXT_ANIMATIONS_LOOP = ['None','Pulse','Bounce','Wave','Shake','Glow','Rainbow','Neon Flicker','Blink'];

window.TEXT_EFFECTS = [
  { name: 'None', css: '' },
  { name: 'Neon', css: 'text-shadow:0 0 8px currentColor,0 0 16px currentColor,0 0 32px currentColor;' },
  { name: 'Glow', css: 'text-shadow:0 0 20px currentColor;' },
  { name: 'Shadow', css: 'text-shadow:3px 3px 0 rgba(0,0,0,0.8),6px 6px 12px rgba(0,0,0,0.5);' },
  { name: 'Emboss', css: 'text-shadow:1px 1px 0 #fff,-1px -1px 0 #000;' },
  { name: '3D', css: 'text-shadow:1px 1px 0 #000,2px 2px 0 #000,3px 3px 0 #000,4px 4px 8px rgba(0,0,0,0.6);' },
  { name: 'Outline', css: '-webkit-text-stroke:3px currentColor;color:transparent;' },
  { name: 'Hollow', css: '-webkit-text-stroke:2px #fff;color:transparent;' },
  { name: 'Mirror', css: 'transform:scaleY(-1);opacity:0.4;' },
  { name: 'Gradient', css: 'background:linear-gradient(90deg,#ff5470,#25c38e,#4ea8ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;' },
  { name: 'Rainbow', css: '' },
  { name: 'Glitch', css: 'text-shadow:2px 0 #ff0080,-2px 0 #00ffff;' },
  { name: 'Retro', css: 'text-shadow:3px 3px 0 #ff5470,6px 6px 0 #4ea8ff;' },
];

window.TEXT_BUBBLES = ['None','Rectangle','Rounded','Pill','Cloud','Arrow Down','Arrow Up','Quote','Callout','Sticker','Neon Box'];

/* ================= Home templates ================= */
window.TEMPLATES = [
  { id:'t1', name:'Travel Vlog', color:'linear-gradient(135deg,#4ea8ff,#25c38e)', tag:'TRAVEL', preset:{filters:{brightness:1.1,contrast:1.1,saturate:1.3,warmth:0.05}}},
  { id:'t2', name:'Cinematic', color:'linear-gradient(135deg,#111,#333)', tag:'FILM', preset:{filters:{brightness:0.9,contrast:1.3,saturate:0.85}}},
  { id:'t3', name:'Foodie', color:'linear-gradient(135deg,#ff7a59,#ffb347)', tag:'FOOD', preset:{filters:{brightness:1.05,contrast:1.2,saturate:1.4,sepia:0.05}}},
  { id:'t4', name:'Vintage', color:'linear-gradient(135deg,#c8a06a,#8b5a2b)', tag:'RETRO', preset:{filters:{brightness:1.0,contrast:0.9,saturate:0.8,sepia:0.4}}},
  { id:'t5', name:'Selfie Glow', color:'linear-gradient(135deg,#ffb6d9,#ffd6e8)', tag:'BEAUTY', preset:{filters:{brightness:1.1,contrast:0.95,saturate:1.1,blurpx:0.2}}},
  { id:'t6', name:'Cyberpunk', color:'linear-gradient(135deg,#ff00a0,#00f0ff)', tag:'VFX', preset:{filters:{brightness:1.05,contrast:1.3,saturate:1.5,hueRotate:-25}}},
  { id:'t7', name:'BW Moody', color:'linear-gradient(135deg,#000,#555)', tag:'MONO', preset:{filters:{grayscale:1,contrast:1.3,brightness:0.95}}},
  { id:'t8', name:'Anime Pop', color:'linear-gradient(135deg,#ff5470,#4ea8ff)', tag:'ANIME', preset:{filters:{brightness:1.1,contrast:1.25,saturate:1.6}}},
  { id:'t9', name:'TikTok Beat', color:'linear-gradient(135deg,#25c38e,#ff5470)', tag:'TREND', preset:{filters:{brightness:1.05,contrast:1.2,saturate:1.3}}},
  { id:'t10', name:'Nordic', color:'linear-gradient(135deg,#cfe8ff,#94c5ff)', tag:'CHILL', preset:{filters:{brightness:1.1,contrast:0.95,saturate:0.75,hueRotate:-10}}},
];

window.BUILTIN_PRESETS = [
  { name:'YouTuber Vlog', data:{filters:{brightness:1.08,contrast:1.1,saturate:1.15}} },
  { name:'Reels Pop', data:{filters:{brightness:1.1,contrast:1.2,saturate:1.35}, textStyle:{size:48,bold:true,strokeW:2}} },
  { name:'Golden Hour', data:{filters:{brightness:1.05,contrast:1.1,saturate:1.1,warmth:0.25,sepia:0.1}} },
  { name:'Cool Blue', data:{filters:{brightness:1.05,contrast:1.05,saturate:1.1,hueRotate:-15}} },
  { name:'Clean Minimal', data:{filters:{brightness:1.1,contrast:1.0,saturate:0.95}} },
];
