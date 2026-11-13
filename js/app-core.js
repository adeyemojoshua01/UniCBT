/* ============================================================
   app-core.js — window.app: state, persistence, landing,
   study materials, candidate flow, resume prompt, header
   ============================================================ */
(function () {
  'use strict';

  window.app = {
    data: {
      subjects: {},
      currentSubjectId: null,
      questions: [],
      examDuration: 30,
      currentQuestionIndex: 0,
      userAnswers: {},
      answerRevealed: {},
      candidateName: '',
      timer: null,
      timeLeft: 0,
      endTime: null,
      mode: 'landing',
      examMode: null,
      results: [],
      images: {},
      lastResults: null,
      refreshLocked: true
    },
    _savedExamState: null,
    _lastImageRequest: {},

    /* ---------------- helpers ---------------- */
    esc: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    toast: function (message, type) {
      var layer = document.getElementById('toast-layer');
      if (!layer) { return; }
      var el = document.createElement('div');
      el.className = 'cbt-toast ' + (type === 'error' ? 'toast-error' : (type === 'success' ? 'toast-success' : ''));
      el.innerHTML = '<i class="fas ' + (type === 'error' ? 'fa-circle-exclamation' : (type === 'success' ? 'fa-circle-check' : 'fa-circle-info')) + ' mr-2"></i>' + this.esc(message);
      layer.appendChild(el);
      setTimeout(function () {
        el.style.transition = 'opacity .3s ease, transform .3s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        setTimeout(function () { el.remove(); }, 320);
      }, 3200);
    },

    formatDate: function (iso) {
      try { return new Date(iso).toLocaleString(); } catch (e) { return iso || ''; }
    },

    currentSubject: function () {
      return this.data.subjects[this.data.currentSubjectId] || null;
    },

    /* ---------------- persistence ---------------- */
    loadData: function () {
      try {
        var raw = localStorage.getItem('cbt_subjects');
        var parsed = raw ? JSON.parse(raw) : null;
        this.data.subjects = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
      } catch (e) {
        this.data.subjects = {};
      }
      Object.keys(this.data.subjects).forEach(function (id) {
        var s = this.data.subjects[id];
        if (!s.notes) s.notes = {};
        if (!s.topicImages) s.topicImages = {};
        if (!Array.isArray(s.questions)) s.questions = [];
        if (!Array.isArray(s.topics)) s.topics = [];
      }, this);
      if (!this.data.currentSubjectId) {
        var keys = Object.keys(this.data.subjects);
        if (keys.length) this.data.currentSubjectId = keys[0];
      }
    },

    saveSubjects: function () {
      try { localStorage.setItem('cbt_subjects', JSON.stringify(this.data.subjects)); } catch (e) { console.warn('saveSubjects failed', e); }
    },

    loadResults: function () {
      try {
        var raw = localStorage.getItem('cbt_results');
        this.data.results = raw ? (JSON.parse(raw) || []) : [];
        if (!Array.isArray(this.data.results)) this.data.results = [];
      } catch (e) { this.data.results = []; }
    },

    saveResults: function () {
      try { localStorage.setItem('cbt_results', JSON.stringify(this.data.results)); } catch (e) { console.warn('saveResults failed', e); }
    },

    loadImages: function () {
      try {
        var raw = localStorage.getItem('cbt_images');
        this.data.images = raw ? (JSON.parse(raw) || {}) : {};
      } catch (e) { this.data.images = {}; }
    },

    saveImages: function () {
      try { localStorage.setItem('cbt_images', JSON.stringify(this.data.images)); } catch (e) { console.warn('saveImages failed', e); }
    },

    /* ---------------- mathjax ---------------- */
    triggerMathJax: function () {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return;
      var container = document.getElementById('app-container');
      if (!container) return;
      try {
        window.MathJax.typesetPromise([container]).catch(function () {});
      } catch (e) { /* noop */ }
    },

    typeset: function (selector) {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return;
      var nodes = document.querySelectorAll(selector);
      if (!nodes.length) return;
      try { window.MathJax.typesetPromise(Array.prototype.slice.call(nodes)).catch(function () {}); } catch (e) {}
    },

    setupMathJaxPatch: function () {
      var methods = ['renderQuestion', 'showResult', 'showFullReview', 'viewTopicNote', 'showSubjectDashboard', 'showLanding', 'showTestInterface'];
      methods.forEach(function (name) {
        if (typeof app[name] !== 'function') return;
        var original = app[name];
        app[name] = function () {
          var result = original.apply(this, arguments);
          setTimeout(function () { app.triggerMathJax(); }, 200);
          return result;
        };
      });
    },

    /* ---------------- header ---------------- */
    updateHeader: function () {
      var el = document.getElementById('header-actions');
      if (!el) return;
      var self = this;
      var d = this.data;
      if (d.mode === 'test') {
        var subject = this.currentSubject();
        var refImages = (d.images && d.images[d.currentSubjectId]) ? d.images[d.currentSubjectId] : [];
        var html = '';
        if (refImages.length) {
          html += '<button onclick="app.showImageModal()" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold">' +
            '<i class="fas fa-images"></i><span class="hidden sm:inline">Images</span></button>';
        }
        html += '<div class="hidden md:block text-right leading-tight mr-1 min-w-0">' +
          '<div class="text-sm font-semibold truncate max-w-[160px]">' + this.esc(d.candidateName || 'Candidate') + '</div>' +
          '<div class="text-[11px] text-green-100 truncate max-w-[160px]">' + this.esc(subject ? subject.name : '') + '</div>' +
          '</div>';
        if (d.examMode === 'study') {
          html += '<span class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-bold"><i class="fas fa-book-open"></i> Study</span>';
        } else {
          html += '<div id="timer-display" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 text-white text-base font-mono font-bold tracking-wider"><i class="fas fa-clock text-sm"></i>00:00</div>';
        }
        html += '<button onclick="app.toggleMobileGrid()" class="md:hidden w-10 h-10 rounded-lg bg-white/15 text-white flex items-center justify-center" aria-label="Question navigator"><i class="fas fa-th"></i></button>';
        el.innerHTML = html;
        if (d.examMode !== 'study') this.updateTimerDisplay();
      } else {
        el.innerHTML = '<button onclick="app.showLanding()" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold" aria-label="Home"><i class="fas fa-home"></i><span class="hidden sm:inline">Home</span></button>';
      }
    },

    /* ---------------- landing ---------------- */
    studyMaterialTopics: function (subject) {
      var out = [];
      if (!subject || !Array.isArray(subject.topics)) return out;
      subject.topics.forEach(function (topic) {
        var note = subject.notes ? subject.notes[topic.id] : '';
        var imgs = (subject.topicImages && subject.topicImages[topic.id]) ? subject.topicImages[topic.id] : [];
        if ((note && String(note).trim() !== '') || imgs.length > 0) {
          out.push({
            id: topic.id,
            name: topic.name,
            hasNotes: !!(note && String(note).trim() !== ''),
            images: imgs.length
          });
        }
      });
      return out;
    },

    showLanding: function () {
      this.data.mode = 'landing';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;

      var subjects = Object.values(this.data.subjects);
      var materialCards = '';
      var materialCount = 0;
      subjects.forEach(function (s) {
        var topics = self.studyMaterialTopics(s);
        if (!topics.length) return;
        materialCount++;
        var noteCount = topics.filter(function (t) { return t.hasNotes; }).length;
        var imageCount = topics.reduce(function (acc, t) { return acc + t.images; }, 0);
        materialCards += '<button onclick="app.showSubjectNotes(\'' + s.id + '\')" class="note-card group text-left rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-transform duration-200">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><i class="fas fa-book-open text-lg"></i></div>' +
          '<i class="fas fa-arrow-right text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all"></i>' +
          '</div>' +
          '<h3 class="mt-4 font-bold text-lg leading-snug">' + self.esc(s.name) + '</h3>' +
          '<p class="text-xs text-white/70 mt-1">' + topics.length + (topics.length === 1 ? ' topic' : ' topics') + ' with study material</p>' +
          '<div class="flex flex-wrap gap-2 mt-3">' +
          '<span class="px-2 py-1 rounded-md bg-white/15 text-[11px] font-semibold"><i class="fas fa-file-lines mr-1"></i>' + noteCount + ' notes</span>' +
          '<span class="px-2 py-1 rounded-md bg-white/15 text-[11px] font-semibold"><i class="fas fa-image mr-1"></i>' + imageCount + ' images</span>' +
          '</div></button>';
      });

      var totalQuestions = subjects.reduce(function (acc, s) { return acc + (s.questions ? s.questions.length : 0); }, 0);
      var doneExams = this.data.results.length;
      var avg = 0;
      if (doneExams) {
        avg = Math.round(this.data.results.reduce(function (acc, r) { return acc + (Number(r.percentage) || 0); }, 0) / doneExams);
      }

            var html = '' +
        '<section class="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl mb-6">' +
        '<div class="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-100 blur-2xl"></div>' +
        '<div class="absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-green-100 blur-2xl"></div>' +
        '<div class="relative p-6 md:p-10">' +
        '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wider mb-5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Aurora Obsidian · CBT</div>' +
        '<div class="flex flex-col md:flex-row md:items-center gap-6">' +
        '<div class="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-green-700 text-white flex items-center justify-center shrink-0 shadow-lg"><i class="fas fa-graduation-cap text-4xl md:text-5xl"></i></div>' +
        '<div class="min-w-0 flex-grow">' +
        '<h2 class="text-3xl md:text-4xl font-extrabold text-gray-800 tracking-tight">Welcome to the CBT Portal</h2>' +
        '<p class="text-gray-600 mt-2 max-w-2xl">Timed practice, study-with-explanations, AI theory grading and admin-authored question banks — all in one focused workspace.</p>' +
        '</div></div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">' +
        '<div class="rounded-xl bg-gray-50 border border-gray-200 p-3"><div class="text-2xl font-extrabold text-gray-800">' + subjects.length + '</div><div class="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Subjects</div></div>' +
        '<div class="rounded-xl bg-gray-50 border border-gray-200 p-3"><div class="text-2xl font-extrabold text-gray-800">' + totalQuestions + '</div><div class="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Questions</div></div>' +
        '<div class="rounded-xl bg-gray-50 border border-gray-200 p-3"><div class="text-2xl font-extrabold text-gray-800">' + doneExams + '</div><div class="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Exams taken</div></div>' +
        '<div class="rounded-xl bg-gray-50 border border-gray-200 p-3"><div class="text-2xl font-extrabold text-gray-800">' + (doneExams ? avg + '%' : '—') + '</div><div class="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Avg. score</div></div>' +
        '</div></div></section>' +

        // REMOVED THE STUDY MATERIALS SECTION HERE

        '<section class="grid md:grid-cols-3 gap-4">' +
        '<div class="md:col-span-2 flex flex-col gap-4">' +
        
        // Candidate Button
        '<button onclick="app.showCandidateOptions()" class="text-left rounded-2xl bg-white border border-gray-200 p-6 shadow-lg hover:border-green-500 transition-colors group">' +
        '<div class="flex items-center gap-4">' +
        '<div class="w-14 h-14 rounded-2xl bg-green-700 text-white flex items-center justify-center shrink-0"><i class="fas fa-user-graduate text-2xl"></i></div>' +
        '<div class="min-w-0 flex-grow"><h3 class="text-xl font-bold text-gray-800">I\'m a Candidate</h3>' +
        '<p class="text-sm text-gray-500 mt-0.5">Choose a subject, then take a timed practice paper or study with instant explanations.</p></div>' +
        '<i class="fas fa-arrow-right text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all"></i>' +
        '</div>' +
        '<div class="flex flex-wrap gap-2 mt-4">' +
        '<span class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold"><i class="fas fa-clock mr-1"></i>Practice mode</span>' +
        '<span class="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-[11px] font-bold"><i class="fas fa-lightbulb mr-1"></i>Study mode</span>' +
        '<span class="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-[11px] font-bold"><i class="fas fa-robot mr-1"></i>AI theory grading</span>' +
        '</div></button>' +

        // Notes Library Button
        '<button onclick="app.showAllNotes()" class="text-left rounded-2xl bg-white border border-gray-200 p-6 shadow-lg hover:border-blue-500 transition-colors group">' +
        '<div class="flex items-center gap-4">' +
        '<div class="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"><i class="fas fa-book-open text-2xl"></i></div>' +
        '<div class="min-w-0 flex-grow"><h3 class="text-xl font-bold text-gray-800">Notes Library</h3>' +
        '<p class="text-sm text-gray-500 mt-0.5">Access all compiled study notes and materials across every subject.</p></div>' +
        '<i class="fas fa-arrow-right text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"></i>' +
        '</div></button>' +
        
        '</div>' +
        
        // Recent Results
        '<div class="rounded-2xl bg-white border border-gray-200 p-6 shadow-lg">' +
        '<h3 class="font-bold text-gray-800"><i class="fas fa-clock-rotate-left text-green-600 mr-2"></i>Recent Results</h3>' +
        (this.data.results.length ? this.data.results.slice(-3).reverse().map(function (r) {
          return '<div class="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">' +
            '<div class="min-w-0"><div class="text-sm font-semibold text-gray-700 truncate">' + self.esc(r.subjectName || 'Exam') + '</div>' +
            '<div class="text-[11px] text-gray-500">' + self.esc(r.name || '') + '</div></div>' +
            '<span class="text-sm font-bold ' + ((r.percentage >= 50) ? 'text-green-600' : 'text-red-500') + '">' + r.percentage + '%</span></div>';
        }).join('') :
          '<p class="text-sm text-gray-500 mt-3">No exams taken yet. Your scores will appear here.</p>') +
        '</div>' +
        '</section>' +

        '<footer class="mt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">' +
        '<span>eduCBT · static app, no build step.</span>' +
        '<a href="question-builder.html" class="inline-flex items-center gap-1.5 text-gray-500 hover:text-purple-600 font-semibold"><i class="fas fa-pen-ruler"></i> Open Question Builder</a>' +
        '</footer>';

      container.innerHTML = html;
      container.scrollTop = 0;
      this.triggerMathJax();
    },

    /* ---------------- study materials browser ---------------- */
    showSubjectNotes: function (subjectId) {
      var subject = this.data.subjects[subjectId];
      this.data.currentSubjectId = subjectId;
      this.data.mode = 'notes-browser';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;
      if (!subject) {
        container.innerHTML = '<div class="p-8 text-center text-gray-500">Subject not found.</div>';
        return;
      }
      var topics = this.studyMaterialTopics(subject);
      var cards = topics.map(function (t) {
        return '<div class="rounded-2xl bg-white border border-gray-200 p-5 shadow-lg">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><i class="fas fa-bookmark"></i></div>' +
          '<div class="flex flex-wrap gap-1.5">' +
          (t.hasNotes ? '<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">Notes</span>' : '') +
          (t.images ? '<span class="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold uppercase">' + t.images + ' images</span>' : '') +
          '</div></div>' +
          '<h3 class="mt-3 font-bold text-gray-800 leading-snug">' + self.esc(t.name) + '</h3>' +
          '<div class="flex flex-wrap gap-2 mt-4">' +
          (t.hasNotes ? '<button onclick="app.viewTopicNote(\'' + subjectId + '\',\'' + t.id + '\')" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"><i class="fas fa-file-lines"></i>Read Notes</button>' : '') +
          (t.images ? '<button onclick="app.viewTopicImages(\'' + subjectId + '\',\'' + t.id + '\')" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"><i class="fas fa-images"></i>View Images (' + t.images + ')</button>' : '') +
          '</div></div>';
      }).join('');

      container.innerHTML = '<div class="mb-5 flex flex-wrap items-center justify-between gap-3">' +
        '<div><button onclick="app.showLanding()" class="text-xs font-bold text-gray-500 hover:text-green-600 mb-2 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Back to home</button>' +
        '<h2 class="text-2xl font-extrabold text-gray-800">' + this.esc(subject.name) + ' · Study Materials</h2>' +
        '<p class="text-sm text-gray-500">Pick a topic to read its notes or browse the visual library.</p></div>' +
        '<span class="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold"><i class="fas fa-book-open mr-1"></i>' + topics.length + ' topics</span></div>' +
        (topics.length ? '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">' + cards + '</div>' :
          '<div class="rounded-2xl bg-white border border-gray-200 p-10 text-center"><div class="text-4xl mb-3">📭</div><p class="text-gray-500">No study material has been uploaded for this subject yet.</p></div>');
    },

    viewTopicNote: function (subjectId, topicId, topicName) {
      var subject = this.data.subjects[subjectId];
      if (!subject || !subject.notes) return;
      var note = subject.notes[topicId];
      if (!note || !String(note).trim()) {
        this.toast('No notes available for this topic.', 'error');
        return;
      }
      var resolvedName = topicName;
      if ((!resolvedName || /^topic_/.test(resolvedName)) && Array.isArray(subject.topics)) {
        var foundTopic = subject.topics.find(function (t) { return t.id === topicId; });
        if (foundTopic) resolvedName = foundTopic.name;
      }
      var titleEl = document.getElementById('note-viewer-title');
      if (titleEl) titleEl.textContent = (resolvedName || 'Topic') + ' · Notes';
      var bodyEl = document.getElementById('note-viewer-content');
      if (bodyEl) bodyEl.innerHTML = note;
      var modal = document.getElementById('note-viewer-modal');
      if (modal) modal.classList.remove('hidden');
      this.typeset('#note-viewer-content');
      this.triggerMathJax();
    },

    
   viewTopicImages: function (subjectId, topicId) {
       
      var subject = this.data.subjects[subjectId];
      if (!subject || !subject.topicImages) return;
      var list = subject.topicImages[topicId] || [];
      var topic = (subject.topics || []).find(function (t) { return t.id === topicId; });
      
      var titleEl = document.getElementById('topic-image-modal-title');
      if (titleEl) titleEl.textContent = (topic ? topic.name : 'Topic') + ' · Images';
      
      var gallery = document.getElementById('topic-image-gallery');
      if (gallery) {
        gallery.innerHTML = list.length ? list.map(function (img, i) {
          return '<div class="image-item cursor-pointer" data-i="' + i + '">' +
            '<img src="' + (img.data || '') + '" alt="' + app.esc(img.filename || 'image') + '">' +
            '<div class="filename">' + app.esc(img.filename || ('image-' + (i + 1))) + '</div></div>';
        }).join('') : '<p class="text-sm text-gray-500 col-span-2 md:col-span-3 text-center py-8">No images for this topic.</p>';
        
        // Attach the click event to the parent container (Event Delegation)
        gallery.onclick = function(e) {
          var item = e.target.closest('.image-item');
          if (!item) return;
          var i = parseInt(item.getAttribute('data-i'), 10);
          if (list[i] && list[i].data) {
            if (window.imageViewer && typeof window.imageViewer.viewFullSize === 'function') {
              window.imageViewer.viewFullSize(list[i].data);
            }
          }
        };
      }
      
      var modal = document.getElementById('topic-image-modal');
      if (modal) modal.classList.remove('hidden');
    },

    /* ---------------- candidate flow ---------------- */
    showCandidateOptions: function () {
      this.data.mode = 'candidate-options';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;
      var subjects = Object.values(this.data.subjects);
      var cards = subjects.map(function (s) {
        return '<button onclick="app.showModeSelection(\'' + s.id + '\')" class="text-left rounded-2xl bg-white border border-gray-200 p-5 shadow-lg hover:border-green-500 hover:-translate-y-0.5 transition-all group">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="w-11 h-11 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0"><i class="fas fa-book"></i></div>' +
          '<i class="fas fa-arrow-right text-gray-300 group-hover:text-green-600 transition-colors"></i></div>' +
          '<h3 class="mt-4 font-bold text-lg text-gray-800">' + self.esc(s.name) + '</h3>' +
          '<div class="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">' +
          '<span class="px-2 py-1 rounded bg-gray-50 border border-gray-200 font-semibold"><i class="fas fa-list-check mr-1"></i>' + (s.questions ? s.questions.length : 0) + ' questions</span>' +
          '<span class="px-2 py-1 rounded bg-gray-50 border border-gray-200 font-semibold"><i class="fas fa-clock mr-1"></i>' + (s.duration || 30) + ' min</span>' +
          '<span class="px-2 py-1 rounded bg-gray-50 border border-gray-200 font-semibold"><i class="fas fa-layer-group mr-1"></i>' + (s.topics ? s.topics.length : 0) + ' topics</span>' +
          '</div></button>';
      }).join('');

      container.innerHTML = '<div class="mb-5">' +
        '<button onclick="app.showLanding()" class="text-xs font-bold text-gray-500 hover:text-green-600 mb-2 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Back to home</button>' +
        '<h2 class="text-2xl md:text-3xl font-extrabold text-gray-800">Choose your subject</h2>' +
        '<p class="text-sm text-gray-500 mt-1">Select a paper to configure your attempt.</p></div>' +
        (subjects.length ? '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">' + cards + '</div>' :
          '<div class="rounded-2xl bg-white border border-gray-200 p-10 text-center"><div class="text-4xl mb-3">🗂️</div><p class="text-gray-500">No subjects loaded. Add a question bank to get started.</p></div>');
    },



   showAllNotes: function () {
      this.data.mode = 'all-notes';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;

      var allMaterials = [];
      Object.values(this.data.subjects).forEach(function (s) {
        // This gets topics that have notes OR images
        var topics = self.studyMaterialTopics(s); 
        if (topics.length > 0) {
          allMaterials.push({ subjectName: s.name, subjectId: s.id, topics: topics });
        }
      });

      var contentHTML = '';
      if (allMaterials.length === 0) {
        contentHTML = '<div class="rounded-2xl bg-white border border-gray-200 p-10 text-center"><div class="text-4xl mb-3">📭</div><p class="text-gray-500">No notes or images available.</p></div>';
      } else {
        contentHTML = '<div class="space-y-4">' + allMaterials.map(function (group) {
          var topicCards = group.topics.map(function (t) {
            return '<div class="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
              '<div class="flex items-center gap-3 min-w-0">' +
              '<div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i class="fas fa-file-lines text-sm"></i></div>' +
              '<span class="font-semibold text-gray-700 truncate min-w-0">' + self.esc(t.name) + '</span>' +
              '</div>' +
              
              // Actions: Read Notes & View Images
              '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
              (t.hasNotes ? '<button onclick="app.viewTopicNote(\'' + group.subjectId + '\',\'' + t.id + '\',\'' + self.esc(t.name) + '\')" class="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200 transition-colors"><i class="fas fa-book-open mr-1"></i> Read Notes</button>' : '') +
              (t.images > 0 ? '<button onclick="app.viewTopicImages(\'' + group.subjectId + '\',\'' + t.id + '\')" class="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200 transition-colors"><i class="fas fa-images mr-1"></i> View Images (' + t.images + ')</button>' : '') +
              '</div>' +
              '</div>';
          }).join('');
          
          return '<div class="rounded-2xl bg-white border border-gray-200 p-5 shadow-lg">' +
            '<h3 class="font-extrabold text-lg text-gray-800 mb-3 border-b border-gray-100 pb-2"><i class="fas fa-book text-purple-600 mr-2"></i>' + self.esc(group.subjectName) + '</h3>' +
            '<div class="space-y-2">' + topicCards + '</div>' +
            '</div>';
        }).join('') + '</div>';
      }

      container.innerHTML = '<div class="max-w-4xl mx-auto">' +
        '<button onclick="app.showLanding()" class="text-xs font-bold text-gray-500 hover:text-green-600 mb-3 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Back to home</button>' +
        '<div class="mb-5">' +
        '<h2 class="text-2xl font-extrabold text-gray-800">Study Notes & Images Library</h2>' +
        '<p class="text-sm text-gray-500 mt-1">Browse materials across all available subjects.</p>' +
        '</div>' + contentHTML + '</div>';
    },
     
     
    showModeSelection: function (subjectId) {
      var subject = this.data.subjects[subjectId];
      if (!subject) { this.toast('Subject not found.', 'error'); return this.showCandidateOptions(); }
      this.data.currentSubjectId = subjectId;
      this.data.mode = 'mode-selection';
      this.updateHeader();
      var container = document.getElementById('app-container');
      if (!container) return;
      container.innerHTML = '<div class="max-w-3xl mx-auto">' +
        '<button onclick="app.showCandidateOptions()" class="text-xs font-bold text-gray-500 hover:text-green-600 mb-3 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> All subjects</button>' +
        '<div class="rounded-2xl bg-white border border-gray-200 p-6 md:p-8 shadow-xl">' +
        '<div class="flex items-center gap-4">' +
        '<div class="w-14 h-14 rounded-2xl bg-green-700 text-white flex items-center justify-center shrink-0"><i class="fas fa-book text-2xl"></i></div>' +
        '<div><h2 class="text-2xl font-extrabold text-gray-800">' + this.esc(subject.name) + '</h2>' +
        '<p class="text-sm text-gray-500">' + (subject.questions ? subject.questions.length : 0) + ' questions · default ' + (subject.duration || 30) + ' minutes</p></div></div>' +
        '<h3 class="mt-7 mb-3 font-bold text-gray-700">Select exam mode</h3>' +
        '<div class="grid md:grid-cols-2 gap-4">' +
        '<button onclick="app.showCandidateLogin(\'practice\',\'' + subjectId + '\')" class="text-left rounded-2xl border-2 border-blue-200 hover:border-blue-500 bg-blue-50 p-5 transition-all">' +
        '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><i class="fas fa-stopwatch"></i></div>' +
        '<h4 class="font-bold text-blue-800">Practice Mode (Timed)</h4></div>' +
        '<p class="text-sm text-gray-600 mt-2">A timed mock exam. Answers are graded at submission and the timer auto-submits at zero.</p>' +
        '<span class="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-blue-700">Start practice <i class="fas fa-arrow-right"></i></span></button>' +
        '<button onclick="app.showCandidateLogin(\'study\',\'' + subjectId + '\')" class="text-left rounded-2xl border-2 border-green-200 hover:border-green-500 bg-green-50 p-5 transition-all">' +
        '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center"><i class="fas fa-lightbulb"></i></div>' +
        '<h4 class="font-bold text-green-800">Study Mode (Learn with Explanations)</h4></div>' +
        '<p class="text-sm text-gray-600 mt-2">Untimed. Reveal the correct answer and explanation as you go, with AI-marked theory responses.</p>' +
        '<span class="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-green-700">Start studying <i class="fas fa-arrow-right"></i></span></button>' +
        '</div></div></div>';
    },

    showCandidateLogin: function (mode, subjectId) {
      var subject = this.data.subjects[subjectId];
      if (!subject) { this.toast('Subject not found.', 'error'); return this.showCandidateOptions(); }
      this.data.currentSubjectId = subjectId;
      this.data.examMode = mode;
      this.data.mode = 'mode-selection';
      this.updateHeader();
      var container = document.getElementById('app-container');
      if (!container) return;
      var topics = Array.isArray(subject.topics) ? subject.topics : [];
      var topicOptions = topics.map(function (t) {
        return '<option value="' + t.id + '">' + app.esc(t.name) + '</option>';
      }).join('');
      container.innerHTML = '<div class="max-w-2xl mx-auto">' +
        '<button onclick="app.showModeSelection(\'' + subjectId + '\')" class="text-xs font-bold text-gray-500 hover:text-green-600 mb-3 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Change mode</button>' +
        '<div class="rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">' +
        '<div class="p-6 border-b border-gray-200 ' + (mode === 'practice' ? 'bg-blue-50' : 'bg-green-50') + '">' +
        '<div class="flex items-center gap-3">' +
        '<div class="w-11 h-11 rounded-xl ' + (mode === 'practice' ? 'bg-blue-600' : 'bg-green-600') + ' text-white flex items-center justify-center"><i class="fas ' + (mode === 'practice' ? 'fa-stopwatch' : 'fa-lightbulb') + '"></i></div>' +
        '<div><h2 class="text-xl font-extrabold text-gray-800">' + (mode === 'practice' ? 'Practice Mode' : 'Study Mode') + '</h2>' +
        '<p class="text-sm text-gray-600">' + this.esc(subject.name) + ' · configure your attempt</p></div></div></div>' +
        '<form id="candidate-login-form" class="p-6 space-y-5" onsubmit="event.preventDefault(); app.startTestPrep();">' +
        '<div><label for="candidate-name" class="block text-sm font-bold text-gray-700 mb-1.5">Full Name <span class="text-red-500">*</span></label>' +
        '<input type="text" id="candidate-name" name="candidate-name" required placeholder="e.g. Ada Lovelace" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value="' + this.esc(this.data.candidateName || '') + '"></div>' +
        '<div><label for="exam-topic-select" class="block text-sm font-bold text-gray-700 mb-1.5">Topic</label>' +
        '<select id="exam-topic-select" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" onchange="app.renderCandidateSubTopics()">' + (topicOptions || '<option value="">No topics</option>') + '</select></div>' +
        (mode === 'practice' ? '<div><label for="custom-duration-input" class="block text-sm font-bold text-gray-700 mb-1.5">Custom Exam Duration <span class="text-gray-400 font-normal">(minutes, optional)</span></label>' +
          '<input type="number" min="1" max="999" id="custom-duration-input" name="custom-duration-input" placeholder="Leave empty to use default (' + (subject.duration || 30) + ' min)" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">' +
          '<p class="text-xs text-gray-500 mt-1">Blank or invalid values fall back to the subject default.</p></div>' : '') +
        '<div id="candidate-topics-container" class="rounded-xl border border-gray-200 bg-gray-50 p-4"></div>' +
        '<div class="flex items-center gap-2 text-xs text-gray-500"><i class="fas fa-circle-info"></i><span>Leave every checkbox empty to draw from the entire subject.</span></div>' +
        '<button type="submit" class="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl ' + (mode === 'practice' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700') + ' text-white font-bold shadow-lg">' +
        '<i class="fas fa-play"></i> Start ' + (mode === 'practice' ? 'Practice Exam' : 'Study Session') + '</button>' +
        '</form></div></div>';
      this.renderCandidateSubTopics();
    },

    renderCandidateSubTopics: function () {
      var subject = this.currentSubject();
      var container = document.getElementById('candidate-topics-container');
      var select = document.getElementById('exam-topic-select');
      if (!container) return;
      if (!subject || !select) { container.innerHTML = ''; return; }
      var selectedTopicId = select.value;
      var filtered = (subject.questions || []).filter(function (q) { return q.topicId === selectedTopicId; });
      if (!filtered.length) {
        container.innerHTML = '<p class="text-sm text-gray-500"><i class="fas fa-circle-exclamation mr-1.5"></i>No questions available for this topic.</p>';
        return;
      }
      var groups = {};
      filtered.forEach(function (q) {
        var key = q.subTopic || 'General';
        if (!groups[key]) groups[key] = [];
        groups[key].push(q.id);
      });
      var subNames = Object.keys(groups);
      container.innerHTML = '<div class="flex items-center justify-between gap-2 mb-3">' +
        '<h3 class="text-sm font-bold text-gray-700"><i class="fas fa-filter mr-1.5"></i>Choose sub-topics</h3>' +
        '<span class="text-xs text-gray-500">' + filtered.length + ' available</span></div>' +
        '<div class="space-y-2.5">' + subNames.map(function (name, idx) {
          var subId = 'sub_' + idx;
          var qids = groups[name];
          return '<div class="flex items-center gap-3 rounded-lg bg-white border border-gray-200 p-3">' +
            '<input type="checkbox" name="exam-topic" value="' + subId + '" data-qids="' + JSON.stringify(qids).replace(/"/g, '&quot;') + '" data-sub-topic-id="' + subId + '" id="exam-topic-' + subId + '" class="w-4 h-4 accent-green-600" onchange="app.toggleSubTopicQuantity(this)">' +
            '<label for="exam-topic-' + subId + '" class="flex-grow text-sm font-semibold text-gray-700 cursor-pointer min-w-0">' + app.esc(name) + '</label>' +
            '<div class="flex items-center gap-1.5 shrink-0">' +
            '<input type="number" class="topic-quantity w-16 px-2 py-1.5 rounded-lg border border-gray-300 text-sm text-center disabled:opacity-50" data-sub-topic-id="' + subId + '" value="' + qids.length + '" min="0" max="' + qids.length + '" disabled onchange="app.clampSubTopicQuantity(this)" oninput="app.clampSubTopicQuantity(this)">' +
            '<span class="text-xs text-gray-400">/ ' + qids.length + '</span></div></div>';
        }).join('') + '</div>';
    },

    toggleSubTopicQuantity: function (checkbox) {
      var qty = document.querySelector('.topic-quantity[data-sub-topic-id="' + checkbox.getAttribute('data-sub-topic-id') + '"]');
      if (!qty) return;
      qty.disabled = !checkbox.checked;
      if (checkbox.checked && Number(qty.value) === 0) qty.value = qty.max;
    },

    clampSubTopicQuantity: function (input) {
      var max = Number(input.max) || 0;
      var val = Number(input.value);
      if (isNaN(val)) val = 0;
      if (val < 0) val = 0;
      if (val > max) val = max;
      input.value = val;
      var checkbox = document.querySelector('input[name="exam-topic"][data-sub-topic-id="' + input.getAttribute('data-sub-topic-id') + '"]');
      if (checkbox) {
        checkbox.checked = val > 0;
        input.disabled = !checkbox.checked;
      }
    },

    shuffle: function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    },

    startTestPrep: function () {
      var subject = this.currentSubject();
      if (!subject) { this.toast('No subject selected.', 'error'); return; }
      var nameInput = document.getElementById('candidate-name');
      var name = nameInput ? nameInput.value.trim() : '';
      if (!name) { this.toast('Please enter your full name.', 'error'); if (nameInput) nameInput.focus(); return; }
      this.data.candidateName = name;
      var mode = this.data.examMode || 'practice';

      var examDuration = subject.duration || 30;
      if (mode === 'practice') {
        var durInput = document.getElementById('custom-duration-input');
        var custom = durInput ? Number(durInput.value) : NaN;
        if (custom && custom >= 1 && custom <= 999) examDuration = custom;
      }

      var questionsToUse = [];
      var checked = document.querySelectorAll('input[name="exam-topic"]:checked');
      checked.forEach(function (cb) {
        var qids = [];
        try { qids = JSON.parse(cb.getAttribute('data-qids') || '[]'); } catch (e) { qids = []; }
        var qtyInput = document.querySelector('.topic-quantity[data-sub-topic-id="' + cb.getAttribute('data-sub-topic-id') + '"]');
        var qty = qtyInput ? Number(qtyInput.value) : qids.length;
        var matching = (subject.questions || []).filter(function (q) { return qids.indexOf(q.id) !== -1; });
        app.shuffle(matching);
        questionsToUse = questionsToUse.concat(matching.slice(0, qty));
      });

      /* QUIRK PRESERVED: no subtopic checked → the ENTIRE subject is used. */
      if (!questionsToUse.length) {
        questionsToUse = subject.questions ? subject.questions.slice() : [];
      }
      questionsToUse = this.shuffle(questionsToUse);

      this.data.questions = questionsToUse;
      this.data.examDuration = mode === 'practice' ? examDuration : examDuration;
      this.data.currentQuestionIndex = 0;
      this.data.userAnswers = {};
      this.data.answerRevealed = {};
      this.data._theoryDrafts = {};
      this._lastImageRequest = {};
      this.clearExamState();
      this.data.endTime = null;
      if (mode === 'practice') {
        this.data.timeLeft = examDuration * 60;
      } else {
        this.data.timeLeft = 0;
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (mode === 'practice') this.startTimer();
      this.showTestInterface();
      this.saveExamState();
    },

    /* ---------------- exam state ---------------- */
    saveExamState: function () {
      if (this.data.mode !== 'test') return;
      try {
        localStorage.setItem('cbt_exam_state', JSON.stringify({
          questions: this.data.questions,
          userAnswers: this.data.userAnswers,
          answerRevealed: this.data.answerRevealed,
          currentIndex: this.data.currentQuestionIndex,
          endTime: this.data.endTime,
          examMode: this.data.examMode,
          candidateName: this.data.candidateName,
          currentSubjectId: this.data.currentSubjectId,
          examDuration: this.data.examDuration,
          timeLeft: this.data.timeLeft
        }));
      } catch (e) { console.warn('saveExamState failed', e); }
    },

    clearExamState: function () {
      localStorage.removeItem('cbt_exam_state');
    },

    checkForSavedExam: function () {
      var raw = localStorage.getItem('cbt_exam_state');
      if (!raw) return false;
      var state;
      try { state = JSON.parse(raw); } catch (e) { this.clearExamState(); return false; }
      if (!state || !Array.isArray(state.questions) || !state.questions.length) { this.clearExamState(); return false; }
      if (state.examMode === 'practice') {
        if (state.endTime && state.endTime < Date.now()) { this.clearExamState(); return false; }
        state.timeLeft = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
      } else {
        state.timeLeft = 0;
      }
      this._savedExamState = state;
      this.showResumePrompt(state);
      return true;
    },

    showResumePrompt: function (state) {
      this.data.mode = 'resume-prompt';
      this.updateHeader();
      var container = document.getElementById('app-container');
      if (!container) return;
      var subject = this.data.subjects[state.currentSubjectId];
      var subjectName = subject ? subject.name : 'Previous exam';
      var answered = Object.keys(state.userAnswers || {}).filter(function (k) {
        var v = state.userAnswers[k];
        return v !== undefined && v !== null && String(v).trim() !== '';
      }).length;
      var total = (state.questions || []).length;
      var isPractice = state.examMode === 'practice';
      container.innerHTML = '<div class="max-w-xl mx-auto mt-4 md:mt-10">' +
        '<div class="rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">' +
        '<div class="bg-green-700 p-6 text-white">' +
        '<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center"><i class="fas fa-clock-rotate-left text-xl"></i></div>' +
        '<div><h2 class="text-xl font-extrabold">Resume your exam?</h2><p class="text-sm text-green-100">We found an unfinished session on this device.</p></div></div></div>' +
        '<div class="p-6">' +
        '<dl class="space-y-3 text-sm">' +
        '<div class="flex justify-between gap-3 border-b border-gray-100 pb-2"><dt class="text-gray-500">Candidate</dt><dd class="font-bold text-gray-800 text-right">' + this.esc(state.candidateName || 'Candidate') + '</dd></div>' +
        '<div class="flex justify-between gap-3 border-b border-gray-100 pb-2"><dt class="text-gray-500">Subject</dt><dd class="font-bold text-gray-800 text-right">' + this.esc(subjectName) + '</dd></div>' +
        '<div class="flex justify-between gap-3 border-b border-gray-100 pb-2"><dt class="text-gray-500">Mode</dt><dd class="font-bold text-gray-800 text-right capitalize">' + this.esc(state.examMode || 'practice') + '</dd></div>' +
        '<div class="flex justify-between gap-3 border-b border-gray-100 pb-2"><dt class="text-gray-500">Progress</dt><dd class="font-bold text-gray-800 text-right">' + answered + ' / ' + total + ' answered</dd></div>' +
        (isPractice ? '<div class="flex justify-between gap-3"><dt class="text-gray-500">Time left</dt><dd class="font-bold text-amber-600 text-right">' + app.formatSeconds(state.timeLeft) + '</dd></div>' : '') +
        '</dl>' +
        '<div class="mt-6 space-y-2.5">' +
        '<button onclick="app.resumeSavedExam()" class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"><i class="fas fa-play"></i> Resume Exam</button>' +
        '<button onclick="app.discardSavedExam()" class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold"><i class="fas fa-trash"></i> Discard &amp; Start Fresh</button>' +
        '</div></div></div></div>';
    },

    formatSeconds: function (secs) {
      secs = Math.max(0, Math.round(Number(secs) || 0));
      var m = Math.floor(secs / 60);
      var s = secs % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    },

    resumeSavedExam: function () {
      var state = this._savedExamState;
      if (!state) { this.toast('No saved exam to resume.', 'error'); return this.showLanding(); }
      this.data.questions = state.questions || [];
      this.data.userAnswers = state.userAnswers || {};
      this.data.answerRevealed = state.answerRevealed || {};
      this.data._theoryDrafts = {};
      this.data.currentQuestionIndex = state.currentIndex || 0;
      this.data.endTime = state.endTime || null;
      this.data.examMode = state.examMode || 'practice';
      this.data.candidateName = state.candidateName || '';
      this.data.currentSubjectId = state.currentSubjectId;
      this.data.examDuration = state.examDuration || 30;
      if (this.data.examMode === 'practice') {
        this.data.timeLeft = Math.max(0, Math.round(((state.endTime || 0) - Date.now()) / 1000));
        if (this.data.timeLeft <= 0) {
          this.data.mode = 'test';
          this.clearExamState();
          this.showTestInterface();
          this.submitTest();
          return;
        }
        this.data.mode = 'test';
        this.showTestInterface();
        this.startTimer();
      } else {
        this.data.timeLeft = 0;
        this.data.mode = 'test';
        this.showTestInterface();
      }
      this._savedExamState = null;
    },

    discardSavedExam: function () {
      this.clearExamState();
      this._savedExamState = null;
      this.data.mode = 'landing';
      this.showLanding();
    },

    /* ---------------- images / grid ---------------- */
    showImageModal: function () {
      var subject = this.currentSubject();
      var list = (this.data.images && this.data.images[this.data.currentSubjectId]) ? this.data.images[this.data.currentSubjectId] : [];
      if (list.length) {
        imageViewer.open(list, (subject ? subject.name : 'Subject') + ' — Reference Images');
      } else {
        var modal = document.getElementById('image-modal');
        if (modal) modal.classList.remove('hidden');
        var gallery = document.getElementById('image-gallery');
        if (gallery) { gallery.innerHTML = ''; gallery.classList.add('hidden'); }
        var empty = document.getElementById('no-images-message');
        if (empty) empty.classList.remove('hidden');
        var count = document.getElementById('image-count');
        if (count) count.textContent = '0 images';
        var title = document.getElementById('image-modal-title');
        if (title) title.textContent = (subject ? subject.name : 'Subject') + ' — Reference Images';
      }
    },

    toggleMobileGrid: function () {
      var modal = document.getElementById('mobile-grid-modal');
      var container = document.getElementById('mobile-grid-container');
      if (!modal || !container) return;
      var total = this.data.questions.length;
      var html = '';
      for (var i = 0; i < total; i++) {
        var q = this.data.questions[i];
        var ans = this.data.userAnswers[q.id] !== undefined && this.data.userAnswers[q.id] !== null && String(this.data.userAnswers[q.id]).trim() !== '';
        var active = i === this.data.currentQuestionIndex;
        var cls = active ? 'bg-blue-600 text-white border-blue-700' : (ans ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300');
        html += '<button onclick="app.jumpToQuestion(' + i + '); document.getElementById(\'mobile-grid-modal\').classList.add(\'hidden\')" class="h-10 rounded-lg border font-bold text-sm ' + cls + '">' + (i + 1) + '</button>';
      }
      container.innerHTML = html;
      modal.classList.remove('hidden');
    },

    /* ---------------- init ---------------- */
    init: function () {
      this.loadData();
      this.loadResults();
      this.loadImages();
      if (window.imageViewer && typeof imageViewer.init === 'function') imageViewer.init();
      this.setupMathJaxPatch();
      if (this.checkForSavedExam()) return;
      this.showLanding();
    }
  };
})();
