/* ============================================================
   explanation-viewer.js — fullscreen explanation modal patch
   NOTE: The <style> below is an intentional duplicate of the
   relevant rules in css/style.css (defensive patch).
   ============================================================ */
(function () {
  'use strict';

  var duplicateCSS = '<style id="explanation-viewer-css">' +
    '.blink-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;cursor:pointer;animation:blink-pulse 2.2s ease-in-out infinite;margin-top:10px}' +
    '.blink-btn:hover{background:#dbeafe;transform:translateY(-1px)}' +
    '@keyframes blink-pulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.35)}50%{box-shadow:0 0 0 6px rgba(37,99,235,0)}}' +
    '#fullscreen-explain-modal{display:none;position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.78);padding:16px;overflow-y:auto}' +
    '#fullscreen-explain-modal.open{display:flex;align-items:flex-start;justify-content:center}' +
    '#fullscreen-explain-modal .modal-content{width:100%;max-width:900px;margin:24px auto;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,.45);border:1px solid rgba(148,163,184,.35);overflow:hidden}' +
    '#fullscreen-explain-modal .explain-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;font-weight:700;font-size:15px}' +
    '#fullscreen-explain-modal .explain-modal-actions{display:flex;gap:8px}' +
    '#fullscreen-explain-modal .explain-modal-actions button{width:34px;height:34px;border-radius:9px;border:1px solid rgba(148,163,184,.4);cursor:pointer;font-size:15px;line-height:1}' +
    '#fullscreen-explain-body{padding:18px 22px 26px;font-size:15px;line-height:1.75}' +
    '#fullscreen-explain-modal .theme-white{background:#ffffff;color:#1e293b}' +
    '#fullscreen-explain-modal .theme-white .explain-modal-header{background:#f1f5f9;border-bottom:1px solid #e2e8f0;color:#0f172a}' +
    '#fullscreen-explain-modal .theme-white .explain-modal-actions button{background:#e2e8f0;color:#0f172a}' +
    '#fullscreen-explain-modal .theme-dark{background:#0f172a;color:#e2e8f0}' +
    '#fullscreen-explain-modal .theme-dark .explain-modal-header{background:#1e293b;border-bottom:1px solid #334155;color:#f8fafc}' +
    '#fullscreen-explain-modal .theme-dark .explain-modal-actions button{background:#334155;color:#f8fafc}' +
    '#fullscreen-explain-modal .theme-sepia{background:#f6ecd9;color:#42301a}' +
    '#fullscreen-explain-modal .theme-sepia .explain-modal-header{background:#efe0c4;border-bottom:1px solid #dcc5a0;color:#42301a}' +
    '#fullscreen-explain-modal .theme-sepia .explain-modal-actions button{background:#e6d5b8;color:#42301a}' +
    'mjx-container{max-width:100% !important;overflow-x:auto;overflow-y:hidden}' +
    'mjx-container[display="true"]{display:block !important;width:100% !important;max-width:100% !important;overflow-x:auto !important;overflow-y:hidden;-webkit-overflow-scrolling:touch}' +
    '.flex > *,.flex-grow{min-width:0}.prose,.note-content{max-width:100%}' +
    '</style>';
  if (!document.getElementById('explanation-viewer-css')) {
    document.head.insertAdjacentHTML('beforeend', duplicateCSS);
  }

  window.openFullScreenExplanation = function (btnElement) {
    var modal = document.getElementById('fullscreen-explain-modal');
    var body = document.getElementById('fullscreen-explain-body');
    if (!modal || !body) return;

    var box = null;
    if (btnElement && btnElement.closest) {
      box = btnElement.closest('.explanation-box') ||
        btnElement.closest('.bg-blue-50') ||
        btnElement.closest('.bg-white.p-4.rounded-lg.border-l-4');
    }
    if (!box && btnElement && btnElement.parentElement) {
      box = btnElement.parentElement;
    }
    if (!box) return;

    var clone = box.cloneNode(true);
    clone.querySelectorAll('.fullscreen-explain-btn').forEach(function (b) { b.remove(); });
    body.innerHTML = clone.innerHTML;
    modal.classList.add('open');
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      try { window.MathJax.typesetPromise([body]).catch(function () {}); } catch (e) {}
    }
  };

  window.toggleExplanationTheme = function (btnElement) {
    var modal = document.getElementById('fullscreen-explain-modal');
    if (!modal) return;
    var content = modal.querySelector('.modal-content');
    if (!content) return;
    var order = ['theme-white', 'theme-dark', 'theme-sepia'];
    var current = 0;
    order.forEach(function (cls, i) { if (content.classList.contains(cls)) current = i; });
    var next = order[(current + 1) % order.length];
    order.forEach(function (cls) { content.classList.remove(cls); });
    content.classList.add(next);
  };

  /* expose the same triggers on the app namespace (inline markup uses app.*) */
  if (window.app) {
    window.app.openFullScreenExplanation = window.openFullScreenExplanation;
    window.app.toggleExplanationTheme = window.toggleExplanationTheme;
  }

  function injectBlinkButtons() {
    /* defensive cleanup: never leave the trigger inside a correct-answer box */
    document.querySelectorAll('.bg-green-50 .fullscreen-explain-btn').forEach(function (b) { b.remove(); });

    document.querySelectorAll('.explanation-box').forEach(function (box) {
      if (box.querySelector('.fullscreen-explain-btn')) return;
      var preferred = box.querySelector('.bg-white.p-4.rounded-lg.border-l-4.border-blue-500') ||
        box.querySelector('.bg-blue-50') || box;
      if (!preferred) return;
      if ((preferred.textContent || '').trim().length < 5) return;
      var btn = document.createElement('button');
      btn.className = 'fullscreen-explain-btn blink-btn';
      btn.innerHTML = '<i class="fas fa-expand"></i> View in full screen';
      btn.setAttribute('type', 'button');
      btn.onclick = function () { window.openFullScreenExplanation(btn); };
      preferred.appendChild(btn);
    });
  }
  window.injectBlinkButtons = injectBlinkButtons;

  function patchAfterRender(name) {
    if (typeof app[name] !== 'function') return;
    var original = app[name];
    app[name] = function () {
      var result = original.apply(this, arguments);
      setTimeout(injectBlinkButtons, 400);
      return result;
    };
  }

  patchAfterRender('renderQuestion');
  patchAfterRender('showResult');       /* does not exist — typeof guard skips it */
  patchAfterRender('showFullReview');
})();
