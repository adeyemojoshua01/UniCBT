/* ============================================================
   init.js — bootstrap. MUST load last.
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.app || typeof app.init !== 'function') {
    console.error('init.js: window.app missing or app.init() undefined — check script load order in index.html');
    return;
  }
  app.init();
});

window.addEventListener('beforeunload', function (e) {
  if (window.app && app.data && app.data.mode === 'test') {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
