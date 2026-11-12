/* ==========================================================================
   explanation-viewer.js — fullscreen explanation modal patch
   NOTE: the CSS injected below is an INTENTIONAL DUPLICATE of the same rules
   in css/style.css (defensive). Both copies MUST exist.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. defensive duplicate CSS ---------- */
  if (!document.getElementById('explanation-viewer-styles')) {
    const style = document.createElement('style');
    style.id = 'explanation-viewer-styles';
    style.textContent = `
.fullscreen-explain-btn { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 6px 12px; font-size: .8rem; font-weight: 700; border: none; border-radius: 8px; background: #2563eb; color: #fff; }
.blink-btn { animation: blink-pulse 1.6s ease-in-out infinite; }
@keyframes blink-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, .55); opacity: 1; } 50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); opacity: .78; } }
#fullscreen-explain-modal { display: none; position: fixed; inset: 0; z-index: 100000; background: rgba(0, 0, 0, .88); align-items: stretch; justify-content: stretch; }
#fullscreen-explain-modal.open { display: flex; }
#fullscreen-explain-modal .modal-content { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; transition: background .25s ease, color .25s ease; }
#fullscreen-explain-modal .modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid transparent; flex-shrink: 0; }
#fullscreen-explain-modal .modal-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; }
#fullscreen-explain-modal .modal-actions { display: flex; gap: 8px; }
#fullscreen-explain-modal .modal-actions button { width: 42px; height: 42px; border-radius: 10px; border: 1px solid rgba(128, 128, 128, .4); background: transparent; color: inherit; font-size: 1.1rem; cursor: pointer; }
#fullscreen-explain-modal .modal-body { flex: 1; overflow-y: auto; padding: 24px clamp(16px, 5vw, 64px); font-size: 1.15rem; line-height: 1.85; overflow-wrap: anywhere; white-space: pre-wrap; }
#fullscreen-explain-modal .theme-white { background: #ffffff; color: #1f2937; }
#fullscreen-explain-modal .theme-white .modal-header { background: #f3f4f6; border-color: #e5e7eb; }
#fullscreen-explain-modal .theme-dark { background: #111827; color: #e5e7eb; }
#fullscreen-explain-modal .theme-dark .modal-header { background: #0b1220; border-color: #1f2937; }
#fullscreen-explain-modal .theme-sepia { background: #f4ecd8; color: #5b4636; }
#fullscreen-explain-modal .theme-sepia .modal-header { background: #eadfc4; border-color: #d8c8a2; }
`;
    document.head.appendChild(style);
  }

  /* ---------- 2. make sure the modal exists ---------- */
  function ensureModal() {
    if (document.getElementById('fullscreen-explain-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'fullscreen-explain-modal';
    wrap.innerHTML = `
      <div class="modal-content theme-white">
        <div class="modal-header">
          <h3>📖 Full Screen Explanation</h3>
          <div class="modal-actions">
            <button type="button" class="theme-btn" title="Change theme" onclick="toggleExplanationTheme(this)">💡</button>
            <button type="button" class="close-btn" title="Close" onclick="closeFullScreenExplanation()">✕</button>
          </div>
        </div>
        <div class="modal-body" id="fullscreen-explain-body"></div>
      </div>`;
    document.body.appendChild(wrap);
  }

  /* ---------- 3. globals ---------- */
  window.openFullScreenExplanation = function (btnElement) {
    ensureModal();
    const container =
      btnElement.closest('.explanation-box') ||
      btnElement.closest('.bg-blue-50') ||
      btnElement.closest('.bg-white.p-4.rounded-lg.border-l-4');
    if (!container) return;
    const clone = container.cloneNode(true);
    clone.querySelectorAll('.fullscreen-explain-btn').forEach((b) => b.remove());
    const body = document.getElementById('fullscreen-explain-body');
    body.innerHTML = clone.innerHTML;
    document.getElementById('fullscreen-explain-modal').classList.add('open');
    if (window.app && typeof app.triggerMathJax === 'function') app.triggerMathJax(body);
  };

  window.closeFullScreenExplanation = function () {
    const m = document.getElementById('fullscreen-explain-modal');
    if (m) m.classList.remove('open');
  };

  window.toggleExplanationTheme = function (btnElement) {
    const content = btnElement.closest('.modal-content');
    if (!content) return;
    if (content.classList.contains('theme-white')) {
      content.classList.remove('theme-white'); content.classList.add('theme-dark');
    } else if (content.classList.contains('theme-dark')) {
      content.classList.remove('theme-dark'); content.classList.add('theme-sepia');
    } else {
      content.classList.remove('theme-sepia'); content.classList.add('theme-white');
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeFullScreenExplanation();
  });

  /* ---------- 4. button injection ---------- */
  function injectBlinkButtons() {
    document.querySelectorAll('.explanation-box').forEach((box) => {
      if (box.querySelector('.fullscreen-explain-btn')) return;
      const target =
        box.querySelector('.bg-white.p-4.rounded-lg.border-l-4.border-blue-500') ||
        box.querySelector('.bg-blue-50') ||
        box;
      if ((target.textContent || '').trim().length < 5) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fullscreen-explain-btn blink-btn';
      btn.innerHTML = '<i class="fas fa-expand"></i> View in full screen';
      btn.onclick = function () { window.openFullScreenExplanation(this); };
      target.appendChild(btn);
    });
    // defensive cleanup: never inside the green "correct answer" box
    document.querySelectorAll('.bg-green-50 .fullscreen-explain-btn').forEach((b) => b.remove());
  }
  window.injectBlinkButtons = injectBlinkButtons;

  /* ---------- 5. wrap render methods ---------- */
  function install() {
    const app = window.app;
    if (!app || typeof app.renderQuestion !== 'function') { setTimeout(install, 100); return; }
    ensureModal();
    ['renderQuestion', 'showResult', 'showFullReview'].forEach((name) => {
      const orig = app[name];
      if (typeof orig !== 'function') return;        // showResult doesn't exist -> skipped
      app[name] = function () {
        const r = orig.apply(this, arguments);
        setTimeout(injectBlinkButtons, 400);
        return r;
      };
    });
  }
  install();
})();
