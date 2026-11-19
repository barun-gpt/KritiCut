/* Extra text animation helpers — CSS keyframes injected at runtime */
(function(){
  const css = `
  @keyframes kc-fadein{from{opacity:0}to{opacity:1}}
  @keyframes kc-popin{0%{opacity:0;transform:translate(-50%,-50%) scale(0.3)}70%{transform:translate(-50%,-50%) scale(1.1)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  @keyframes kc-slideup{from{opacity:0;transform:translate(-50%,100%)}to{opacity:1;transform:translate(-50%,-50%)}}
  @keyframes kc-slidedown{from{opacity:0;transform:translate(-50%,-200%)}to{opacity:1;transform:translate(-50%,-50%)}}
  @keyframes kc-slideleft{from{opacity:0;transform:translate(200%,-50%)}to{opacity:1;transform:translate(-50%,-50%)}}
  @keyframes kc-slideright{from{opacity:0;transform:translate(-300%,-50%)}to{opacity:1;transform:translate(-50%,-50%)}}
  @keyframes kc-scalein{0%{opacity:0;transform:translate(-50%,-50%) scale(3)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  @keyframes kc-blurin{from{opacity:0;filter:blur(20px)}to{opacity:1;filter:blur(0)}}
  @keyframes kc-spinin{from{opacity:0;transform:translate(-50%,-50%) rotate(-360deg) scale(0)}to{opacity:1;transform:translate(-50%,-50%) rotate(0) scale(1)}}
  @keyframes kc-wave{0%,100%{transform:translate(-50%,-50%) rotate(-4deg)}50%{transform:translate(-50%,-50%) rotate(4deg)}}

  @keyframes kc-fadeout{from{opacity:1}to{opacity:0}}
  @keyframes kc-popout{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-50%) scale(0.3)}}
  @keyframes kc-slideupout{from{opacity:1;transform:translate(-50%,-50%)}to{opacity:0;transform:translate(-50%,-200%)}}
  @keyframes kc-slidedownout{from{opacity:1;transform:translate(-50%,-50%)}to{opacity:0;transform:translate(-50%,100%)}}
  @keyframes kc-slideleftout{from{opacity:1;transform:translate(-50%,-50%)}to{opacity:0;transform:translate(-300%,-50%)}}
  @keyframes kc-sliderightout{from{opacity:1;transform:translate(-50%,-50%)}to{opacity:0;transform:translate(200%,-50%)}}
  @keyframes kc-scaleout{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-50%) scale(3)}}
  @keyframes kc-blurout{from{opacity:1;filter:blur(0)}to{opacity:0;filter:blur(20px)}}

  @keyframes kc-pulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.1)}}
  @keyframes kc-bounce{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-12px)}}
  @keyframes kc-shake{0%,100%{transform:translate(-50%,-50%) translateX(0)}25%{transform:translate(-50%,-50%) translateX(-6px)}75%{transform:translate(-50%,-50%) translateX(6px)}}
  @keyframes kc-glow{0%,100%{text-shadow:0 0 8px currentColor,0 0 16px currentColor}50%{text-shadow:0 0 20px currentColor,0 0 40px currentColor}}
  @keyframes kc-rainbow{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}
  @keyframes kc-flicker{0%,100%{opacity:1}50%{opacity:0.6}}
  @keyframes kc-typewriter{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();
