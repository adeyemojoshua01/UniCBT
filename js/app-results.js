/* ==========================================================================
   app-results.js — score view, full review, verse popup (base version)
   ========================================================================== */
(function () {
  'use strict';

  const VERSES_GOOD = [
    { text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.', ref: 'Colossians 3:23' },
    { text: 'I can do all things through Christ which strengtheneth me.', ref: 'Philippians 4:13' },
    { text: 'Seest thou a man diligent in his business? he shall stand before kings; he shall not stand before mean men.', ref: 'Proverbs 22:29' },
    { text: 'Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.', ref: '2 Timothy 2:15' },
    { text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.', ref: 'James 1:5' },
    { text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', ref: 'Proverbs 3:5' }
  ];

  const VERSES_TRY_AGAIN = [
    { text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.', ref: 'Galatians 6:9' },
    { text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', ref: 'Isaiah 40:31' },
    { text: 'For a just man falleth seven times, and riseth up again.', ref: 'Proverbs 24:16' },
    { text: 'Forgetting those things which are behind, and reaching forth unto those things which are before, I press toward the mark for the prize of the high calling of God in Christ Jesus.', ref: 'Philippians 3:13-14' },
    { text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', ref: 'Joshua 1:9' },
    { text: 'Though he fall, he shall not be utterly cast down: for the LORD upholdeth him with his hand.', ref: 'Psalm 37:24' }
  ];

  Object.assign(window.app, {

    /* ------------------------------------------------------------------ *
     *  SIMPLIFIED RESULT
     * ------------------------------------------------------------------ */
    showSimplifiedResult: function (score, total, percentage) {
      this._setMode('result');
      const passed = percentage >= 50;
      const wrong = total - score;
      document.getElementById('app-container').innerHTML = `
        <div class="max-w-xl mx-auto p-4 md:p-8 text-center">
          <div class="bg-white border border-gray-200 rounded-3xl shadow-2xl p-6 md:p-10">
            <div class="w-32 h-32 mx-auto rounded-full flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-red-100'} shadow-lg">
              <i class="fas ${passed ? 'fa-trophy text-green-600' : 'fa-face-sad-tear text-red-500'} text-6xl"></i>
            </div>
            <div class="text-7xl font-extrabold text-gray-800 mt-6">${percentage}%</div>
            <p class="text-gray-600 mt-1">${passed ? 'Great work!' : 'Keep practising — you will get there.'}</p>
            <div class="grid grid-cols-2 gap-4 my-8">
              <div class="bg-green-50 border border-green-200 rounded-xl p-4">
                <div class="text-3xl font-extrabold text-green-700">${score}</div>
                <div class="text-sm text-gray-600 font-semibold">Correct</div>
              </div>
              <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                <div class="text-3xl font-extrabold text-red-600">${wrong}</div>
                <div class="text-sm text-gray-600 font-semibold">Incorrect</div>
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <button type="button" onclick="app.showFullReview()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl"><i class="fas fa-search mr-2"></i>Preview Corrections &amp; Answers</button>
              <button type="button" onclick="app.showLanding()" class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl"><i class="fas fa-home mr-2"></i>Return Home</button>
            </div>
          </div>
        </div>`;
      setTimeout(() => this.showVersePopup(), 600);
    },

    /* ------------------------------------------------------------------ *
     *  FULL REVIEW
     * ------------------------------------------------------------------ */
    showFullReview: function () {
      const r = this.data.lastResults;
      if (!r) { this.toast('No results available to review.', 'error'); return; }
      this._setMode('review');
      const esc = (s) => this.esc(s);
      const details = r.details || [];
      const correctCount = details.filter((x) => x.isCorrect).length;
      const unanswered = details.filter((x) => x.userAnswer === 'Not Answered').length;
      const wrongCount = details.length - correctCount;

      const optText = (d, L) => (d.options && d.options[L] != null) ? d.options[L] : '';

      const cards = details.map((d, i) => {
        const isObj = d.questionType === 'objective';
        const isImg = String(d.userAnswer).startsWith('data:image');
        const userLetter = String(d.userAnswer || '').toUpperCase();
        const correctLetter = String(d.correctAnswer || '').toUpperCase();

        let userHtml;
        if (isImg) userHtml = `<img src="${d.userAnswer}" alt="Your answer" class="max-h-56 rounded-lg border border-gray-200 object-contain">`;
        else if (isObj && d.userAnswer !== 'Not Answered') userHtml = `<div class="whitespace-pre-wrap break-words">${esc(userLetter)}${optText(d, userLetter) ? ': ' + esc(optText(d, userLetter)) : ''}</div>`;
        else userHtml = `<div class="whitespace-pre-wrap break-words">${esc(d.userAnswer)}</div>`;

        let correctHtml;
        if (isObj) correctHtml = `${esc(correctLetter)}${optText(d, correctLetter) ? ': ' + esc(optText(d, correctLetter)) : ''}`;
        else correctHtml = esc(d.correctAnswer);

        const showCorrectPanel = !(d.isCorrect && d.questionType !== 'theory');
        const label = d.questionType === 'theory' ? 'AI Result' : 'Correct Answer';

        let optionsGrid = '';
        if (isObj && d.options) {
          optionsGrid = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">${['A', 'B', 'C', 'D'].filter((L) => d.options[L] != null && String(d.options[L]).trim() !== '').map((L) => {
            let cls = 'border-gray-200 bg-white';
            if (L === correctLetter) cls = 'border-green-500 bg-green-50';
            else if (L === userLetter) cls = 'border-red-500 bg-red-50';
            return `<div class="border-2 rounded-lg p-2 text-sm break-words ${cls}"><span class="font-bold mr-1">${L}.</span>${esc(d.options[L])}</div>`;
          }).join('')}</div>`;
        }

        return `
          <div class="bg-white border border-gray-200 rounded-xl shadow p-4 md:p-5 border-l-8 ${d.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}" style="border-left-color:${d.isCorrect ? '#10b981' : '#f43f5e'}">
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="font-bold text-gray-800">Question ${i + 1}</span>
              <span class="px-3 py-1 rounded-full text-xs font-bold ${d.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">${d.isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words text-gray-800">${esc(d.question)}</div>
            ${optionsGrid}
            <div class="grid grid-cols-1 ${showCorrectPanel ? 'md:grid-cols-2' : ''} gap-3 mt-3">
              <div class="rounded-lg border border-gray-200 p-3 bg-white min-w-0">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Your Answer</div>
                <div class="text-gray-800">${userHtml}</div>
              </div>
              ${showCorrectPanel ? `<div class="rounded-lg border border-green-200 bg-green-50 p-3 min-w-0">
                <div class="text-xs font-bold uppercase tracking-wide text-green-700 mb-1">${label}</div>
                <div class="text-gray-800 break-words">${correctHtml}</div>
              </div>` : ''}
            </div>
            ${d.explanation ? `
            <div class="explanation-box mt-3">
              <div class="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                <div class="font-bold text-gray-800 mb-1">📚 Explanation:</div>
                <div class="whitespace-pre-wrap break-words text-gray-800">${esc(d.explanation)}</div>
              </div>
            </div>` : ''}
          </div>`;
      }).join('');

      document.getElementById('app-container').innerHTML = `
        <div class="max-w-3xl mx-auto p-3 md:p-6 space-y-4">
          <div class="bg-white border border-gray-200 rounded-2xl shadow-lg p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-xl font-bold text-gray-800 break-words">${esc(r.name)}</h2>
                <p class="text-gray-600 break-words">${esc(r.subjectName)} · ${r.examMode === 'study' ? 'Study' : 'Practice'} · ${new Date(r.date).toLocaleString()}</p>
              </div>
              <div class="text-right">
                <div class="text-4xl font-extrabold ${r.percentage >= 50 ? 'text-green-600' : 'text-red-500'}">${r.percentage}%</div>
                <div class="text-sm text-gray-600 font-semibold">${r.score} / ${r.total}</div>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center"><div class="text-xl font-bold text-gray-800">${r.total}</div><div class="text-xs text-gray-500">Total</div></div>
              <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center"><div class="text-xl font-bold text-green-700">${correctCount}</div><div class="text-xs text-gray-500">Correct</div></div>
              <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-center"><div class="text-xl font-bold text-red-600">${wrongCount}</div><div class="text-xs text-gray-500">Incorrect</div></div>
              <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-center"><div class="text-xl font-bold text-yellow-700">${unanswered}</div><div class="text-xs text-gray-500">Unanswered</div></div>
            </div>
          </div>
          ${cards}
          <div class="flex flex-col sm:flex-row gap-3 pb-6">
            <button type="button" onclick="app.showLanding()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl"><i class="fas fa-home mr-2"></i>Home</button>
            <button type="button" onclick="app.showSimplifiedResult(app.data.lastResults.score, app.data.lastResults.total, app.data.lastResults.percentage)" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl"><i class="fas fa-arrow-left mr-2"></i>Back to Score</button>
          </div>
        </div>`;
      this.triggerMathJax();
    },

    /* ------------------------------------------------------------------ *
     *  VERSE POPUP (base version — restyled by verse-popup.js)
     * ------------------------------------------------------------------ */
    showVersePopup: function () {
      const last = this.data.lastResults || (this.data.results || [])[(this.data.results || []).length - 1];
      const good = last ? last.percentage >= 50 : true;
      const verse = (good ? VERSES_GOOD : VERSES_TRY_AGAIN)[Math.floor(Math.random() * (good ? VERSES_GOOD : VERSES_TRY_AGAIN).length)];

      if (!document.getElementById('verse-popup-keyframes')) {
        const st = document.createElement('style');
        st.id = 'verse-popup-keyframes';
        // translateX(-50%) MUST stay in both keyframes or the centred popup jumps sideways.
        st.textContent = '@keyframes slideUpVerse{from{opacity:0;transform:translateX(-50%) translateY(40px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(st);
      }
      const old = document.getElementById('verse-popup');
      if (old) old.remove();

      const popup = document.createElement('div');
      popup.id = 'verse-popup';
      popup.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999999;pointer-events:none;width:min(92vw,520px);animation:slideUpVerse 0.4s ease-out;';
      const bg = good ? 'linear-gradient(135deg,#166534,#15803d)' : 'linear-gradient(135deg,#78350f,#92400e)';
      popup.innerHTML = `
        <div class="verse-card" style="pointer-events:auto;background:${bg};color:#fff;border:2px solid #fbbf24;border-radius:18px;padding:18px 20px;box-shadow:0 18px 40px rgba(0,0,0,.45);text-align:center;">
          <div class="verse-icon" style="font-size:1.8rem;margin-bottom:4px;">${good ? '🎓✨' : '🌱💪'}</div>
          <div class="verse-title" style="font-weight:800;font-size:1.15rem;color:#fbbf24;margin-bottom:8px;">${good ? '🎉 Congratulations! 🎉' : '💪 Keep Going! 💪'}</div>
          <div class="verse-text" style="font-style:italic;line-height:1.5;font-size:.95rem;">“${this.esc(verse.text)}”</div>
          <div class="verse-ref" style="margin-top:6px;font-weight:700;color:#fcd34d;font-size:.85rem;">— ${this.esc(verse.ref)}</div>
          <button type="button" class="verse-continue" style="margin-top:12px;padding:8px 22px;border:none;border-radius:9999px;background:#fbbf24;color:#3b2a05;font-weight:800;cursor:pointer;">Continue</button>
        </div>`;
      document.body.appendChild(popup);
      popup.querySelector('.verse-continue').addEventListener('click', () => popup.remove());
      setTimeout(() => { if (popup.parentNode) popup.remove(); }, 6000);
    }
  });
})();
