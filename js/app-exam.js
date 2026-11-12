/* ==========================================================================
   app-exam.js — timer, test UI, renderQuestion, answer handling
   ========================================================================== */
Object.assign(window.app, {

  /* ------------------------------------------------------------------ *
   *  TIMER
   * ------------------------------------------------------------------ */
  startTimer: function () {
    if (this.data.timer) clearInterval(this.data.timer);
    if (!this.data.endTime) this.data.endTime = Date.now() + this.data.timeLeft * 1000;
    this.data.timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((this.data.endTime - Date.now()) / 1000));
      if (remaining === this.data.timeLeft) return;        // skip no-op
      this.data.timeLeft = remaining;
      this.updateTimerDisplay();
      this.saveExamState();
      if (remaining <= 0) {
        clearInterval(this.data.timer);
        this.data.timer = null;
        this.submitTest();
      }
    }, 250);
  },

  stopTimer: function () {
    if (this.data.timer) clearInterval(this.data.timer);
    this.data.timer = null;
    this.data.endTime = null;   // a fresh startTimer() recalculates from timeLeft
  },

  updateTimerDisplay: function () {
    const el = document.getElementById('timer-display');
    if (!el) return;
    const t = Math.max(0, this.data.timeLeft);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    el.textContent = mm + ':' + ss;
    el.classList.toggle('text-red-500', t < 60);
    el.classList.toggle('animate-pulse', t < 60);
  },

  /* ------------------------------------------------------------------ *
   *  TEST INTERFACE
   * ------------------------------------------------------------------ */
  showTestInterface: function () {
    this._setMode('test');
    this._lastRenderedIdx = -1;
    document.getElementById('app-container').innerHTML = `
      <div class="flex h-full gap-3 p-2 md:p-4">
        <div class="flex-grow flex flex-col min-h-0 min-w-0">
          <div id="question-card" class="bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col flex-grow min-h-0 overflow-hidden"></div>
        </div>
        <aside class="hidden md:flex flex-col w-64 shrink-0 bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-h-0">
          <h3 class="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide"><i class="fas fa-th mr-2"></i>Questions</h3>
          <div id="navigator-grid" class="grid grid-cols-5 gap-2 overflow-y-auto content-start"></div>
          <div class="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 space-y-1">
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded bg-blue-600 inline-block"></span>Current</div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded bg-green-100 border border-green-500 inline-block"></span>Answered</div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded bg-gray-200 inline-block"></span>Unanswered</div>
          </div>
        </aside>
      </div>`;
    this.renderQuestion();
    this.updateTimerDisplay();
    this.saveExamState();
  },

  _isAnswered: function (q) {
    const a = this.data.userAnswers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== '';
  },

  _navHtml: function (mobile) {
    const d = this.data;
    return d.questions.map((q, i) => {
      let cls = 'bg-gray-200 text-gray-700';
      if (i === d.currentQuestionIndex) cls = 'bg-blue-600 text-white';
      else if (this._isAnswered(q)) cls = 'bg-green-100 text-green-800';
      const click = mobile
        ? `app.jumpToQuestion(${i}); document.getElementById('mobile-grid-modal').classList.add('hidden');`
        : `app.jumpToQuestion(${i})`;
      return `<button type="button" onclick="${click}" class="h-10 rounded-lg font-semibold text-sm ${cls}">${i + 1}</button>`;
    }).join('');
  },

  renderNavigator: function () {
    const grid = document.getElementById('navigator-grid');
    if (grid) grid.innerHTML = this._navHtml(false);
    const modal = document.getElementById('mobile-grid-modal');
    const mg = document.getElementById('mobile-grid-container');
    if (modal && mg && !modal.classList.contains('hidden')) mg.innerHTML = this._navHtml(true);
  },

  toggleMobileGrid: function () {
    const modal = document.getElementById('mobile-grid-modal');
    const mg = document.getElementById('mobile-grid-container');
    if (!modal || !mg) return;
    if (!modal.classList.contains('hidden')) { modal.classList.add('hidden'); return; }
    mg.innerHTML = this._navHtml(true);
    modal.classList.remove('hidden');
  },

  _materialButtons: function (q) {
    const d = this.data;
    const s = this.getSubject();
    const sid = this.esc(d.currentSubjectId || '');
    const tid = this.esc(q.topicId || '');
    const out = [];
    const imgs = d.images[d.currentSubjectId];
    if (imgs && imgs.length) {
      out.push(`<button type="button" onclick="app.showImageModal()" class="bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-images mr-2"></i>View Reference Images</button>`);
    }
    if (s && this._hasNotes(s, q.topicId)) {
      out.push(`<button type="button" onclick="app.viewTopicNote('${sid}','${tid}')" class="bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-file-alt mr-2"></i>View Topic Notes</button>`);
    }
    if (s && this._hasTopicImages(s, q.topicId)) {
      out.push(`<button type="button" onclick="app.viewTopicImages('${sid}','${tid}')" class="bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-image mr-2"></i>View Topic Images (${s.topicImages[q.topicId].length})</button>`);
    }
    return out.length ? `<div class="flex flex-wrap gap-2 mt-4">${out.join('')}</div>` : '';
  },

  renderQuestion: function () {
    const d = this.data;
    const card = document.getElementById('question-card');
    if (!card) return;
    const q = d.questions[d.currentQuestionIndex];
    if (!q) return;
    const idx = d.currentQuestionIndex;
    const total = d.questions.length;
    const isLast = idx === total - 1;

    // keep scroll position when re-rendering the same question (e.g. after reveal)
    const oldBody = document.getElementById('question-body');
    const keepScroll = (this._lastRenderedIdx === idx && oldBody) ? oldBody.scrollTop : 0;
    this._lastRenderedIdx = idx;

    const typeLabel = { objective: 'MCQ', theory: 'Theory', fill: 'Fill in Gap' }[q.type] || q.type;
    const modeBadge = d.examMode === 'study'
      ? '<span class="px-2 py-1 rounded-md text-xs font-bold bg-green-100 text-green-800">Study</span>'
      : '<span class="px-2 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800">Practice</span>';

    let answerHtml = '';
    if (q.type === 'objective') answerHtml = this._renderObjective(q);
    else if (q.type === 'fill') answerHtml = this._renderFill(q);
    else answerHtml = this._renderTheory(q);

    card.innerHTML = `
      <div class="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2 flex-wrap shrink-0">
        <h2 class="font-bold text-gray-800">Question ${idx + 1} of ${total}</h2>
        <span class="px-2 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-700">${typeLabel}</span>
        ${modeBadge}
      </div>
      <div id="question-body" class="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
        <div class="text-base md:text-lg text-gray-800 whitespace-pre-wrap break-words leading-relaxed">${this.esc(q.text)}</div>
        ${this._materialButtons(q)}
        <div class="mt-5">${answerHtml}</div>
        ${this._renderExplanation(q)}
      </div>
      <div class="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
        <button type="button" onclick="app.prevQuestion()" ${idx === 0 ? 'disabled' : ''} class="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"><i class="fas fa-chevron-left mr-2"></i>Previous</button>
        ${isLast
          ? `<button type="button" onclick="app.submitTestConfirm()" class="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold"><i class="fas fa-paper-plane mr-2"></i>Submit</button>`
          : `<button type="button" onclick="app.nextQuestion()" class="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">Next<i class="fas fa-chevron-right ml-2"></i></button>`}
      </div>`;

    if (keepScroll) {
      const nb = document.getElementById('question-body');
      if (nb) nb.scrollTop = keepScroll;
    }
    this.renderNavigator();
    this.triggerMathJax();
  },

  /* ---------- OBJECTIVE ---------- */
  _optionLetters: function (q) {
    return Object.keys(q.options || {})
      .filter((k) => q.options[k] != null && String(q.options[k]).trim() !== '')
      .sort();
  },

  _renderObjective: function (q) {
    const d = this.data;
    const study = d.examMode === 'study';
    const revealed = d.answerRevealed[q.id];
    const sel = String(d.userAnswers[q.id] || '').toUpperCase();
    const correct = String(q.correct || '').toUpperCase();
    const letters = this._optionLetters(q);

    if (!study) {
      return `<div class="flex flex-col gap-3">${letters.map((L) => `
        <input type="radio" name="option" id="opt-${L}" value="${L}" class="cbt-radio hidden" ${sel === L ? 'checked' : ''} onchange="app.selectAnswer(${q.id},'${L}')">
        <label for="opt-${L}" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
          <div class="flex items-start gap-3">
            <span class="font-bold text-gray-700 w-7 h-7 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-sm">${L}</span>
            <span class="min-w-0 break-words text-gray-800 pt-0.5">${this.esc(q.options[L])}</span>
          </div>
        </label>`).join('')}</div>`;
    }

    if (!revealed) {
      return `
        <div class="text-sm text-gray-500 mb-3"><i class="fas fa-hand-pointer mr-2"></i>Click on your answer to reveal correct answer and explanation</div>
        <div class="flex flex-col gap-3">${letters.map((L) => `
          <div class="study-option block p-4 border-2 border-gray-200 rounded-lg bg-white" onclick="app.handleStudyAnswerClick(${q.id},'${L}')">
            <div class="flex items-start gap-3">
              <span class="font-bold text-gray-700 w-7 h-7 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-sm">${L}</span>
              <span class="min-w-0 break-words text-gray-800 pt-0.5">${this.esc(q.options[L])}</span>
            </div>
          </div>`).join('')}</div>`;
    }

    return `<div class="flex flex-col gap-3">${letters.map((L) => {
      const isCorrect = L === correct;
      const isSel = L === sel;
      let cls = 'border-gray-200 bg-white';
      if (isCorrect) cls = 'correct-option-highlight';
      else if (isSel) cls = 'wrong-answer-selected';
      return `
        <div class="study-option block p-4 border-2 rounded-lg ${cls}" style="cursor:default">
          <div class="flex items-start gap-3">
            <span class="font-bold text-gray-700 w-7 h-7 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-sm">${L}</span>
            <span class="min-w-0 break-words text-gray-800 pt-0.5">${this.esc(q.options[L])}${isCorrect ? '<span class="correct-badge">✔ Correct Answer</span>' : ''}</span>
          </div>
        </div>`;
    }).join('')}</div>`;
  },

  /* ---------- FILL ---------- */
  _renderFill: function (q) {
    const d = this.data;
    const study = d.examMode === 'study';
    const revealed = d.answerRevealed[q.id];
    const val = d.userAnswers[q.id] || '';
    const inputCls = 'w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg';

    if (!study) {
      return `<input type="text" id="fill-answer-${q.id}" autocomplete="off" placeholder="Type your answer here" value="${this.esc(val)}" oninput="app.selectAnswer(${q.id}, this.value)" class="${inputCls}">`;
    }
    if (!revealed) {
      return `
        <input type="text" id="fill-answer-${q.id}" autocomplete="off" placeholder="Type your answer here" value="${this.esc(val)}" onkeydown="if(event.key==='Enter'){app.handleStudyAnswerClick(${q.id}, null, true)}" class="${inputCls}">
        <button type="button" onclick="app.handleStudyAnswerClick(${q.id}, null, true)" class="mt-3 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold"><i class="fas fa-check mr-2"></i>Check Answer</button>`;
    }
    if (revealed.isCorrect) {
      return `
        <input type="text" id="fill-answer-${q.id}" value="${this.esc(val)}" disabled class="${inputCls}">
        <div class="mt-3 p-4 rounded-lg border-2 border-green-500 bg-green-50 text-green-700 font-semibold break-words"><i class="fas fa-check-circle mr-2"></i>Your answer: ${this.esc(val)}</div>`;
    }
    return `
      <input type="text" id="fill-answer-${q.id}" value="${this.esc(val)}" disabled class="${inputCls}">
      <div class="mt-3 p-4 rounded-lg border-2 border-red-500 bg-red-50 text-red-600 font-semibold break-words"><i class="fas fa-times-circle mr-2"></i>Your answer: ${this.esc(val) || '<em>(blank)</em>'}</div>
      <div class="mt-3">
        <span class="fill-correct-highlight" onclick="this.nextElementSibling.classList.toggle('hidden')">✓ Click to see correct answer</span>
        <div class="hidden mt-2 p-3 rounded-lg bg-green-50 border border-green-500 text-green-700 font-bold break-words">Correct answer: ${this.esc(q.correct)}</div>
      </div>`;
  },

  /* ---------- THEORY ---------- */
  _renderTheory: function (q) {
    const d = this.data;
    const study = d.examMode === 'study';
    const revealed = d.answerRevealed[q.id];
    const ans = d.userAnswers[q.id];
    const isImg = String(ans || '').startsWith('data:image');
    const maxMarks = q.maxMarks || 10;

    if (study && revealed) {
      const submitted = isImg
        ? `<img src="${ans}" alt="Your submitted answer" class="max-h-56 rounded-lg border border-gray-200 object-contain">`
        : `<div class="whitespace-pre-wrap break-words text-gray-800">${this.esc(ans || '')}</div>`;
      return `
        <div class="rounded-xl border-2 ${revealed.isCorrect ? 'border-green-500' : 'border-red-500'} bg-gray-50 p-4 space-y-4">
          <div class="text-xl font-extrabold ${revealed.isCorrect ? 'text-green-700' : 'text-red-600'}"><i class="fas fa-award mr-2"></i>Marks Awarded: ${this.esc(revealed.score)} / ${maxMarks}</div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Your submitted answer</div>
            <div class="bg-white border border-gray-200 rounded-lg p-3">${submitted}</div>
          </div>
          <div class="explanation-box">
            <div class="bg-white p-4 rounded-lg border-l-4 border-blue-500">
              <div class="font-bold text-gray-800 mb-1">📚 Model Answer &amp; AI Feedback:</div>
              <div class="whitespace-pre-wrap break-words text-gray-800">${this.esc(revealed.explanation)}</div>
            </div>
          </div>
        </div>`;
    }

    const startImage = isImg;
    const draft = this._theoryDrafts[q.id];
    const textVal = isImg ? '' : (draft !== undefined ? draft : (ans || ''));
    const btnLabelText = study ? '<i class="fas fa-robot mr-2"></i>Submit for AI Grading' : '<i class="fas fa-save mr-2"></i>Save Answer';
    const saved = ans ? `<div class="mt-2 text-sm text-green-700 font-semibold"><i class="fas fa-check-circle mr-1"></i>${isImg ? 'Photo answer saved' : 'Answer saved'}</div>` : '';
    const tabOn = 'bg-blue-600 text-white';
    const tabOff = 'bg-gray-100 text-gray-700';

    return `
      <div class="flex gap-2 mb-4">
        <button type="button" id="theory-tab-text-btn-${q.id}" onclick="app.toggleTheoryTab(${q.id},'text')" class="px-4 py-2 rounded-lg font-semibold text-sm ${startImage ? tabOff : tabOn}"><i class="fas fa-keyboard mr-2"></i>Type Answer</button>
        <button type="button" id="theory-tab-image-btn-${q.id}" onclick="app.toggleTheoryTab(${q.id},'image')" class="px-4 py-2 rounded-lg font-semibold text-sm ${startImage ? tabOn : tabOff}"><i class="fas fa-camera mr-2"></i>Upload Photo</button>
      </div>

      <div id="theory-panel-text-${q.id}" class="${startImage ? 'hidden' : ''}">
        <textarea id="theory-text-input-${q.id}" rows="8" placeholder="Write your answer here…" oninput="app._theoryDrafts[${q.id}] = this.value" class="w-full border-2 border-gray-300 rounded-lg px-4 py-3">${this.esc(textVal)}</textarea>
        <button type="button" id="theory-text-btn-${q.id}" onclick="app.submitTheoryText(${q.id})" class="mt-3 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold">${btnLabelText}</button>
        ${!isImg ? saved : ''}
      </div>

      <div id="theory-panel-image-${q.id}" class="${startImage ? '' : 'hidden'}">
        <input type="file" accept="image/*" capture="environment" id="theory-image-input-${q.id}" onchange="app.previewTheoryImage(${q.id}, this)" class="block w-full text-sm text-gray-600 border-2 border-dashed border-gray-300 rounded-lg p-3">
        <div id="theory-image-preview-container-${q.id}" class="${isImg ? '' : 'hidden'} mt-3">
          <img id="theory-image-preview-${q.id}" ${isImg ? `src="${ans}"` : ''} alt="Preview of your answer" class="max-h-64 rounded-lg border border-gray-200 object-contain">
        </div>
        <button type="button" id="theory-image-btn-${q.id}" onclick="app.submitTheoryImage(${q.id})" class="mt-3 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold">${btnLabelText}</button>
        ${isImg ? saved : ''}
      </div>`;
  },

  toggleTheoryTab: function (qId, which) {
    const panelT = document.getElementById('theory-panel-text-' + qId);
    const panelI = document.getElementById('theory-panel-image-' + qId);
    const btnT = document.getElementById('theory-tab-text-btn-' + qId);
    const btnI = document.getElementById('theory-tab-image-btn-' + qId);
    const setBtn = (btn, on) => {
      if (!btn) return;
      btn.classList.toggle('bg-blue-600', on);
      btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-gray-100', !on);
      btn.classList.toggle('text-gray-700', !on);
    };
    if (panelT) panelT.classList.toggle('hidden', which !== 'text');
    if (panelI) panelI.classList.toggle('hidden', which !== 'image');
    setBtn(btnT, which === 'text');
    setBtn(btnI, which === 'image');
  },

  previewTheoryImage: function (qId, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById('theory-image-preview-' + qId);
      const box = document.getElementById('theory-image-preview-container-' + qId);
      if (img) img.src = e.target.result;
      if (box) box.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  },

  /* ---------- EXPLANATION (study only, objective + fill) ---------- */
  _renderExplanation: function (q) {
    const d = this.data;
    const r = d.answerRevealed[q.id];
    if (d.examMode !== 'study' || !r || q.type === 'theory') return '';
    let wrongBox = '';
    if (!r.isCorrect && q.type === 'objective') {
      const L = String(q.correct || '').toUpperCase();
      wrongBox = `<div class="bg-green-50 border border-green-500 rounded-lg p-3 text-green-700 font-semibold break-words">Correct answer: ${this.esc(L)}: ${this.esc((q.options || {})[L] || '')}</div>`;
    }
    return `
      <div class="mt-6 space-y-3">
        <div class="font-extrabold text-lg ${r.isCorrect ? 'text-green-700' : 'text-red-600'}">${r.isCorrect ? '✓ Correct!' : '✗ Incorrect'}</div>
        <div class="explanation-box">
          <div class="bg-white p-4 rounded-lg border-l-4 border-blue-500">
            <div class="font-bold text-gray-800 mb-1">📚 Explanation:</div>
            <div class="whitespace-pre-wrap break-words text-gray-800">${this.esc(r.explanation || 'No explanation provided.')}</div>
          </div>
        </div>
        ${wrongBox}
      </div>`;
  },

  /* ------------------------------------------------------------------ *
   *  ANSWER HANDLING
   * ------------------------------------------------------------------ */
  checkAnswer: function (qId, value) {
    const q = this.data.questions.find((x) => x.id === qId || String(x.id) === String(qId));
    if (!q) return false;
    if (q.type === 'objective') {
      return String(value == null ? '' : value).toUpperCase() === String(q.correct || '').toUpperCase();
    }
    if (q.type === 'fill') {
      return String(value == null ? '' : value).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase();
    }
    return false;
  },

  selectAnswer: function (qId, value) {
    this.data.userAnswers[qId] = value;
    this.saveExamState();
    this.renderNavigator();
  },

  handleStudyAnswerClick: function (qId, selectedValue, isFill) {
    const d = this.data;
    if (d.answerRevealed[qId]) return;
    const q = d.questions.find((x) => x.id === qId || String(x.id) === String(qId));
    if (!q) return;
    if (isFill) {
      const el = document.getElementById('fill-answer-' + qId);
      selectedValue = el ? el.value : '';
    }
    d.userAnswers[qId] = selectedValue;
    const isCorrect = this.checkAnswer(qId, selectedValue);
    d.answerRevealed[qId] = { isCorrect: isCorrect, score: isCorrect ? 100 : 0, explanation: q.explanation };
    this.saveExamState();
    this.renderQuestion();
  },

  nextQuestion: function () {
    const d = this.data;
    if (d.currentQuestionIndex < d.questions.length - 1) d.currentQuestionIndex++;
    this.saveExamState();
    this.renderQuestion();
  },

  prevQuestion: function () {
    const d = this.data;
    if (d.currentQuestionIndex > 0) d.currentQuestionIndex--;
    this.saveExamState();
    this.renderQuestion();
  },

  jumpToQuestion: function (i) {
    const d = this.data;
    if (i < 0 || i >= d.questions.length) return;
    d.currentQuestionIndex = i;
    this.saveExamState();
    this.renderQuestion();
  },

  /* ------------------------------------------------------------------ *
   *  SUBMIT CONFIRMATION
   * ------------------------------------------------------------------ */
  submitTestConfirm: function () {
    const d = this.data;
    const old = document.getElementById('submit-confirm-overlay');
    if (old) old.remove();
    const total = d.questions.length;
    const answered = d.questions.filter((q) => this._isAnswered(q)).length;
    const unanswered = total - answered;
    const overlay = document.createElement('div');
    overlay.id = 'submit-confirm-overlay';
    overlay.className = 'cbt-modal';
    overlay.style.zIndex = '90';
    overlay.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
        <div class="w-16 h-16 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-3"><i class="fas fa-question text-3xl text-yellow-600"></i></div>
        <h3 class="text-xl font-bold text-gray-800 mb-1">Submit your exam?</h3>
        <p class="text-gray-600 mb-1">You have answered <strong>${answered}</strong> of <strong>${total}</strong> questions.</p>
        ${unanswered > 0 ? `<p class="text-red-600 font-semibold mb-1">${unanswered} question${unanswered === 1 ? ' is' : 's are'} still unanswered.</p>` : ''}
        <p class="text-sm text-gray-500 mb-5">You cannot change your answers after submitting.</p>
        <div class="flex gap-3">
          <button type="button" id="submit-cancel-btn" class="flex-1 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold">Keep Working</button>
          <button type="button" id="submit-confirm-btn" class="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold">Submit Now</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cancel = overlay.querySelector('#submit-cancel-btn');
    const confirmBtn = overlay.querySelector('#submit-confirm-btn');
    cancel.addEventListener('click', () => overlay.remove());
    confirmBtn.addEventListener('click', () => {
      confirmBtn.disabled = true;
      cancel.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting…';
      Promise.resolve(this.submitTest()).finally(() => overlay.remove());
    });
  }
});
