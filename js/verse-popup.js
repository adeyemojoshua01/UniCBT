/* ============================================================
   verse-popup.js — "Midnight Scholar" restyle patch for the
   verse popup built by app-results.js
   ============================================================ */
(function () {
  'use strict';

  if (!window.app || typeof app.showVersePopup !== 'function') return;
  var original = app.showVersePopup;

  app.showVersePopup = function () {
    /* remove any pre-existing popup before calling through */
    var existing = document.getElementById('verse-popup');
    if (existing) existing.remove();

    /* palette picked from the most recent result (base function reads it too) */
    var source = this.data.results && this.data.results.length
      ? this.data.results[this.data.results.length - 1]
      : this.data.lastResults;
    var good = source ? Number(source.percentage) >= 50 : false;

    var result = original.apply(this, arguments);

    setTimeout(function () {
      var popup = document.getElementById('verse-popup');
      if (!popup) return;
      var card = popup.firstElementChild;
      if (!card) return;

      /* Midnight Scholar shell: indigo gradient + amber accent */
      card.style.background = 'linear-gradient(150deg, #1E1B4B 0%, #312E81 52%, #0B1020 100%)';
      card.style.border = '2px solid #F59E0B';
      card.style.color = '#E2E8F0';
      card.style.boxShadow = '0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(245,158,11,.15)';

      var title = card.querySelector('div[style*="font-weight:800"]');
      if (title) {
        title.style.color = '#F59E0B';
        title.style.fontSize = '14px';
        title.style.letterSpacing = '.01em';
      }
      var quote = card.querySelector('p');
      if (quote) { quote.style.color = '#E2E8F0'; quote.style.fontSize = '13px'; }
      var ref = card.querySelector('div[style*="letter-spacing"]');
      if (ref) { ref.style.color = '#FBBF24'; }

      var muted = card.querySelector('span[style*="rgba(255,255,255"]');
      if (muted) muted.style.color = 'rgba(226,232,240,.72)';

      var btn = card.querySelector('button');
      if (btn) {
        btn.style.background = '#F59E0B';
        btn.style.color = '#0F172A';
        btn.style.border = '1px solid #FBBF24';
        btn.style.fontWeight = '800';
        btn.style.padding = '6px 16px';
        btn.style.borderRadius = '8px';
      }

      /* ensure the keyframes style tag exists (base injects it; be defensive) */
      if (!document.getElementById('verse-popup-keyframes')) {
        var style = document.createElement('style');
        style.id = 'verse-popup-keyframes';
        style.textContent = '@keyframes slideUpVerse{from{opacity:0;transform:translate(-50%,26px)}to{opacity:1;transform:translate(-50%,0)}}';
        document.head.appendChild(style);
      }

      /* keep the amber identity for good runs, amber-violet for retry */
      var accentIcon = card.querySelector('div[style*="font-size:26px"]');
      if (accentIcon) accentIcon.textContent = good ? '🎓✨' : '🌱💪';
    }, 30);

    return result;
  };
})();
