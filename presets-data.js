/* Extra preset recipes — loaded after filters.js so users can export/import these easily. */
window.USER_PRESETS_KEY = 'kriticut_user_presets';

window.loadUserPresets = () => {
  try { return JSON.parse(localStorage.getItem(USER_PRESETS_KEY)||'[]'); } catch(e){ return []; }
};
window.saveUserPresets = list => {
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(list));
};
