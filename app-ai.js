/* ==========================================================================
   app-ai.js — AI theory grading (text + image) and exam submission
   ========================================================================== */
Object.assign(window.app, {

  /* ---------- helpers ---------- */
  _callAiBrain: async function (payload) {
    const res = await fetch('/api/ai-brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw new Error((data && data.error) || ('AI grading failed (HTTP ' + res.status + ')'));
    if (!data) throw new Error('The AI service returned an empty response.');
    return data;
  },

  _buildGrade: function (q, data, referenceAnswer, isImage) {
    const maxMarks = q.maxMarks || 10;
    let score = Number(data.score);
    if (!isFinite(score)) score = 0;
    score = Math.max(0, Math.min(maxMarks, score));
    let explanation = 'Model Answer:\n\n"' + referenceAnswer + '"\n\nAI Feedback: ' + (data.reason || 'No feedback provided.');
    if (isImage) explanation += '\n\nAI Transcription: "' + (data.transcription || 'N/A') + '"';
    return { isCorrect: score >= maxMarks * 0.4, score: score, explanation: explanation };
  },

  _showGradingOverlay: function (done, total) {
    let el = document.getElementById('grading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'grading-overlay';
      el.className = 'cbt-modal';
      el.style.zIndex = '95';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <i class="fas fa-robot text-5xl text-green-600 mb-4 animate-pulse"></i>
        <h3 class="text-xl font-bold text-gray-800 mb-1">Grading theory answers…</h3>
        <p class="text-gray-600">${done} of ${total} graded by the AI examiner</p>
        <div class="w-full h-2 bg-gray-200 rounded-full mt-4 overflow-hidden"><div class="h-2 bg-green-600" style="width:${total ? Math.round(done / total * 100) : 0}%"></div></div>
      </div>`;
  },

  _hideGradingOverlay: function () {
    const el = document.getElementById('grading-overlay');
    if (el) el.remove();
  },

  _readAsDataURL: function (file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read the image.'));
      r.readAsDataURL(file);
    });
  },

  /* ------------------------------------------------------------------ *
   *  SUBMIT TEST
   * ------------------------------------------------------------------ */
  submitTest: async function () {
    if (this._submitting) return;
    this._submitting = true;
    const d = this.data;
    try {
      this.stopTimer();
      this.clearExamState();

      // 1. grade any theory answers that have not been graded yet
      const pending = d.questions.filter((q) =>
        q.type === 'theory' &&
        !d.answerRevealed[q.id] &&
        (d.userAnswers[q.id] || d.userAnswers[String(q.id)]));

      if (pending.length) this._showGradingOverlay(0, pending.length);
      let done = 0;
      for (const q of pending) {
        const userAns = d.userAnswers[q.id] || d.userAnswers[String(q.id)];
        const maxMarks = q.maxMarks || 10;
        const referenceAnswer = q.explanation || q.correct || 'General knowledge';
        const isImage = String(userAns).startsWith('data:image');
        const payload = isImage
          ? { imageBase64: userAns, referenceAnswer: referenceAnswer, maxMarks: maxMarks, isImage: true }
          : { studentAnswer: userAns, referenceAnswer: referenceAnswer, maxMarks: maxMarks };
        try {
          const data = await this._callAiBrain(payload);
          d.answerRevealed[q.id] = this._buildGrade(q, data, referenceAnswer, isImage);
        } catch (err) {
          d.answerRevealed[q.id] = {
            isCorrect: false,
            score: 0,
            explanation: 'Could not grade this answer automatically. Error: ' + err.message
          };
        }
        done++;
        this._showGradingOverlay(done, pending.length);
      }

      // 2. tally the score (theory = ONE full point each, regardless of maxMarks)
      let score = 0;
      const details = d.questions.map((q) => {
        const userAns = d.userAnswers[q.id];
        const revealed = d.answerRevealed[q.id];
        const maxMarks = q.maxMarks || 10;
        let isCorrect = false;
        if (q.type === 'theory') {
          isCorrect = !!revealed && revealed.score !== undefined && revealed.score >= maxMarks / 2;
        } else if (q.type === 'objective') {
          isCorrect = !!userAns && String(userAns).toUpperCase() === String(q.correct).toUpperCase();
        } else if (q.type === 'fill') {
          isCorrect = !!userAns && String(userAns).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
        }
        if (isCorrect) score++;
        return {
          question: q.text,
          userAnswer: userAns || 'Not Answered',
          correctAnswer: q.type === 'theory'
            ? 'AI Grade: ' + (revealed && revealed.score !== undefined ? revealed.score : 0) + '/' + maxMarks
            : q.correct,
          isCorrect: isCorrect,
          questionType: q.type,
          options: q.options,
          explanation: (revealed && revealed.explanation) || q.explanation || ''
        };
      });

      const total = d.questions.length;
      const percentage = total ? Math.round(score / total * 100) : 0;
      const subj = this.getSubject();
      const result = {
        name: d.candidateName,
        subjectName: subj ? subj.name : 'Unknown Subject',
        score: score,
        total: total,
        percentage: percentage,
        date: new Date().toISOString(),
        examMode: d.examMode,
        details: details
      };
      d.lastResults = result;
      d.results.push(result);
      this.saveResults();
      this._hideGradingOverlay();
      this.showSimplifiedResult(score, total, percentage);
    } finally {
      this._submitting = false;
      this._hideGradingOverlay();
      const c = document.getElementById('submit-confirm-overlay');
      if (c) c.remove();
    }
  },

  /* ------------------------------------------------------------------ *
   *  THEORY — TEXT
   * ------------------------------------------------------------------ */
  submitTheoryText: async function (qId) {
    const d = this.data;
    const q = d.questions.find((x) => x.id === qId || String(x.id) === String(qId));
    if (!q) return;
    const ta = document.getElementById('theory-text-input-' + qId);
    const text = ta ? ta.value.trim() : '';
    if (!text) { this.toast('Please type your answer first.', 'error'); return; }

    // PRACTICE: store only — grading happens at submission.
    if (d.examMode !== 'study') {
      d.userAnswers[qId] = text;
      this._theoryDrafts[qId] = text;
      this.saveExamState();
      this.renderNavigator();
      this.toast('Answer saved', 'success');
      return;
    }

    // STUDY: grade immediately with the AI.
    const btn = document.getElementById('theory-text-btn-' + qId);
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Grading…'; }
    d.userAnswers[qId] = text;
    const referenceAnswer = q.explanation || q.correct || 'General knowledge';
    try {
      const data = await this._callAiBrain({
        studentAnswer: text,
        referenceAnswer: referenceAnswer,
        maxMarks: q.maxMarks || 10
      });
      d.answerRevealed[qId] = this._buildGrade(q, data, referenceAnswer, false);
      this.saveExamState();
      this.renderQuestion();
    } catch (err) {
      delete d.userAnswers[qId];
      const b = document.getElementById('theory-text-btn-' + qId);
      if (b) { b.disabled = false; b.innerHTML = original; }
      this.toast('AI grading failed: ' + err.message, 'error');
    }
  },

  /* ------------------------------------------------------------------ *
   *  THEORY — IMAGE
   * ------------------------------------------------------------------ */
  submitTheoryImage: async function (qId) {
    const d = this.data;
    const q = d.questions.find((x) => x.id === qId || String(x.id) === String(qId));
    if (!q) return;
    const input = document.getElementById('theory-image-input-' + qId);
    const file = input && input.files && input.files[0];
    if (!file) { this.toast('Please choose or take a photo first.', 'error'); return; }

    const requestTimestamp = Date.now() + Math.random();
    this._lastImageRequest[qId] = requestTimestamp;
    const superseded = () => this._lastImageRequest[qId] !== requestTimestamp;

    const study = d.examMode === 'study';
    const btn = document.getElementById('theory-image-btn-' + qId);
    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + (study ? 'Reading & grading…' : 'Saving…');
    }
    const restore = () => {
      const b = document.getElementById('theory-image-btn-' + qId);
      if (b) { b.disabled = false; b.innerHTML = original; }
    };

    try {
      const compressed = await compressImage(file, 1000, 1000, 0.7);
      if (superseded()) return;                       // race guard
      const base64 = await this._readAsDataURL(compressed);
      if (superseded()) return;                       // race guard

      d.userAnswers[qId] = base64;
      this.saveExamState();

      if (!study) {
        this.renderNavigator();
        restore();
        this.toast('Photo answer saved', 'success');
        return;
      }

      const referenceAnswer = q.explanation || q.correct || 'General knowledge';
      const data = await this._callAiBrain({
        imageBase64: base64,
        referenceAnswer: referenceAnswer,
        maxMarks: q.maxMarks || 10,
        isImage: true
      });
      if (superseded()) return;                       // race guard
      d.answerRevealed[qId] = this._buildGrade(q, data, referenceAnswer, true);
      this.saveExamState();
      this.renderQuestion();
    } catch (err) {
      if (superseded()) return;
      restore();
      this.toast((study ? 'AI grading failed: ' : 'Could not save photo: ') + err.message, 'error');
    }
  }
});
