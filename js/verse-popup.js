/* ==========================================================================
   verse-popup.js — "Midnight Scholar" theme patch for the verse popup.
   Wraps app.showVersePopup AFTER it exists: removes any previous popup,
   lets the original build the DOM, then restyles it.
   ========================================================================== */
(function () {
  'use strict';

  function install() {
    const app = window.app;
    if (!app || typeof app.showVersePopup !== 'function') { setTimeout(install, 100); return; }
    if (app._versePatched) return;
    app._versePatched = true;

    const original = app.showVersePopup;
    app.showVersePopup = function () {
      const stale = document.getElementById('verse-popup');
      if (stale) stale.remove();

      const result = original.apply(this, arguments);

      const popup = document.getElementById('verse-popup');
      if (!popup) return result;

      const results = (this.data && this.data.results) || [];
      const last = results[results.length - 1] || (this.data && this.data.lastResults);
      const good = last ? last.percentage >= 50 : true;

      const card = popup.querySelector('.verse-card');
      if (card) {
        card.style.background = good
          ? 'linear-gradient(135deg,#1E1B4B 0%,#312E81 55%,#3730A3 100%)'
          : 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 55%,#312E81 100%)';
        card.style.border = '2px solid #F59E0B';
        card.style.color = '#E0E7FF';
        card.style.boxShadow = '0 18px 44px rgba(15,23,42,.65), 0 0 0 1px rgba(245,158,11,.25)';
      }
      const title = popup.querySelector('.verse-title');
      if (title) title.style.color = '#F59E0B';
      const ref = popup.querySelector('.verse-ref');
      if (ref) ref.style.color = '#FBBF24';
      const btn = popup.querySelector('.verse-continue');
      if (btn) {
        btn.style.background = '#F59E0B';
        btn.style.color = '#0F172A';
      }
      return result;
    };
  }
  install();
})();
