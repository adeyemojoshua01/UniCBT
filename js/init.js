/* ==========================================================================
   init.js — bootstrap (MUST be the last script loaded)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.app || typeof app.init !== 'function') {
    console.error('init.js: window.app missing or app.init() undefined ' +
                  '— check script load order in index.html');
    return;
  }
  app.init();
});

// Native "leave page?" guard while an exam is in progress.
window.addEventListener('beforeunload', (e) => {
  if (window.app && app.data && app.data.mode === 'test') {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
