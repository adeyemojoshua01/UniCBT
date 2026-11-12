/* ============================================================
   app-exam.js — timer, test UI, renderQuestion, answer handling
   ============================================================ */
(function () {
  'use strict';

  function isAnswered(app, q) {
    var v = app.data.userAnswers[q.id];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  var examMethods = {

    /* ---------------- timer ---------------- */
    startTimer: function () {
      if (this.data.timer) clearInterval(this.data.timer);
      if (!this.data.endTime) this.data.endTime = Date.now() + this.data.timeLeft * 1000;
      this.updateTimerDisplay();
      this.saveExamState();
      this.data.timer = setInterval(function () {
        var remaining = Math.max(0, Math.round((app.data.endTime - Date.now()) / 1000));
        if (remaining === app.data.timeLeft) return;   // skip no-op
        app.data.timeLeft = remaining;
        app.updateTimerDisplay();
        app.saveExamState();
        if (remaining <= 0) {
          clearInterval(app.data.timer);
          app.data.timer = null;
          app.submitTest();
        }
      }, 250);
    },

    stopTimer: function () {
      if (this.data.timer) clearInterval(this.data.timer);
      this.data.timer = null;
      this.data.endTime = null;
    },

    updateTimerDisplay: function () {
      var el = document.getElementById('timer-display');
      if (!el) return;
      var txt = this.formatSeconds(this.data.timeLeft);
      el.innerHTML = '<i class="fas fa-clock text-sm"></i>' + txt;
      el.classList.remove('text-red-500', 'animate-pulse');
      if (this.data.timeLeft < 60) el.classList.add('text-red-500', 'animate-pulse');
    },

    /* ---------------- test shell ---------------- */
    showTestInterface: function () {
      this.data.mode = 'test';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      this.updateHeader();
      this.renderQuestion();
      this.saveExamState();
    },

    navigatorHTML: function () {
      var d = this.data;
      var out = '';
      for (var i = 0; i < d.questions.length; i++) {
        var q = d.questions[i];
        var answered = isAnswered(this, q);
        var active = i === d.currentQuestionIndex;
        var cls = active
          ? 'bg-blue-600 text-white border-blue-700 shadow-md'
          : (answered ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200');
        out += '<button onclick="app.jumpToQuestion(' + i + ')" title="Question ' + (i + 1) + (answered ? ' · answered' : ' · unanswered') + '" class="h-8 w-8 rounded-lg border text-[11px] font-bold transition-colors ' + cls + '">' + (i + 1) + '</button>';
      }
      return out;
    },

    theoryMarkup: function (q) {
      var d = this.data;
      var isStudy = d.examMode === 'study';
      var revealed = d.answerRevealed[q.id];
      var answer = d.userAnswers[q.id];
      var maxMarks = q.maxMarks || 10;

      if (isStudy && revealed && revealed.score !== undefined) {
        var submitted = answer && String(answer).startsWith('data:image')
          ? '<img src="' + answer + '" alt="Submitted answer" class="max-h-64 rounded-lg border border-gray-200">'
          : '<div class="text-sm text-gray-700 whitespace-pre-wrap break-words bg-white rounded-lg border border-gray-200 p-3">' + app.esc(answer || 'No answer submitted') + '</div>';
        return '<div class="mt-4 rounded-xl border-2 border-purple-300 bg-purple-50 p-4">' +
          '<div class="flex items-center justify-between gap-2 flex-wrap">' +
          '<h4 class="font-bold text-purple-800 flex items-center gap-2"><i class="fas fa-robot"></i>AI Marks Awarded</h4>' +
          '<span class="px-3 py-1 rounded-lg bg-purple-600 text-white text-sm font-extrabold">' + revealed.score + ' / ' + maxMarks + '</span></div>' +
          '<div class="mt-3"><div class="text-[11px] uppercase tracking-wider font-bold text-purple-700 mb-1">Your submitted answer</div>' + submitted + '</div>' +
          '<div class="mt-3"><div class="text-[11px] uppercase tracking-wider font-bold text-purple-700 mb-1">Model answer &amp; AI feedback</div>' +
          '<div class="explanation-box text-sm">' + app.esc(revealed.explanation || '').replace(/\n/g, '<br>') + '</div></div>' +
          '<button onclick="app.openFullScreenExplanation(this)" class="fullscreen-explain-btn blink-btn"><i class="fas fa-expand"></i> View in full screen</button>' +
          '</div>';
      }

      var textVal = answer && !String(answer).startsWith('data:image') ? answer : (d._theoryDrafts && d._theoryDrafts[q.id] ? d._theoryDrafts[q.id] : '');
      var imageVal = answer && String(answer).startsWith('data:image') ? answer : '';

      return '<div class="mt-4 rounded-xl border border-gray-200 overflow-hidden">' +
        '<div class="flex border-b border-gray-200 bg-gray-50">' +
        '<button type="button" id="theory-tab-' + q.id + '-text" class="theory-tab-btn flex-1 px-4 py-2.5 text-sm font-bold ' + (imageVal ? '' : 'theory-tab-active') + '" onclick="app.toggleTheoryTab(' + q.id + ',\'text\')"><i class="fas fa-keyboard mr-1.5"></i>Type Answer</button>' +
        '<button type="button" id="theory-tab-' + q.id + '-image" class="theory-tab-btn flex-1 px-4 py-2.5 text-sm font-bold ' + (imageVal ? 'theory-tab-active' : '') + '" onclick="app.toggleTheoryTab(' + q.id + ',\'image\')"><i class="fas fa-camera mr-1.5"></i>Upload Photo</button>' +
        '</div>' +
        '<div id="theory-pane-' + q.id + '-text" class="theory-pane p-4 ' + (imageVal ? 'theory-pane-hidden' : '') + '">' +
        '<textarea id="theory-text-input-' + q.id + '" rows="5" placeholder="Write your answer here… LaTeX such as \\( x^2 \\) is supported." class="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" oninput="app.cacheTheoryDraft(' + q.id + ', this.value)">' + app.esc(textVal) + '</textarea>' +
        '<div class="flex flex-wrap items-center justify-between gap-2 mt-3">' +
        '<span class="text-xs text-gray-500"><i class="fas fa-circle-info mr-1"></i>' + (isStudy ? 'AI grades against the model answer.' : 'Save your work — graded on submission.') + '</span>' +
        '<button type="button" id="theory-text-btn-' + q.id + '" onclick="app.submitTheoryText(' + q.id + ')" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg ' + (isStudy ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700') + ' text-white text-sm font-bold">' +
        '<i class="fas ' + (isStudy ? 'fa-robot' : 'fa-save') + '"></i>' + (isStudy ? 'Submit for AI Grading' : 'Save Answer') + '</button>' +
        '</div></div>' +
        '<div id="theory-pane-' + q.id + '-image" class="theory-pane p-4 ' + (imageVal ? '' : 'theory-pane-hidden') + '">' +
        '<input type="file" accept="image/*" capture="environment" id="theory-image-input-' + q.id + '" class="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:text-sm file:font-bold" onchange="app.previewTheoryImage(' + q.id + ', this)">' +
        '<div id="theory-image-preview-container-' + q.id + '" class="mt-3 ' + (imageVal ? '' : 'hidden') + '">' +
        '<img id="theory-image-preview-' + q.id + '" src="' + (imageVal || '') + '" alt="Theory answer preview" class="max-h-64 rounded-lg border border-gray-200">' +
        '</div>' +
        '<div class="flex flex-wrap items-center justify-between gap-2 mt-3">' +
        '<span class="text-xs text-gray-500"><i class="fas fa-camera mr-1"></i>Rear camera on mobile · images are compressed.</span>' +
        '<button type="button" id="theory-image-btn-' + q.id + '" onclick="app.submitTheoryImage(' + q.id + ')" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg ' + (isStudy ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700') + ' text-white text-sm font-bold">' +
        '<i class="fas fa-paper-plane"></i>' + (isStudy ? 'Submit Photo for Grading' : 'Save Answer') + '</button>' +
        '</div></div></div>';
    },

    renderQuestion: function () {
      var container = document.getElementById('app-container');
      if (!container) return;
      var d = this.data;
      var q = d.questions[d.currentQuestionIndex];
      this.updateHeader();
      if (!q) {
        container.innerHTML = '<div class="rounded-2xl bg-white border border-gray-200 p-10 text-center shadow-lg">' +
          '<div class="text-4xl mb-3">📄</div><p class="text-gray-600 font-semibold">No questions in this exam.</p>' +
          '<button onclick="app.showLanding()" class="mt-4 px-4 py-2 rounded-lg bg-green-600 text-white font-bold text-sm">Return Home</button></div>';
        return;
      }
      var subject = this.currentSubject();
      var typeLabel = q.type === 'objective' ? 'MCQ' : (q.type === 'theory' ? 'Theory' : 'Fill in Gap');
      var total = d.questions.length;
      var revealed = d.answerRevealed[q.id];
      var isStudy = d.examMode === 'study';
      var userAnswer = d.userAnswers[q.id];
      var answerHtml = '';

      /* -------- objective -------- */
      if (q.type === 'objective') {
        var opts = q.options || {};
        var keys = ['A', 'B', 'C', 'D'].filter(function (k) { return opts[k] !== undefined && opts[k] !== null && String(opts[k]) !== ''; });
        if (isStudy && !revealed) {
          answerHtml = '<div class="space-y-2.5">' + keys.map(function (k) {
            return '<div class="study-option flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 cursor-pointer transition-colors" onclick="app.handleStudyAnswerClick(' + q.id + ',\'' + k + '\')">' +
              '<span class="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-extrabold shrink-0">' + k + '</span>' +
              '<span class="text-sm font-medium text-gray-700 break-words min-w-0">' + app.esc(opts[k]) + '</span></div>';
          }).join('') + '</div>' +
            '<p class="text-xs text-gray-500 mt-3"><i class="fas fa-hand-pointer mr-1"></i>Click on your answer to reveal correct answer and explanation.</p>';
        } else if (isStudy && revealed) {
          answerHtml = '<div class="space-y-2.5">' + keys.map(function (k) {
            var isCorrectOption = String(q.correct || '').toUpperCase() === k;
            var isWrongSelected = !isCorrectOption && String(userAnswer || '').toUpperCase() === k;
            var cls = isCorrectOption ? 'correct-option-highlight border-green-500' : (isWrongSelected ? 'wrong-answer-selected border-red-400' : 'border-gray-200');
            return '<div class="flex items-start gap-3 p-4 rounded-xl border-2 ' + cls + '">' +
              '<span class="w-7 h-7 rounded-lg ' + (isCorrectOption ? 'bg-green-500 text-white' : (isWrongSelected ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700')) + ' flex items-center justify-center text-xs font-extrabold shrink-0">' + k + '</span>' +
              '<span class="text-sm font-medium text-gray-700 break-words min-w-0 flex-grow">' + app.esc(opts[k]) + '</span>' +
              (isCorrectOption ? '<span class="correct-badge shrink-0">✔ Correct Answer</span>' : '') +
              (isWrongSelected ? '<span class="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold shrink-0">Your choice</span>' : '') +
              '</div>';
          }).join('') + '</div>';
        } else {
          answerHtml = '<div class="space-y-2.5">' + keys.map(function (k) {
            var checked = String(userAnswer || '').toUpperCase() === k ? 'checked' : '';
            return '<div>' +
              '<input type="radio" name="option" id="opt-' + q.id + '-' + k + '" value="' + k + '" class="cbt-radio" ' + checked + ' onchange="app.selectAnswer(' + q.id + ',\'' + k + '\')">' +
              '<label for="opt-' + q.id + '-' + k + '" class="cbt-option-label flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 cursor-pointer transition-colors">' +
              '<span class="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-extrabold shrink-0">' + k + '</span>' +
              '<span class="text-sm font-medium text-gray-700 break-words min-w-0">' + app.esc(opts[k]) + '</span>' +
              '</label></div>';
          }).join('') + '</div>';
        }
      }

      /* -------- fill in gap -------- */
      else if (q.type === 'fill') {
        var fillVal = (!String(userAnswer || '').startsWith('data:image')) ? (userAnswer || '') : '';
        if (isStudy && !revealed) {
          answerHtml = '<div class="space-y-2.5">' +
            '<input type="text" id="fill-answer-' + q.id + '" value="' + app.esc(fillVal) + '" placeholder="Type the missing word or value…" class="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-medium">' +
            '<button type="button" onclick="app.handleStudyAnswerClick(' + q.id + ', null, true)" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold"><i class="fas fa-check"></i> Check Answer</button>' +
            '<p class="text-xs text-gray-500"><i class="fas fa-hand-pointer mr-1"></i>Click on your answer to reveal correct answer and explanation.</p></div>';
        } else if (isStudy && revealed) {
          answerHtml = '<div class="space-y-2.5">' +
            '<div class="text-sm text-gray-500">Your answer: <span class="font-bold text-gray-800">' + app.esc(fillVal || '(blank)') + '</span></div>' +
            (revealed.isCorrect
              ? '<div class="fill-correct-highlight">✓ Correct! ' + app.esc(fillVal) + '</div>'
              : '<div class="rounded-xl border-2 border-red-400 bg-red-50 p-3"><div class="text-sm font-bold text-red-700 mb-1.5">✗ Not quite</div>' +
                '<div class="fill-correct-highlight" onclick="app.openFullScreenExplanation(this)">✓ Click to see correct answer</div>' +
                '<p class="text-sm text-gray-700 mt-2">Correct answer: <span class="font-bold">' + app.esc(q.correct) + '</span></p></div>') +
            '</div>';
        } else {
          answerHtml = '<input type="text" id="fill-answer-' + q.id + '" value="' + app.esc(fillVal) + '" placeholder="Type your answer…" class="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-medium" oninput="app.selectAnswer(' + q.id + ', this.value)">';
        }
      }

      /* -------- theory -------- */
      else {
        answerHtml = this.theoryMarkup(q);
      }

      /* -------- explanation -------- */
      var explanationHtml = '';
      if (isStudy && revealed) {
        explanationHtml = '<div class="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">' +
          '<div class="flex items-center gap-2 font-bold ' + (revealed.isCorrect ? 'text-green-600' : 'text-red-500') + '">' +
          '<i class="fas ' + (revealed.isCorrect ? 'fa-circle-check' : 'fa-circle-xmark') + '"></i>' +
          '<span>' + (revealed.isCorrect ? '✓ Correct!' : '✗ Incorrect') + '</span>' +
          (revealed.score !== undefined ? '<span class="ml-auto text-xs px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">Score: ' + revealed.score + '</span>' : '') + '</div>' +
          (q.explanation ? '<div class="mt-3"><div class="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">📚 Explanation</div>' +
            '<div class="explanation-box">' + app.esc(q.explanation).replace(/\n/g, '<br>') +
            '<button onclick="app.openFullScreenExplanation(this)" class="fullscreen-explain-btn blink-btn"><i class="fas fa-expand"></i> View in full screen</button></div></div>' : '') +
          ((!revealed.isCorrect && q.type === 'objective') ?
            '<div class="mt-3 rounded-lg border-l-4 border-green-500 bg-green-50 p-3 text-sm text-green-800">' +
            '<i class="fas fa-circle-check mr-1.5"></i>Correct answer: <span class="font-bold">' + app.esc(q.correct) + ': ' + app.esc((q.options || {})[q.correct] || '') + '</span></div>' : '') +
          '</div>';
      }

      /* -------- material buttons -------- */
      var materials = '';
      var refImages = (d.images && d.images[d.currentSubjectId]) ? d.images[d.currentSubjectId] : [];
      if (refImages.length) {
        materials += '<button onclick="app.showImageModal()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200"><i class="fas fa-images"></i> View Reference Images</button>';
      }
      if (subject && subject.notes && subject.notes[q.topicId] && String(subject.notes[q.topicId]).trim() !== '') {
        materials += '<button onclick="app.viewTopicNote(\'' + d.currentSubjectId + '\',\'' + q.topicId + '\',\'' + app.esc(q.topicId).replace(/'/g, "\\'") + '\')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200"><i class="fas fa-file-lines"></i> View Topic Notes</button>';
      }
      var tImgs = (subject && subject.topicImages && subject.topicImages[q.topicId]) ? subject.topicImages[q.topicId] : [];
      if (tImgs.length) {
        materials += '<button onclick="app.viewTopicImages(\'' + d.currentSubjectId + '\',\'' + q.topicId + '\')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200"><i class="fas fa-image"></i> View Topic Images (' + tImgs.length + ')</button>';
      }

      var navHTML = this.navigatorHTML();
      var isLast = d.currentQuestionIndex === total - 1;
      var progress = Math.round(((d.currentQuestionIndex + 1) / total) * 100);

      container.innerHTML = '<div class="grid md:grid-cols-[minmax(0,1fr)_72px] gap-4 items-start">' +
        '<div class="min-w-0">' +
        '<div class="rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">' +
        '<div class="p-5 md:p-6 border-b border-gray-200">' +
        '<div class="flex flex-wrap items-center gap-2 justify-between">' +
        '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="text-sm font-bold text-gray-500">Question <span class="text-gray-800">' + (d.currentQuestionIndex + 1) + '</span> of ' + total + '</span>' +
        '<span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-extrabold uppercase tracking-wider">' + typeLabel + '</span>' +
        '<span class="px-2 py-0.5 rounded-md ' + (isStudy ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700') + ' text-[10px] font-extrabold uppercase tracking-wider">' + (isStudy ? 'Study' : 'Practice') + '</span>' +
        (q.subTopic ? '<span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">' + app.esc(q.subTopic) + '</span>' : '') +
        '</div>' +
        '<button onclick="app.submitTestConfirm(this)" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><i class="fas fa-paper-plane mr-1"></i>Finish</button>' +
        '</div>' +
        '<div class="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full bg-green-500 transition-all" style="width:' + progress + '%"></div></div>' +
        '</div>' +
        '<div class="p-5 md:p-7">' +
        '<p class="text-base md:text-lg font-medium text-gray-800 whitespace-pre-wrap break-words leading-relaxed">' + app.esc(q.text) + '</p>' +
        (materials ? '<div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">' + materials + '</div>' : '') +
        '<div class="mt-5">' + answerHtml + '</div>' +
        explanationHtml +
        '</div>' +
        '<div class="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50">' +
        '<button onclick="app.prevQuestion()" ' + (d.currentQuestionIndex === 0 ? 'disabled' : '') + ' class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"><i class="fas fa-arrow-left"></i> Previous</button>' +
        (isLast
          ? '<button id="submit-test-btn" onclick="app.submitTestConfirm(this)" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow"><i class="fas fa-paper-plane"></i> Submit Test</button>'
          : '<button onclick="app.nextQuestion()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow">Next <i class="fas fa-arrow-right"></i></button>') +
        '</div></div></div>' +

        '<aside class="hidden md:block sticky top-2">' +
        '<div class="w-16 rounded-2xl bg-white border border-gray-200 shadow-lg p-2">' +
        '<div class="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 text-center mb-2">Q</div>' +
        '<div class="grid grid-cols-1 gap-1.5">' + navHTML + '</div>' +
        '</div>' +
        '<button onclick="app.submitTestConfirm(this)" class="mt-2 w-16 rounded-xl bg-red-50 border border-red-200 text-red-600 p-2 text-[10px] font-bold hover:bg-red-100 leading-tight"><i class="fas fa-paper-plane block mb-0.5"></i>Submit</button>' +
        '</aside>' +
        '</div>';

      this.triggerMathJax();
    },

    /* ---------------- answer handling ---------------- */
    cacheTheoryDraft: function (qId, value) {
      if (!this.data._theoryDrafts) this.data._theoryDrafts = {};
      this.data._theoryDrafts[qId] = value;
    },

    checkAnswer: function (qId, value) {
      var q = this.data.questions.find(function (x) { return x.id === qId; });
      if (!q) return false;
      var userVal = value === null || value === undefined ? '' : String(value);
      if (q.type === 'objective') {
        return userVal.toUpperCase() === String(q.correct || '').toUpperCase();
      }
      return userVal.trim().toLowerCase() === String(q.correct || '').trim().toLowerCase();
    },

    selectAnswer: function (qId, value) {
      this.data.userAnswers[qId] = value;
      this.saveExamState();
      this.updateNavigatorColors();
    },

    updateNavigatorColors: function () {
      var d = this.data;
      /* paint the desktop navigator without re-rendering the question card */
      var desktopBtns = document.querySelectorAll('aside .grid button');
      if (desktopBtns.length === d.questions.length) {
        d.questions.forEach(function (q, i) {
          if (i === d.currentQuestionIndex) return;
          var b = desktopBtns[i];
          if (!b) return;
          var answered = isAnswered(app, q);
          b.className = 'h-8 w-8 rounded-lg border text-[11px] font-bold transition-colors ' +
            (answered ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200');
        });
      }
      /* refresh mobile modal if open */
      var modal = document.getElementById('mobile-grid-modal');
      if (modal && !modal.classList.contains('hidden')) {
        var container = document.getElementById('mobile-grid-container');
        if (container) {
          var html = '';
          for (var i = 0; i < d.questions.length; i++) {
            var q = d.questions[i];
            var ans = isAnswered(app, q);
            var active = i === d.currentQuestionIndex;
            var cls = active ? 'bg-blue-600 text-white border-blue-700' : (ans ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300');
            html += '<button onclick="app.jumpToQuestion(' + i + '); document.getElementById(\'mobile-grid-modal\').classList.add(\'hidden\')" class="h-10 rounded-lg border font-bold text-sm ' + cls + '">' + (i + 1) + '</button>';
          }
          container.innerHTML = html;
        }
      }
    },

    handleStudyAnswerClick: function (qId, selectedValue, isFill) {
      var q = this.data.questions.find(function (x) { return x.id === qId; });
      if (!q) return;
      if (isFill) {
        var input = document.getElementById('fill-answer-' + qId);
        selectedValue = input ? input.value : '';
      }
      this.data.userAnswers[qId] = selectedValue;
      var isCorrect = this.checkAnswer(qId, selectedValue);
      this.data.answerRevealed[qId] = {
        isCorrect: isCorrect,
        score: isCorrect ? 100 : 0,
        explanation: q.explanation
      };
      this.saveExamState();
      this.renderQuestion();
    },

    previewTheoryImage: function (qId, input) {
      var file = input.files && input.files[0];
      if (!file) return;
      var preview = document.getElementById('theory-image-preview-' + qId);
      var container = document.getElementById('theory-image-preview-container-' + qId);
      var reader = new FileReader();
      reader.onload = function (e) {
        if (preview) preview.src = e.target.result;
        if (container) container.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    },

    toggleTheoryTab: function (qId, tab) {
      ['text', 'image'].forEach(function (t) {
        var btn = document.getElementById('theory-tab-' + qId + '-' + t);
        var pane = document.getElementById('theory-pane-' + qId + '-' + t);
        if (!btn || !pane) return;
        if (t === tab) {
          btn.classList.add('theory-tab-active');
          pane.classList.remove('theory-pane-hidden');
        } else {
          btn.classList.remove('theory-tab-active');
          pane.classList.add('theory-pane-hidden');
        }
      });
    },

    nextQuestion: function () {
      if (this.data.currentQuestionIndex < this.data.questions.length - 1) {
        this.data.currentQuestionIndex++;
        this.saveExamState();
        this.renderQuestion();
      }
    },

    prevQuestion: function () {
      if (this.data.currentQuestionIndex > 0) {
        this.data.currentQuestionIndex--;
        this.saveExamState();
        this.renderQuestion();
      }
    },

    jumpToQuestion: function (i) {
      if (i < 0 || i >= this.data.questions.length) return;
      this.data.currentQuestionIndex = i;
      this.saveExamState();
      this.renderQuestion();
    },

    submitTestConfirm: function (btn) {
      var answered = 0;
      var self = this;
      this.data.questions.forEach(function (q) { if (isAnswered(self, q)) answered++; });
      var ok = window.confirm('Submit your exam now?\n\nAnswered ' + answered + ' of ' + this.data.questions.length + ' questions.\n\nYou cannot change your answers after submitting.');
      if (!ok) return;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Submitting…';
      }
      this.submitTest();
    }
  };

  Object.keys(examMethods).forEach(function (key) {
    window.app[key] = examMethods[key];
  });
})();
