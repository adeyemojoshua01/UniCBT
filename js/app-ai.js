/* ============================================================
   app-ai.js — submission, AI theory grading (text + image)
   ============================================================ */
(function () {
  'use strict';

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(reader.error || new Error('File read failed')); };
      reader.readAsDataURL(file);
    });
  }

  function localHeuristicGrade(studentAnswer, referenceAnswer, maxMarks, isImage) {
    if (isImage) {
      return {
        score: Math.round(Number(maxMarks || 10) * 0.6),
        reason: 'Offline heuristic assessment (AI proxy unavailable). The photograph was received and compressed. Vision transcription and a detailed rubric comparison require the /api/ai-brain Groq proxy. Provisional credit assumes a complete handwritten attempt that references the model answer.',
        transcription: 'Handwriting transcription unavailable offline.',
        imageFallback: true
      };
    }
    var ref = String(referenceAnswer || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    var stu = String(studentAnswer || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    var refWords = ref.split(/\s+/).filter(function (w) { return w.length > 3; });
    var stuWords = stu.split(/\s+/).filter(function (w) { return w.length > 3; });
    var uniqueRef = refWords.filter(function (w, i) { return refWords.indexOf(w) === i; });
    var hits = uniqueRef.filter(function (w) { return stuWords.indexOf(w) !== -1; }).length;
    var coverage = uniqueRef.length ? hits / uniqueRef.length : 0;
    var depth = Math.min(1, stuWords.length / 18);
    var ratio = Math.max(0, Math.min(1, coverage * 0.65 + depth * 0.35));
    var score = Math.round(ratio * Number(maxMarks || 10));
    var reason = 'Offline heuristic assessment (AI proxy unavailable). ' +
      (hits ? 'Your response touches ' + hits + ' of the key concepts in the model answer. ' : 'No core concepts from the model answer were detected. ') +
      'Expand your answer with definitions, the governing relationship and a short worked step to earn full marks.';
    return { score: score, reason: reason, transcription: null };
  }

  async function callAIBrain(payload) {
    var res = await fetch('/api/ai-brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('AI service responded with ' + res.status);
    var contentType = res.headers.get('content-type') || '';
    if (contentType.indexOf('application/json') === -1) throw new Error('AI service unavailable');
    var data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  async function gradeOrFallback(payload, studentText, reference, maxMarks) {
    try {
      var data = await callAIBrain(payload);
      return {
        score: Number(data.score) || 0,
        reason: String(data.reason || ''),
        transcription: data.transcription || null,
        offline: false
      };
    } catch (err) {
      var fb = localHeuristicGrade(studentText, reference, maxMarks, payload && payload.isImage === true);
      fb.offline = true;
      return fb;
    }
  }

  var aiMethods = {

    /* ============================================================
       submitTest — grade theory, tally score, persist result
       ============================================================ */
    submitTest: async function () {
      if (this._submitting) return;
      this._submitting = true;
      if (this.data.timer) { clearInterval(this.data.timer); this.data.timer = null; }
      this.stopTimer();
      this.clearExamState();
      var self = this;
      var d = this.data;

      try {
        /* 1. find ungraded theory questions and grade them */
        for (var i = 0; i < d.questions.length; i++) {
          var q = d.questions[i];
          if (q.type !== 'theory') continue;
          if (d.answerRevealed[q.id]) continue;
          var userAns = d.userAnswers[q.id] !== undefined ? d.userAnswers[q.id] : d.userAnswers[String(q.id)];
          if (userAns === undefined || userAns === null || String(userAns).trim() === '') continue;

          var isImage = String(userAns).indexOf('data:image') === 0;
          var maxMarks = q.maxMarks || 10;
          var reference = q.explanation || q.correct || 'General knowledge';
          var payload = isImage
            ? { imageBase64: userAns, referenceAnswer: reference, maxMarks: maxMarks, isImage: true }
            : { studentAnswer: userAns, referenceAnswer: reference, maxMarks: maxMarks };

          try {
            var result = await gradeOrFallback(payload, isImage ? '' : userAns, reference, maxMarks);
            var score = Math.max(0, Math.min(maxMarks, Number(result.score) || 0));
            d.answerRevealed[q.id] = {
              isCorrect: score >= maxMarks * 0.4,
              score: score,
              explanation: 'Model Answer:\n\n"' + reference + '"\n\nAI Feedback: ' + result.reason +
                (isImage ? '\n\nAI Transcription: "' + (result.transcription || 'N/A') + '"' : '')
            };
          } catch (err) {
            d.answerRevealed[q.id] = {
              isCorrect: false,
              score: 0,
              explanation: 'Could not grade this answer automatically. Error: ' + err.message
            };
          }
        }

        /* 2. tally score */
        var scoreCount = 0;
        var details = [];
        d.questions.forEach(function (q) {
          var userAns = d.userAnswers[q.id] !== undefined ? d.userAnswers[q.id] : d.userAnswers[String(q.id)];
          var revealed = d.answerRevealed[q.id];
          var isCorrect = false;
          var correctAnswer = q.correct;

          if (q.type === 'theory') {
            isCorrect = !!(revealed && revealed.score !== undefined && revealed.score >= (q.maxMarks || 10) / 2);
            correctAnswer = 'AI Grade: ' + ((revealed && revealed.score !== undefined) ? revealed.score : 0) + '/' + (q.maxMarks || 10);
          } else if (q.type === 'objective') {
            isCorrect = String(userAns || '').toUpperCase() === String(q.correct || '').toUpperCase();
          } else {
            isCorrect = String(userAns || '').trim().toLowerCase() === String(q.correct || '').trim().toLowerCase();
          }

          if (isCorrect) scoreCount++;
          details.push({
            question: q,
            userAnswer: (userAns !== undefined && userAns !== null && String(userAns).trim() !== '') ? userAns : 'Not Answered',
            correctAnswer: correctAnswer,
            isCorrect: isCorrect,
            questionType: q.type,
            options: q.options || null,
            explanation: (revealed && revealed.explanation) ? revealed.explanation : q.explanation
          });
        });

        var total = d.questions.length;
        var percentage = total ? Math.round((scoreCount / total) * 100) : 0;
        var subject = self.currentSubject();
        var result = {
          name: d.candidateName,
          subjectName: subject ? subject.name : 'Exam',
          score: scoreCount,
          total: total,
          percentage: percentage,
          date: new Date().toISOString(),
          examMode: d.examMode,
          details: details
        };

        d.lastResults = result;
        d.results.push(result);
        self.saveResults();
        d.mode = 'result';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        self.showSimplifiedResult(scoreCount, total, percentage);
      } finally {
        this._submitting = false;
      }
    },

    /* ============================================================
       submitTheoryText
       ============================================================ */
    submitTheoryText: async function (qId) {
      var self = this;
      var q = this.data.questions.find(function (x) { return x.id === qId; });
      if (!q) return;
      var input = document.getElementById('theory-text-input-' + qId);
      var answer = input ? input.value : (this.data.userAnswers[qId] || '');
      if (!answer || !String(answer).trim()) {
        this.toast('Please type an answer first.', 'error');
        return;
      }
      this.data.userAnswers[qId] = answer;
      this.cacheTheoryDraft(qId, answer);
      this.saveExamState();

      if (this.data.examMode !== 'study') {
        this.toast('Answer saved', 'success');
        return;
      }

      var btn = document.getElementById('theory-text-btn-' + qId);
      var originalHTML = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Grading…'; }

      var reference = q.explanation || q.correct || 'General knowledge';
      var maxMarks = q.maxMarks || 10;
      try {
        var result = await gradeOrFallback(
          { studentAnswer: answer, referenceAnswer: reference, maxMarks: maxMarks },
          answer, reference, maxMarks
        );
        var score = Math.max(0, Math.min(maxMarks, Number(result.score) || 0));
        this.data.answerRevealed[qId] = {
          isCorrect: score >= maxMarks * 0.4,
          score: score,
          explanation: 'Model Answer:\n\n"' + reference + '"\n\nAI Feedback: ' + result.reason
        };
        this.saveExamState();
        this.toast('AI grading complete: ' + score + '/' + maxMarks, 'success');
        this.renderQuestion();
      } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        this.toast('Grading failed: ' + err.message, 'error');
      }
    },

    /* ============================================================
       submitTheoryImage
       ============================================================ */
    submitTheoryImage: async function (qId) {
      var q = this.data.questions.find(function (x) { return x.id === qId; });
      if (!q) return;
      var input = document.getElementById('theory-image-input-' + qId);
      var file = input && input.files ? input.files[0] : null;
      if (!file) { this.toast('Please choose or capture a photo first.', 'error'); return; }

      var btn = document.getElementById('theory-image-btn-' + qId);
      var originalHTML = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing…'; }

      var self = this;
      var isStudy = this.data.examMode === 'study';
      var timestamp = Date.now();
      this._lastImageRequest[qId] = timestamp;

      try {
        var compressed = await compressImage(file, 1000, 1000, 0.7);
        if (this._lastImageRequest[qId] !== timestamp) return;   // superseded — abort silently
        var dataUrl = await readFileAsDataURL(compressed);
        if (this._lastImageRequest[qId] !== timestamp) return;   // superseded — abort silently

        this.data.userAnswers[qId] = dataUrl;
        this.saveExamState();

        if (!isStudy) {
          this.toast('Image answer saved', 'success');
          if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          this.renderQuestion();
          return;
        }

        var reference = q.explanation || q.correct || 'General knowledge';
        var maxMarks = q.maxMarks || 10;
        if (btn) btn.innerHTML = '<span class="spinner"></span> AI grading…';

        var result = await gradeOrFallback(
          { imageBase64: dataUrl, referenceAnswer: reference, maxMarks: maxMarks, isImage: true },
          '', reference, maxMarks
        );
        if (this._lastImageRequest[qId] !== timestamp) return;   // superseded — abort silently

        var score = Math.max(0, Math.min(maxMarks, Number(result.score) || 0));
        this.data.answerRevealed[qId] = {
          isCorrect: score >= maxMarks * 0.4,
          score: score,
          explanation: 'Model Answer:\n\n"' + reference + '"\n\nAI Transcription: "' + (result.transcription || 'N/A') + '"\n\nAI Feedback: ' + result.reason
        };
        this.saveExamState();
        this.toast('AI grading complete: ' + score + '/' + maxMarks, 'success');
        this.renderQuestion();
      } catch (err) {
        if (this._lastImageRequest[qId] !== timestamp) return;
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        this.toast('Image upload failed: ' + err.message, 'error');
      }
    }
  };

  Object.keys(aiMethods).forEach(function (k) {
    window.app[k] = aiMethods[k];
  });
})();
