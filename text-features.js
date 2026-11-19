/* ============================================================
   KritiCut — text features
   Fonts, presets, animations and effects for text clips.
   Also injects the CSS keyframes used by the live preview.
   ============================================================ */
(function () {
  'use strict';

  window.TEXT_FONTS = [
    { name: 'Inter', css: 'Inter, -apple-system, "Segoe UI", sans-serif' },
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
    { name: 'Didot', css: 'Didot, "Times New Roman", serif' }
  ];

  window.TEXT_ANIMATIONS_IN = ['None', 'Fade In', 'Pop In', 'Slide Up', 'Slide Down', 'Slide Left', 'Slide Right', 'Typewriter', 'Scale In', 'Blur In', 'Spin In', 'Wave'];
  window.TEXT_ANIMATIONS_OUT = ['None', 'Fade Out', 'Pop Out', 'Slide Up Out', 'Slide Down Out', 'Slide Left Out', 'Slide Right Out', 'Scale Out', 'Blur Out'];
  window.TEXT_ANIMATIONS_LOOP = ['None', 'Pulse', 'Bounce', 'Wave', 'Shake', 'Glow', 'Rainbow', 'Neon Flicker', 'Blink'];

  window.TEXT_EFFECTS = [
    { name: 'None', css: '' },
    { name: 'Neon', css: 'text-shadow:0 0 8px currentColor,0 0 16px currentColor,0 0 32px currentColor;' },
    { name: 'Glow', css: 'text-shadow:0 0 20px currentColor;' },
    { name: 'Shadow', css: 'text-shadow:3px 3px 0 rgba(0,0,0,0.8),6px 6px 12px rgba(0,0,0,0.5);' },
    { name: 'Emboss', css: 'text-shadow:1px 1px 0 #fff,-1px -1px 0 #000;' },
    { name: '3D', css: 'text-shadow:1px 1px 0 #000,2px 2px 0 #000,3px 3px 0 #000,4px 4px 8px rgba(0,0,0,0.6);' },
    { name: 'Outline', css: '-webkit-text-stroke:3px currentColor;color:transparent;' },
    { name: 'Hollow', css: '-webkit-text-stroke:2px #fff;color:transparent;' },
    { name: 'Mirror', css: '-webkit-box-reflect:below 4px linear-gradient(transparent,rgba(0,0,0,0.4));' },
    { name: 'Gradient', css: 'background:linear-gradient(90deg,#ff5470,#25c38e,#4ea8ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' },
    { name: 'Rainbow', css: 'background:linear-gradient(90deg,#ff5470,#ffb347,#25c38e,#4ea8ff,#a855f7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' },
    { name: 'Glitch', css: 'text-shadow:2px 0 #ff0080,-2px 0 #00ffff;' },
    { name: 'Retro', css: 'text-shadow:3px 3px 0 #ff5470,6px 6px 0 #4ea8ff;' }
  ];

  window.TEXT_BUBBLES = ['None', 'Rectangle', 'Rounded', 'Pill', 'Cloud', 'Arrow Down', 'Arrow Up', 'Quote', 'Callout', 'Sticker', 'Neon Box'];

  if (!document.getElementById('kc-text-keyframes')) {
    const css = `
  @keyframes kc-fadein{from{opacity:0}to{opacity:1}}
  @keyframes kc-popin{0%{opacity:0;transform:scale(0.3)}70%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
  @keyframes kc-slideup{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}
  @keyframes kc-slidedown{from{opacity:0;transform:translateY(-200%)}to{opacity:1;transform:none}}
  @keyframes kc-slideleft{from{opacity:0;transform:translateX(200%)}to{opacity:1;transform:none}}
  @keyframes kc-slideright{from{opacity:0;transform:translateX(-300%)}to{opacity:1;transform:none}}
  @keyframes kc-scalein{0%{opacity:0;transform:scale(3)}100%{opacity:1;transform:scale(1)}}
  @keyframes kc-blurin{from{opacity:0;filter:blur(20px)}to{opacity:1;filter:blur(0)}}
  @keyframes kc-spinin{from{opacity:0;transform:rotate(-360deg) scale(0)}to{opacity:1;transform:rotate(0) scale(1)}}
  @keyframes kc-wave{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}

  @keyframes kc-fadeout{from{opacity:1}to{opacity:0}}
  @keyframes kc-popout{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.3)}}
  @keyframes kc-slideupout{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-200%)}}
  @keyframes kc-slidedownout{from{opacity:1;transform:none}to{opacity:0;transform:translateY(100%)}}
  @keyframes kc-slideleftout{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-300%)}}
  @keyframes kc-sliderightout{from{opacity:1;transform:none}to{opacity:0;transform:translateX(200%)}}
  @keyframes kc-scaleout{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(3)}}
  @keyframes kc-blurout{from{opacity:1;filter:blur(0)}to{opacity:0;filter:blur(20px)}}

  @keyframes kc-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
  @keyframes kc-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  @keyframes kc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  @keyframes kc-glow{0%,100%{text-shadow:0 0 8px currentColor,0 0 16px currentColor}50%{text-shadow:0 0 20px currentColor,0 0 40px currentColor}}
  @keyframes kc-rainbow{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}
  @keyframes kc-flicker{0%,100%{opacity:1}50%{opacity:0.6}}
  @keyframes kc-blink{0%,45%{opacity:1}50%,95%{opacity:0.15}100%{opacity:1}}
  @keyframes kc-typewriter{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
  `;
    const st = document.createElement('style');
    st.id = 'kc-text-keyframes';
    st.textContent = css;
    document.head.appendChild(st);
  }
})();
