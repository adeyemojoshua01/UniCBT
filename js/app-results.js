/* ============================================================
   app-results.js — score view, full review, verse popup
   ============================================================ */
(function () {
  'use strict';

  var VERSES_GOOD = [
    { text: 'I can do all things through Christ who strengthens me.', ref: 'Philippians 4:13' },
    { text: 'Commit to the LORD whatever you do, and he will establish your plans.', ref: 'Proverbs 16:3' },
    { text: 'Whatever you do, work at it with all your heart, as working for the Lord.', ref: 'Colossians 3:23' },
    { text: 'The LORD is my strength and my shield; my heart trusts in him.', ref: 'Psalm 28:7' },
    { text: 'Let all that you do be done in love.', ref: '1 Corinthians 16:14' },
    { text: 'Be strong and courageous. Do not be afraid; do not be discouraged.', ref: 'Joshua 1:9' }
  ];
  var VERSES_TRY_AGAIN = [
    { text: 'For though the righteous fall seven times, they rise again.', ref: 'Proverbs 24:16' },
    { text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest.', ref: 'Galatians 6:9' },
    { text: 'I can do all things through Christ who strengthens me.', ref: 'Philippians 4:13' },
    { text: 'The LORD makes firm the steps of the one who delights in him.', ref: 'Psalm 37:23' },
    { text: 'Do not be anxious about anything, but in every situation, by prayer, present your requests to God.', ref: 'Philippians 4:6' },
    { text: 'Being confident of this, that he who began a good work in you will carry it on to completion.', ref: 'Philippians 1:6' }
  ];

  var resultMethods = {

    /* ---------------- simplified score view ---------------- */
    showSimplifiedResult: function (score, total, percentage) {
      this.data.mode = 'result';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      this.updateHeader();
      var container = document.getElementById('app-container');
      if (!container) return;
      var passed = Number(percentage) >= 50;
      var incorrect = Math.max(0, Number(total) - Number(score));
      var result = this.data.lastResults;

      container.innerHTML = '<div class="max-w-2xl mx-auto py-2 md:py-6">' +
        '<div class="rounded-3xl bg-white border border-gray-200 shadow-xl overflow-hidden">' +
        '<div class="p-7 md:p-10 text-center border-b border-gray-200 bg-gray-50">' +
        '<div class="mx-auto w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg ' + (passed ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500') + '">' +
        (passed ? '🏆' : '😔') + '</div>' +
        '<div class="mt-5 text-5xl md:text-6xl font-extrabold tracking-tight ' + (passed ? 'text-green-700' : 'text-red-500') + '">' + percentage + '%</div>' +
        '<p class="text-gray-500 mt-2 text-sm font-semibold uppercase tracking-wider">' + (passed ? 'Well done — you passed' : 'Keep going — you will get there') + '</p>' +
        '<p class="text-gray-600 mt-2 text-sm">' + this.esc(result ? result.subjectName : 'Exam') + ' · ' + this.esc(result ? result.name : this.data.candidateName) + ' · ' + (this.data.examMode === 'study' ? 'Study' : 'Practice') + ' mode</p>' +
        '</div>' +
        '<div class="p-6 md:p-8">' +
        '<div class="grid grid-cols-2 gap-4">' +
        '<div class="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">' +
        '<div class="text-3xl font-extrabold text-green-700">' + score + '</div>' +
        '<div class="text-xs font-bold uppercase tracking-wider text-green-700 mt-1"><i class="fas fa-circle-check mr-1"></i>Correct</div></div>' +
        '<div class="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">' +
        '<div class="text-3xl font-extrabold text-red-600">' + incorrect + '</div>' +
        '<div class="text-xs font-bold uppercase tracking-wider text-red-600 mt-1"><i class="fas fa-circle-xmark mr-1"></i>Incorrect</div></div>' +
        '</div>' +
        '<div class="mt-4 flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm">' +
        '<span class="text-gray-500 font-semibold">Final score</span>' +
        '<span class="font-extrabold text-gray-800">' + score + ' / ' + total + ' questions</span></div>' +
        '<div class="mt-6 space-y-2.5">' +
        '<button onclick="app.showFullReview()" class="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"><i class="fas fa-list-check"></i> Preview Corrections &amp; Answers</button>' +
        '<button onclick="app.showLanding()" class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold"><i class="fas fa-house"></i> Return Home</button>' +
        '</div></div></div></div>';

      container.scrollTop = 0;
      this.triggerMathJax();
      var self = this;
      setTimeout(function () { self.showVersePopup(); }, 600);
    },

    /* ---------------- full review ---------------- */
    showFullReview: function () {
      var result = this.data.lastResults;
      if (!result) {
        this.toast('No result available to review. Take an exam first.', 'error');
        return this.showLanding();
      }
      this.data.mode = 'review';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;
      var correctCount = (result.details || []).filter(function (d) { return d.isCorrect; }).length;
      var incorrectCount = (result.details || []).length - correctCount;

      var cards = (result.details || []).map(function (d, idx) {
        var q = d.question || {};
        var opts = d.options || {};
        var answerIsImage = typeof d.userAnswer === 'string' && d.userAnswer.indexOf('data:image') === 0;
        var yourAnswerHtml = answerIsImage
          ? '<img src="' + d.userAnswer + '" alt="Your submitted answer" class="max-h-64 rounded-lg border border-gray-200">'
          : '<div class="text-sm text-gray-700 whitespace-pre-wrap break-words">' + self.esc(d.userAnswer) + '</div>';
        var showCorrectPanel = !(d.isCorrect && d.questionType !== 'theory');
        var correctPanel = '<div class="rounded-xl border border-green-200 bg-green-50 p-3">' +
          '<div class="text-[11px] font-extrabold uppercase tracking-wider text-green-700 mb-1">' +
          (d.questionType === 'theory' ? 'AI Result' : 'Correct Answer') + '</div>' +
          '<div class="text-sm font-bold text-green-800 break-words">' + self.esc(d.correctAnswer) + '</div>' +
          (d.questionType === 'objective' && opts[d.correctAnswer] ? '<div class="text-sm text-green-800 mt-1">' + self.esc(opts[d.correctAnswer]) + '</div>' : '') +
          '</div>';

        var optionsGrid = '';
        if (d.questionType === 'objective' && opts && Object.keys(opts).length) {
          optionsGrid = '<div class="grid sm:grid-cols-2 gap-2 mt-3">' + ['A', 'B', 'C', 'D'].filter(function (k) { return opts[k] !== undefined && opts[k] !== null; }).map(function (k) {
            var isCorrect = String(q.correct || '').toUpperCase() === k;
            var isWrongPick = !isCorrect && String(d.userAnswer || '').toUpperCase() === k;
            var cls = isCorrect ? 'border-green-500 bg-green-50' : (isWrongPick ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white');
            return '<div class="rounded-lg border p-2.5 text-sm ' + cls + '">' +
              '<span class="font-extrabold mr-1.5 ' + (isCorrect ? 'text-green-700' : (isWrongPick ? 'text-red-600' : 'text-gray-500')) + '">' + k + '</span>' +
              '<span class="text-gray-700 break-words">' + self.esc(opts[k]) + '</span>' +
              (isCorrect ? '<i class="fas fa-check text-green-600 ml-1.5"></i>' : '') +
              (isWrongPick ? '<i class="fas fa-xmark text-red-500 ml-1.5"></i>' : '') +
              '</div>';
          }).join('') + '</div>';
        }

        var explanation = d.explanation
          ? '<div class="mt-3"><div class="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">📚 Explanation</div>' +
            '<div class="explanation-box whitespace-pre-wrap break-words">' + self.esc(d.explanation) +
            '<button onclick="app.openFullScreenExplanation(this)" class="fullscreen-explain-btn blink-btn"><i class="fas fa-expand"></i> View in full screen</button></div></div>'
          : '';

        return '<div class="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden border-l-4 ' + (d.isCorrect ? 'border-l-green-500' : 'border-l-red-500') + '">' +
          '<div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">' +
          '<div class="flex items-center gap-2 flex-wrap">' +
          '<span class="w-7 h-7 rounded-lg ' + (d.isCorrect ? 'bg-green-500' : 'bg-red-500') + ' text-white flex items-center justify-center text-xs font-extrabold">' + (idx + 1) + '</span>' +
          '<span class="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600 text-[10px] font-extrabold uppercase tracking-wider">' + self.esc(d.questionType === 'objective' ? 'MCQ' : d.questionType) + '</span>' +
          (q.subTopic ? '<span class="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">' + self.esc(q.subTopic) + '</span>' : '') +
          '</div>' +
          '<span class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ' + (d.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600') + '">' + (d.isCorrect ? '✓ Correct' : '✗ Incorrect') + '</span>' +
          '</div>' +
          '<div class="p-5">' +
          '<div class="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-3"><p class="text-sm md:text-base font-medium text-gray-800 whitespace-pre-wrap break-words">' + self.esc(q.text || '') + '</p></div>' +
          '<div class="grid md:grid-cols-2 gap-3">' +
          '<div class="rounded-xl border border-gray-200 bg-white p-3"><div class="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">Your Answer</div>' + yourAnswerHtml + '</div>' +
          (showCorrectPanel ? correctPanel : '<div class="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-2 text-sm font-bold text-green-700"><i class="fas fa-circle-check"></i> Perfect — correct answer selected.</div>') +
          '</div>' +
          optionsGrid + explanation +
          '</div></div>';
      }).join('');

      container.innerHTML = '<div class="max-w-4xl mx-auto">' +
        '<div class="rounded-2xl bg-white border border-gray-200 shadow-xl p-5 md:p-7 mb-5">' +
        '<div class="flex flex-wrap items-start justify-between gap-4">' +
        '<div class="min-w-0">' +
        '<button onclick="app.showSimplifiedResult(' + result.score + ',' + result.total + ',' + result.percentage + ')" class="text-xs font-bold text-gray-500 hover:text-green-600 mb-2 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Back to score</button>' +
        '<h2 class="text-2xl font-extrabold text-gray-800">Full Review</h2>' +
        '<p class="text-sm text-gray-500 mt-1">' + self.esc(result.name) + ' · ' + self.esc(result.subjectName) + ' · ' + self.esc(self.formatDate(result.date)) + '</p>' +
        '<span class="inline-block mt-2 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold capitalize"><i class="fas ' + (result.examMode === 'study' ? 'fa-lightbulb' : 'fa-stopwatch') + ' mr-1"></i>' + self.esc(result.examMode || 'practice') + ' mode</span>' +
        '</div>' +
        '<div class="text-right shrink-0"><div class="text-4xl font-extrabold ' + (result.percentage >= 50 ? 'text-green-700' : 'text-red-500') + '">' + result.percentage + '%</div>' +
        '<div class="text-xs font-bold text-gray-500">' + result.score + ' / ' + result.total + ' correct</div></div>' +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5">' +
        '<div class="rounded-xl bg-gray-50 border border-gray-200 p-2.5 text-center"><div class="text-lg font-extrabold text-gray-800">' + result.total + '</div><div class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Questions</div></div>' +
        '<div class="rounded-xl bg-green-50 border border-green-200 p-2.5 text-center"><div class="text-lg font-extrabold text-green-700">' + correctCount + '</div><div class="text-[10px] uppercase tracking-wider text-green-700 font-bold">Correct</div></div>' +
        '<div class="rounded-xl bg-red-50 border border-red-200 p-2.5 text-center"><div class="text-lg font-extrabold text-red-600">' + incorrectCount + '</div><div class="text-[10px] uppercase tracking-wider text-red-600 font-bold">Incorrect</div></div>' +
        '<div class="rounded-xl bg-purple-50 border border-purple-200 p-2.5 text-center"><div class="text-lg font-extrabold text-purple-700">' + (result.details || []).filter(function (d) { return d.questionType === 'theory'; }).length + '</div><div class="text-[10px] uppercase tracking-wider text-purple-700 font-bold">Theory</div></div>' +
        '</div></div>' +
        '<div class="space-y-4">' + cards + '</div>' +
        '<div class="flex flex-wrap items-center justify-between gap-3 mt-6 pb-4">' +
        '<button onclick="app.showLanding()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold"><i class="fas fa-house"></i> Home</button>' +
        '<button onclick="app.showSimplifiedResult(' + result.score + ',' + result.total + ',' + result.percentage + ')" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"><i class="fas fa-arrow-left"></i> Back to Score</button>' +
        '</div></div>';

      container.scrollTop = 0;
      this.triggerMathJax();
    },

    /* ---------------- verse popup (base; restyled by verse-popup.js) ---------------- */
    showVersePopup: function () {
      var old = document.getElementById('verse-popup');
      if (old) old.remove();
      var result = this.data.results && this.data.results.length ? this.data.results[this.data.results.length - 1] : this.data.lastResults;
      var percentage = result ? Number(result.percentage) || 0 : 0;
      var good = percentage >= 50;
      var pool = good ? VERSES_GOOD : VERSES_TRY_AGAIN;
      var verse = pool[Math.floor(Math.random() * pool.length)];

      if (!document.getElementById('verse-popup-keyframes')) {
        var style = document.createElement('style');
        style.id = 'verse-popup-keyframes';
        style.textContent = '@keyframes slideUpVerse{from{opacity:0;transform:translate(-50%,26px)}to{opacity:1;transform:translate(-50%,0)}}';
        document.head.appendChild(style);
      }

      var wrap = document.createElement('div');
      wrap.id = 'verse-popup';
      wrap.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999999;pointer-events:none;width:min(92vw,440px);animation:slideUpVerse 0.4s ease-out;';
      wrap.innerHTML = '<div style="pointer-events:auto;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);border:2px solid #F59E0B;background:linear-gradient(140deg,' + (good ? '#065f46,#047857' : '#78350f,#92400e') + ');color:#fff;padding:16px 18px;">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;">' +
        '<div style="font-size:26px;line-height:1">' + (good ? '🎓✨' : '🌱💪') + '</div>' +
        '<div style="min-width:0;flex:1">' +
        '<div style="font-weight:800;font-size:14px;color:#FCD34D;margin-bottom:4px">' + (good ? '🎉 Congratulations! 🎉' : '💪 Keep Going! 💪') + '</div>' +
        '<p style="font-size:13px;line-height:1.5;margin:0 0 4px;font-style:italic">“' + this.esc(verse.text) + '”</p>' +
        '<div style="font-size:11px;font-weight:700;color:#FDE68A;letter-spacing:.04em">' + this.esc(verse.ref) + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px">' +
        '<span style="font-size:11px;color:rgba(255,255,255,.75)">' + percentage + '% scored</span>' +
        '<button onclick="document.getElementById(\'verse-popup\').remove()" style="background:#F59E0B;color:#0F172A;border:0;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer">Continue</button>' +
        '</div></div></div></div>';
      document.body.appendChild(wrap);
      setTimeout(function () {
        var p = document.getElementById('verse-popup');
        if (p) p.remove();
      }, 6000);
    }
  };

  Object.keys(resultMethods).forEach(function (k) {
    window.app[k] = resultMethods[k];
  });
})();
