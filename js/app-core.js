/* ==========================================================================
   app-core.js — defines window.app (state, landing, candidate flow, resume)
   Other files extend window.app: app-exam.js, app-ai.js, app-results.js
   ========================================================================== */
(function () {
  'use strict';

  const app = {
    /* ------------------------------------------------------------------ *
     *  STATE
     * ------------------------------------------------------------------ */
    data: {
      subjects: {},               // OBJECT keyed by subjectId (NOT an array)
      currentSubjectId: null,
      questions: [],              // subset currently in the exam
      examDuration: 30,           // minutes
      currentQuestionIndex: 0,
      userAnswers: {},            // { [qId]: 'A' | 'text' | 'data:image/...' }
      answerRevealed: {},         // { [qId]: { isCorrect, score, explanation } }
      candidateName: '',
      timer: null,
      timeLeft: 0,                // seconds
      endTime: null,              // absolute ms timestamp (practice only)
      mode: 'landing',
      examMode: null,             // null | 'practice' | 'study'
      results: [],
      images: {},                 // { [subjectId]: [ { data, filename } ] }
      lastResults: null,
      refreshLocked: true
    },
    _savedExamState: null,
    _lastImageRequest: {},
    _theoryDrafts: {},

    /* ------------------------------------------------------------------ *
     *  UTILITIES
     * ------------------------------------------------------------------ */
    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    fisherYates(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    toast(message, type) {
      const host = document.getElementById('toast-container');
      if (!host) return;
      const el = document.createElement('div');
      const colour = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';
      el.className = 'pointer-events-auto px-4 py-2 rounded-lg shadow-xl text-sm font-semibold text-white border border-white/10 ' + colour;
      el.textContent = message;
      host.appendChild(el);
      setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 2600);
      setTimeout(() => el.remove(), 3000);
    },

    openModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('hidden'); },
    closeModal(id) { const m = document.getElementById(id); if (m) m.classList.add('hidden'); },

    getSubject(id) {
      const sid = id || this.data.currentSubjectId;
      return (sid && this.data.subjects[sid]) || null;
    },

    _hasNotes(subject, topicId) {
      return !!(subject && subject.notes && subject.notes[topicId] && String(subject.notes[topicId]).trim() !== '');
    },
    _hasTopicImages(subject, topicId) {
      return !!(subject && subject.topicImages && subject.topicImages[topicId] && subject.topicImages[topicId].length > 0);
    },
    topicHasMaterial(subject, topicId) {
      return this._hasNotes(subject, topicId) || this._hasTopicImages(subject, topicId);
    },

    // Sets the mode, fixes body overflow, refreshes the header.
    _setMode(mode) {
      this.data.mode = mode;
      const lock = mode === 'test';
      document.body.style.overflow = lock ? 'hidden' : '';
      document.documentElement.style.overflow = lock ? 'hidden' : '';
      this.updateHeader();
      const c = document.getElementById('app-container');
      if (c) c.scrollTop = 0;
    },

    /* ------------------------------------------------------------------ *
     *  PERSISTENCE
     * ------------------------------------------------------------------ */
    loadData() {
      try {
        const raw = localStorage.getItem('cbt_subjects');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.data.subjects = parsed;
        }
      } catch (e) { console.warn('loadData failed', e); }
      Object.values(this.data.subjects).forEach((s) => {
        s.notes = s.notes || {};
        s.topicImages = s.topicImages || {};
        s.topics = s.topics || [];
        s.questions = s.questions || [];
        s.duration = s.duration || 30;
      });
    },
    saveSubjects() {
      try { localStorage.setItem('cbt_subjects', JSON.stringify(this.data.subjects)); }
      catch (e) { console.warn('saveSubjects failed', e); }
    },
    loadResults() {
      try {
        const raw = localStorage.getItem('cbt_results');
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) this.data.results = p; }
      } catch (e) { console.warn('loadResults failed', e); }
    },
    saveResults() {
      try {
        localStorage.setItem('cbt_results', JSON.stringify(this.data.results));
      } catch (e) {
        // Quota exceeded (base64 photos) — retry without embedded images.
        try {
          const slim = this.data.results.map((r) => Object.assign({}, r, {
            details: (r.details || []).map((d) => Object.assign({}, d, {
              userAnswer: String(d.userAnswer).startsWith('data:image') ? '[image answer]' : d.userAnswer
            }))
          }));
          localStorage.setItem('cbt_results', JSON.stringify(slim));
        } catch (e2) { console.warn('saveResults failed', e2); }
      }
    },
    loadImages() {
      try {
        const raw = localStorage.getItem('cbt_images');
        if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') this.data.images = p; }
      } catch (e) { console.warn('loadImages failed', e); }
    },
    saveImages() {
      try { localStorage.setItem('cbt_images', JSON.stringify(this.data.images)); }
      catch (e) { console.warn('saveImages failed', e); }
    },

    /* ------------------------------------------------------------------ *
     *  EXAM STATE (resume support)
     * ------------------------------------------------------------------ */
    saveExamState() {
      const d = this.data;
      if (d.mode !== 'test') return;
      try {
        localStorage.setItem('cbt_exam_state', JSON.stringify({
          questions: d.questions,
          userAnswers: d.userAnswers,
          answerRevealed: d.answerRevealed,
          currentIndex: d.currentQuestionIndex,
          endTime: d.endTime,
          examMode: d.examMode,
          candidateName: d.candidateName,
          currentSubjectId: d.currentSubjectId,
          examDuration: d.examDuration,
          timeLeft: d.timeLeft
        }));
      } catch (e) { console.warn('saveExamState failed', e); }
    },
    clearExamState() {
      try { localStorage.removeItem('cbt_exam_state'); } catch (e) { /* ignore */ }
    },

    checkForSavedExam() {
      let state = null;
      try {
        const raw = localStorage.getItem('cbt_exam_state');
        if (raw) state = JSON.parse(raw);
      } catch (e) { state = null; }
      if (!state || !Array.isArray(state.questions) || !state.questions.length) {
        if (state) this.clearExamState();
        return false;
      }
      if (state.examMode === 'practice') {
        if (!state.endTime || state.endTime <= Date.now()) {
          this.clearExamState();   // session expired
          return false;
        }
        state.timeLeft = Math.max(0, (state.endTime - Date.now()) / 1000);
      }
      this._savedExamState = state;
      this.showResumePrompt(state);
      return true;
    },

    showResumePrompt(state) {
      this._setMode('resume-prompt');
      const subj = this.data.subjects[state.currentSubjectId];
      const subjectName = subj ? subj.name : 'Unknown subject';
      const answers = state.userAnswers || {};
      const total = state.questions.length;
      const answered = state.questions.filter((q) => {
        const a = answers[q.id];
        return a !== undefined && a !== null && String(a).trim() !== '';
      }).length;
      const practice = state.examMode === 'practice';
      const remaining = practice ? Math.max(0, Math.round(state.timeLeft || 0)) : 0;
      const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
      const ss = String(remaining % 60).padStart(2, '0');
      const c = document.getElementById('app-container');
      c.innerHTML = `
        <div class="max-w-lg mx-auto p-4 md:p-8">
          <div class="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 md:p-8 text-center">
            <div class="w-20 h-20 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <i class="fas fa-history text-4xl text-yellow-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-800 mb-1">Unfinished Exam Found</h2>
            <p class="text-gray-600 mb-6">You have an exam in progress. Would you like to continue?</p>
            <div class="text-left bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 mb-6 text-sm">
              <div class="flex justify-between gap-3"><span class="text-gray-500">Candidate</span><span class="font-semibold text-gray-800 break-words text-right">${this.esc(state.candidateName || '—')}</span></div>
              <div class="flex justify-between gap-3"><span class="text-gray-500">Subject</span><span class="font-semibold text-gray-800 break-words text-right">${this.esc(subjectName)}</span></div>
              <div class="flex justify-between gap-3"><span class="text-gray-500">Mode</span><span class="font-semibold text-gray-800">${practice ? 'Practice (Timed)' : 'Study'}</span></div>
              <div class="flex justify-between gap-3"><span class="text-gray-500">Progress</span><span class="font-semibold text-gray-800">${answered} / ${total} answered</span></div>
              ${practice ? `<div class="flex justify-between gap-3"><span class="text-gray-500">Time left</span><span class="font-semibold text-gray-800 font-mono">${mm}:${ss}</span></div>` : ''}
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <button type="button" onclick="app.resumeSavedExam()" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl"><i class="fas fa-play mr-2"></i>Resume Exam</button>
              <button type="button" onclick="app.discardSavedExam()" class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3 rounded-xl"><i class="fas fa-trash mr-2"></i>Discard &amp; Start Fresh</button>
            </div>
          </div>
        </div>`;
    },

    resumeSavedExam() {
      const s = this._savedExamState;
      if (!s) { this.showLanding(); return; }
      const d = this.data;
      d.questions = s.questions || [];
      d.userAnswers = s.userAnswers || {};
      d.answerRevealed = s.answerRevealed || {};
      d.currentQuestionIndex = Math.min(Math.max(0, s.currentIndex || 0), Math.max(0, d.questions.length - 1));
      d.examMode = s.examMode;
      d.candidateName = s.candidateName || '';
      d.currentSubjectId = s.currentSubjectId;
      d.examDuration = s.examDuration || 30;
      d.mode = 'test';

      if (s.examMode === 'practice') {
        d.endTime = s.endTime;
        d.timeLeft = Math.max(0, Math.round((d.endTime - Date.now()) / 1000));
        if (d.timeLeft <= 0) {
          this.clearExamState();
          this._savedExamState = null;
          this.submitTest();
          return;
        }
        this.startTimer();
      } else {
        d.timeLeft = 0;
        d.endTime = null;
      }
      this._savedExamState = null;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      this.showTestInterface();
    },

    discardSavedExam() {
      this.clearExamState();
      this._savedExamState = null;
      this.showLanding();
    },

    /* ------------------------------------------------------------------ *
     *  HEADER
     * ------------------------------------------------------------------ */
    updateHeader() {
      const el = document.getElementById('header-actions');
      if (!el) return;
      const d = this.data;
      if (d.mode === 'test') {
        const subj = this.getSubject();
        const imgs = d.images[d.currentSubjectId];
        let html = '';
        if (imgs && imgs.length) {
          html += `<button type="button" onclick="app.showImageModal()" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><i class="fas fa-images"></i><span class="hidden sm:inline">Images</span></button>`;
        }
        html += `<div class="hidden md:block text-right leading-tight max-w-[220px]">
                   <div class="text-sm font-bold truncate">${this.esc(d.candidateName)}</div>
                   <div class="text-xs opacity-80 truncate">${this.esc(subj ? subj.name : '')}</div>
                 </div>`;
        if (d.examMode === 'study') {
          html += `<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold"><i class="fas fa-book-reader mr-1"></i>Study</span>`;
        } else {
          html += `<div id="timer-display" class="font-mono text-xl font-bold bg-black/25 px-3 py-1 rounded-lg">00:00</div>`;
        }
        html += `<button type="button" onclick="app.toggleMobileGrid()" class="md:hidden border border-white/30 bg-white/10 hover:bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center"><i class="fas fa-th"></i></button>`;
        el.innerHTML = html;
        if (typeof this.updateTimerDisplay === 'function') this.updateTimerDisplay();
      } else {
        el.innerHTML = `<button type="button" onclick="app.showLanding()" class="border border-white/30 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><i class="fas fa-home"></i><span class="hidden sm:inline">Home</span></button>`;
      }
    },

    /* ------------------------------------------------------------------ *
     *  LANDING
     * ------------------------------------------------------------------ */
    showLanding() {
      this._setMode('landing');
      const subjects = Object.values(this.data.subjects);
      const withMaterials = subjects.filter((s) =>
        (s.topics || []).some((t) => this.topicHasMaterial(s, t.id)));

      let materialsHtml = '';
      if (withMaterials.length) {
        materialsHtml = `
          <section class="mb-10">
            <h2 class="text-xl font-bold text-gray-800 mb-4"><i class="fas fa-book-open mr-2 text-purple-600"></i>Study Materials</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${withMaterials.map((s) => {
                const topics = s.topics || [];
                const noteCount = topics.filter((t) => this._hasNotes(s, t.id)).length;
                const imageCount = topics.reduce((n, t) => n + (this._hasTopicImages(s, t.id) ? s.topicImages[t.id].length : 0), 0);
                return `
                  <div class="note-card" onclick="app.showSubjectNotes('${this.esc(s.id)}')">
                    <div class="flex items-center gap-3 mb-3">
                      <div class="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center"><i class="fas fa-book text-xl"></i></div>
                      <h3 class="text-lg font-bold break-words min-w-0">${this.esc(s.name)}</h3>
                    </div>
                    <div class="flex gap-4 text-sm opacity-90">
                      <span><i class="fas fa-sticky-note mr-1"></i>${noteCount} note${noteCount === 1 ? '' : 's'}</span>
                      <span><i class="fas fa-image mr-1"></i>${imageCount} image${imageCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </section>`;
      }

      document.getElementById('app-container').innerHTML = `
        <div class="max-w-4xl mx-auto p-4 md:p-8">
          <div class="text-center py-6 md:py-10">
            <div class="inline-flex w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-5 shadow-lg">
              <i class="fas fa-graduation-cap text-5xl text-green-700"></i>
            </div>
            <h1 class="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2">Welcome to the CBT Portal</h1>
            <p class="text-gray-600 max-w-xl mx-auto">Practise under exam conditions or learn with instant explanations. Pick a subject to begin.</p>
          </div>
          ${materialsHtml}
          <button type="button" onclick="app.showCandidateOptions()" class="w-full text-left bg-white border-2 border-green-200 hover:border-green-500 rounded-2xl shadow-lg p-6 md:p-8 flex items-center gap-5 transition">
            <div class="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center shrink-0"><i class="fas fa-user-graduate text-3xl text-green-700"></i></div>
            <div class="min-w-0 flex-1">
              <div class="text-2xl font-bold text-gray-800">Candidate</div>
              <div class="text-gray-600">Take a timed practice test or study with explanations</div>
            </div>
            <i class="fas fa-chevron-right text-green-600 text-xl"></i>
          </button>
        </div>`;
    },

    /* ------------------------------------------------------------------ *
     *  STUDY MATERIALS BROWSER
     * ------------------------------------------------------------------ */
    showSubjectNotes(subjectId) {
      const s = this.data.subjects[subjectId];
      if (!s) { this.showLanding(); return; }
      this._setMode('notes-browser');
      const topics = (s.topics || []).filter((t) => this.topicHasMaterial(s, t.id));
      const sid = this.esc(s.id);
      document.getElementById('app-container').innerHTML = `
        <div class="max-w-4xl mx-auto p-4 md:p-8">
          <button type="button" onclick="app.showLanding()" class="text-green-700 font-semibold mb-4"><i class="fas fa-arrow-left mr-2"></i>Back</button>
          <h2 class="text-2xl font-bold text-gray-800 mb-1">${this.esc(s.name)}</h2>
          <p class="text-gray-600 mb-6">Study materials by topic</p>
          ${topics.length ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${topics.map((t) => {
              const tid = this.esc(t.id);
              const imgCount = this._hasTopicImages(s, t.id) ? s.topicImages[t.id].length : 0;
              return `
                <div class="bg-white border border-gray-200 rounded-xl shadow p-5">
                  <h3 class="font-bold text-lg text-gray-800 mb-3 break-words">${this.esc(t.name)}</h3>
                  <div class="flex flex-wrap gap-2">
                    ${this._hasNotes(s, t.id) ? `<button type="button" onclick="app.viewTopicNote('${sid}','${tid}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-file-alt mr-2"></i>Read Notes</button>` : ''}
                    ${imgCount ? `<button type="button" onclick="app.viewTopicImages('${sid}','${tid}')" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-images mr-2"></i>View Images (${imgCount})</button>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>` : `<div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">No study materials available yet.</div>`}
        </div>`;
    },

    viewTopicNote(subjectId, topicId, topicName) {
      const s = this.data.subjects[subjectId];
      if (!this._hasNotes(s, topicId)) { this.toast('No notes available for this topic.', 'error'); return; }
      const topic = (s.topics || []).find((t) => t.id === topicId);
      const title = document.getElementById('note-viewer-title');
      const content = document.getElementById('note-viewer-content');
      if (title) title.textContent = topicName || (topic ? topic.name : 'Notes');
      if (content) content.innerHTML = s.notes[topicId];      // raw admin HTML
      this.openModal('note-viewer-modal');
      this.triggerMathJax(content);
    },

    viewTopicImages(subjectId, topicId) {
      const s = this.data.subjects[subjectId];
      if (!this._hasTopicImages(s, topicId)) { this.toast('No images available for this topic.', 'error'); return; }
      const topic = (s.topics || []).find((t) => t.id === topicId);
      const title = document.getElementById('topic-image-modal-title');
      const gallery = document.getElementById('topic-image-gallery');
      if (title) title.textContent = (topic ? topic.name : 'Topic') + ' — Images';
      if (gallery) {
        gallery.innerHTML = '';
        s.topicImages[topicId].forEach((img) => {
          const item = document.createElement('div');
          item.className = 'image-item';
          const el = document.createElement('img');
          el.src = img.data;
          el.alt = img.filename || 'image';
          const name = document.createElement('div');
          name.className = 'filename';
          name.textContent = img.filename || '';
          item.appendChild(el);
          item.appendChild(name);
          item.addEventListener('click', () => imageViewer.viewFullSize(img.data));
          gallery.appendChild(item);
        });
      }
      this.openModal('topic-image-modal');
    },

    showImageModal() {
      const imgs = this.data.images[this.data.currentSubjectId];
      const subj = this.getSubject();
      const title = (subj ? subj.name + ' — ' : '') + 'Reference Images';
      if (imgs && imgs.length) imageViewer.open(imgs, title);
      else imageViewer.open([], title);   // shows #no-images-message empty state
    },

    /* ------------------------------------------------------------------ *
     *  SUBJECT SELECTION / MODE SELECTION
     * ------------------------------------------------------------------ */
    showCandidateOptions() {
      this._setMode('candidate-options');
      const subjects = Object.values(this.data.subjects);
      document.getElementById('app-container').innerHTML = `
        <div class="max-w-4xl mx-auto p-4 md:p-8">
          <button type="button" onclick="app.showLanding()" class="text-green-700 font-semibold mb-4"><i class="fas fa-arrow-left mr-2"></i>Back</button>
          <h2 class="text-2xl font-bold text-gray-800 mb-1">Select a Subject</h2>
          <p class="text-gray-600 mb-6">Choose the subject you want to be tested on.</p>
          ${subjects.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${subjects.map((s) => `
              <button type="button" onclick="app.showModeSelection('${this.esc(s.id)}')" class="text-left bg-white border-2 border-gray-200 hover:border-green-500 rounded-xl shadow p-5 transition">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><i class="fas fa-book text-xl text-green-700"></i></div>
                  <div class="min-w-0">
                    <div class="font-bold text-lg text-gray-800 break-words">${this.esc(s.name)}</div>
                    <div class="text-sm text-gray-500">${(s.questions || []).length} question${(s.questions || []).length === 1 ? '' : 's'}</div>
                  </div>
                </div>
              </button>`).join('')}
          </div>` : `<div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>No subjects loaded yet…</div>`}
        </div>`;
    },

    showModeSelection(subjectId) {
      const s = this.data.subjects[subjectId];
      if (!s) { this.showCandidateOptions(); return; }
      this._setMode('mode-selection');
      this.data.currentSubjectId = subjectId;
      const sid = this.esc(subjectId);
      document.getElementById('app-container').innerHTML = `
        <div class="max-w-2xl mx-auto p-4 md:p-8">
          <button type="button" onclick="app.showCandidateOptions()" class="text-green-700 font-semibold mb-4"><i class="fas fa-arrow-left mr-2"></i>Back</button>
          <h2 class="text-2xl font-bold text-gray-800 mb-1 break-words">${this.esc(s.name)}</h2>
          <p class="text-gray-600 mb-6">How would you like to take this test?</p>
          <div class="space-y-4">
            <button type="button" onclick="app.showCandidateLogin('practice','${sid}')" class="w-full text-left bg-white border-2 border-blue-200 hover:border-blue-500 rounded-xl shadow p-5 flex items-center gap-4 transition">
              <div class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><i class="fas fa-stopwatch text-2xl text-blue-700"></i></div>
              <div><div class="font-bold text-lg text-gray-800">Practice Mode (Timed)</div><div class="text-sm text-gray-600">Exam conditions with a countdown timer. Results at the end.</div></div>
            </button>
            <button type="button" onclick="app.showCandidateLogin('study','${sid}')" class="w-full text-left bg-white border-2 border-green-200 hover:border-green-500 rounded-xl shadow p-5 flex items-center gap-4 transition">
              <div class="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><i class="fas fa-lightbulb text-2xl text-green-700"></i></div>
              <div><div class="font-bold text-lg text-gray-800">Study Mode (Learn with Explanations)</div><div class="text-sm text-gray-600">No timer. See the correct answer and explanation instantly.</div></div>
            </button>
          </div>
        </div>`;
    },

    /* ------------------------------------------------------------------ *
     *  CANDIDATE LOGIN
     * ------------------------------------------------------------------ */
    showCandidateLogin(mode, subjectId) {
      const s = this.data.subjects[subjectId];
      if (!s) { this.showCandidateOptions(); return; }
      this._setMode('mode-selection');
      this.data.currentSubjectId = subjectId;
      this.data.examMode = mode;
      const practice = mode === 'practice';
      const topics = s.topics || [];
      document.getElementById('app-container').innerHTML = `
        <div class="max-w-2xl mx-auto p-4 md:p-8">
          <button type="button" onclick="app.showModeSelection('${this.esc(subjectId)}')" class="text-green-700 font-semibold mb-4"><i class="fas fa-arrow-left mr-2"></i>Back</button>
          <form id="candidate-form" onsubmit="event.preventDefault(); app.startTestPrep();" class="bg-white border border-gray-200 rounded-2xl shadow-xl p-5 md:p-8 space-y-5">
            <div>
              <h2 class="text-2xl font-bold text-gray-800 break-words">${this.esc(s.name)}</h2>
              <span class="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${practice ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${practice ? 'Practice Mode (Timed)' : 'Study Mode'}</span>
            </div>

            <div>
              <label for="candidate-name" class="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input id="candidate-name" type="text" required autocomplete="name" value="${this.esc(this.data.candidateName)}" placeholder="Enter your full name" class="w-full border-2 border-gray-300 rounded-lg px-4 py-3" />
            </div>

            <div>
              <label for="exam-topic-select" class="block text-sm font-semibold text-gray-700 mb-1">Topic</label>
              <select id="exam-topic-select" onchange="app.renderCandidateSubTopics()" class="w-full border-2 border-gray-300 rounded-lg px-4 py-3">
                ${topics.map((t) => `<option value="${this.esc(t.id)}">${this.esc(t.name)}</option>`).join('')}
              </select>
            </div>

            ${practice ? `
            <div>
              <label for="custom-duration-input" class="block text-sm font-semibold text-gray-700 mb-1">Custom Exam Duration (minutes)</label>
              <input id="custom-duration-input" type="number" min="1" max="999" placeholder="Leave empty to use default (${s.duration || 30} min)" class="w-full border-2 border-gray-300 rounded-lg px-4 py-3" />
            </div>` : ''}

            <div>
              <div class="block text-sm font-semibold text-gray-700 mb-2">Sub-topics &amp; number of questions</div>
              <div id="candidate-topics-container" class="space-y-2"></div>
              <p class="text-xs text-gray-500 mt-2">Tip: if you tick nothing, the whole subject is used.</p>
            </div>

            <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg"><i class="fas fa-play mr-2"></i>Start ${practice ? 'Test' : 'Studying'}</button>
          </form>
        </div>`;
      this.renderCandidateSubTopics();
    },

    renderCandidateSubTopics() {
      const sel = document.getElementById('exam-topic-select');
      const cont = document.getElementById('candidate-topics-container');
      if (!cont) return;
      const subj = this.getSubject();
      const topicId = sel ? sel.value : null;
      const qs = subj ? (subj.questions || []).filter((q) => q.topicId === topicId) : [];
      if (!qs.length) {
        cont.innerHTML = '<p class="text-gray-500 text-sm p-3 bg-gray-50 border border-gray-200 rounded-lg">No questions available for this topic.</p>';
        return;
      }
      const groups = new Map();
      qs.forEach((q) => {
        const key = q.subTopic || 'General';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(q.id);
      });
      let i = 0;
      let html = '';
      groups.forEach((ids, name) => {
        const val = 'sub_' + i;
        html += `
          <div class="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <input type="checkbox" name="exam-topic" id="chk-${val}" value="${val}" data-qids="${this.esc(JSON.stringify(ids))}" onchange="app.onSubTopicToggle(this)" class="w-5 h-5 shrink-0" />
            <label for="chk-${val}" class="flex-1 min-w-0 cursor-pointer text-gray-800 font-medium break-words">${this.esc(name)}
              <span class="text-xs text-gray-500 font-normal">(${ids.length} available)</span></label>
            <input type="number" class="topic-quantity w-20 border-2 border-gray-300 rounded-lg px-2 py-1 text-center" data-sub-topic-id="${val}" min="0" max="${ids.length}" value="${ids.length}" disabled oninput="app.onSubTopicQty(this)" />
          </div>`;
        i++;
      });
      cont.innerHTML = html;
    },

    _qtyFor(val) {
      return document.querySelector('.topic-quantity[data-sub-topic-id="' + val + '"]');
    },
    onSubTopicToggle(chk) {
      const qty = this._qtyFor(chk.value);
      if (!qty) return;
      qty.disabled = !chk.checked;
      if (chk.checked && (parseInt(qty.value, 10) || 0) === 0) qty.value = qty.max;
    },
    onSubTopicQty(input) {
      const max = parseInt(input.max, 10) || 0;
      if (input.value === '') return;
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = 0;
      if (v > max) { v = max; input.value = max; }
      if (v < 0) { v = 0; input.value = 0; }
      const chk = document.querySelector('input[name="exam-topic"][value="' + input.dataset.subTopicId + '"]');
      if (!chk) return;
      if (v === 0 && chk.checked) { chk.checked = false; input.disabled = true; }
      else if (v > 0 && !chk.checked) { chk.checked = true; }
    },

    /* ------------------------------------------------------------------ *
     *  START TEST
     * ------------------------------------------------------------------ */
    startTestPrep() {
      const d = this.data;
      const subject = this.getSubject();
      if (!subject) { this.toast('Please select a subject first.', 'error'); return; }

      const name = (document.getElementById('candidate-name') || {}).value || '';
      if (!name.trim()) { this.toast('Please enter your full name.', 'error'); return; }
      d.candidateName = name.trim();

      let custom = null;
      if (d.examMode === 'practice') {
        const el = document.getElementById('custom-duration-input');
        const v = el ? parseInt(el.value, 10) : NaN;
        if (!isNaN(v) && v >= 1 && v <= 999) custom = v;
      }

      let questionsToUse = [];
      document.querySelectorAll('input[name="exam-topic"]:checked').forEach((chk) => {
        let ids = [];
        try { ids = JSON.parse(chk.dataset.qids || '[]'); } catch (e) { ids = []; }
        const idSet = new Set(ids);
        const qtyEl = this._qtyFor(chk.value);
        const max = ids.length;
        let qty = qtyEl ? parseInt(qtyEl.value, 10) : max;
        if (isNaN(qty)) qty = max;
        qty = Math.max(0, Math.min(max, qty));
        const pool = this.fisherYates(subject.questions.filter((q) => idSet.has(q.id)));
        questionsToUse = questionsToUse.concat(pool.slice(0, qty));
      });

      // QUIRK (preserved): nothing ticked => the WHOLE subject, not just the selected topic.
      if (questionsToUse.length === 0) questionsToUse = [...subject.questions];
      questionsToUse = this.fisherYates(questionsToUse);

      if (!questionsToUse.length) { this.toast('This subject has no questions yet.', 'error'); return; }

      d.questions = questionsToUse;
      d.examDuration = (d.examMode === 'practice') ? (custom || subject.duration || 30) : (subject.duration || 30);
      d.currentQuestionIndex = 0;
      d.userAnswers = {};
      d.answerRevealed = {};
      this._theoryDrafts = {};
      this._lastImageRequest = {};
      this.clearExamState();
      this.stopTimer();
      d.endTime = null;

      if (d.examMode === 'practice') {
        d.timeLeft = d.examDuration * 60;
        this.startTimer();
      } else {
        d.timeLeft = 0;
      }

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      this.showTestInterface();
    },

    /* ------------------------------------------------------------------ *
     *  MATHJAX
     * ------------------------------------------------------------------ */
    // Typesets #app-container by default; an element may be passed (e.g. modals).
    triggerMathJax(target) {
      const el = target || document.getElementById('app-container');
      if (!el) return;
      if (!window.MathJax || !window.MathJax.typesetPromise || !window.MathJax.startup) return;
      try {
        window.MathJax.startup.promise = window.MathJax.startup.promise
          .then(() => {
            if (window.MathJax.typesetClear) window.MathJax.typesetClear([el]);
            return window.MathJax.typesetPromise([el]);
          })
          .catch((err) => console.warn('MathJax:', err && err.message));
      } catch (e) { /* ignore */ }
    },

    setupMathJaxPatch() {
      const self = this;
      ['renderQuestion', 'showResult', 'showFullReview', 'viewTopicNote',
       'showSubjectDashboard', 'showLanding', 'showTestInterface'].forEach((name) => {
        const orig = self[name];
        if (typeof orig !== 'function') return;     // showResult / showSubjectDashboard don't exist
        self[name] = function () {
          const r = orig.apply(this, arguments);
          setTimeout(() => self.triggerMathJax(), 200);
          return r;
        };
      });
    },

    /* ------------------------------------------------------------------ *
     *  INIT
     * ------------------------------------------------------------------ */
    init() {
      this.loadData();
      this.loadResults();
      this.loadImages();
      if (window.imageViewer && typeof imageViewer.init === 'function') imageViewer.init();
      this.setupMathJaxPatch();
      if (this.checkForSavedExam()) return;   // resume prompt takes over
      this.showLanding();
    }
  };

  window.app = app;
})();
