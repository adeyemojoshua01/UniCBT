/* ============================================================
   question-loader.js — parses the CBT_SUBJECT_BANKS text DSL
   into window.app.data.subjects (object keyed by subjectId)

   Study notes and study images are supplied externally by the
   per-subject notes.js files, which set:
     window.CBT_SUBJECT_NOTES            [subjectName][topicName] → html
     window.CBT_SUBJECT_IMAGES           [subjectName][topicName] → [{data, filename}]
     window.CBT_SUBJECT_REFERENCE_IMAGES [subjectName]            → [{data, filename}]

   Those files must load BEFORE this script.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- stable topic id (so saved notes keep matching) ---------- */
  function slug(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'topic';
  }
  function topicId(name) { return 'topic_' + slug(name); }
  function uniqueSubjectId() { return 'subj_' + Date.now() + '_' + Math.floor(Math.random() * 100000); }

  /* ---------- parser ---------- */
  function parseQuestions(text) {
    var subjects = {};
    var subject = null;
    var topic = null;
    var question = null;
    var currentSubTopic = 'General';
    var explanationMode = false;

    function ensureSubject(name) {
      var id = uniqueSubjectId();
      var s = { id: id, name: String(name || 'Untitled').trim(), duration: 30, questions: [], topics: [], notes: {}, topicImages: {} };
      subjects[id] = s;
      return s;
    }
    function ensureTopic(name) {
      var tname = String(name || 'General').trim();
      var found = subject.topics.find(function (t) { return t.name.toLowerCase() === tname.toLowerCase(); });
      if (!found) {
        found = { id: topicId(tname), name: tname };
        subject.topics.push(found);
      }
      return found;
    }
    function ensureQuestion() {
      if (!subject) subject = ensureSubject('Untitled');
      if (!topic) topic = ensureTopic('General');
      if (!question) {
        question = {
          id: Date.now() + Math.random(),
          text: '',
          type: 'objective',
          correct: '',
          explanation: '',
          options: {},
          topicId: topic.id,
          subTopic: currentSubTopic || 'General',
          maxMarks: 10
        };
        subject.questions.push(question);
      }
      return question;
    }

    var lines = String(text || '').split(/\r?\n/);
    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line || line.indexOf('===') === 0) return;

      if (/^Subject\s*:/i.test(line)) {
        subject = ensureSubject(line.replace(/^Subject\s*:/i, '').trim());
        topic = null; question = null; currentSubTopic = 'General';
        return;
      }
      if (/^Duration\s*:/i.test(line)) {
        if (subject) subject.duration = Number(line.replace(/^Duration\s*:/i, '').trim()) || 30;
        return;
      }
      if (/^Topic\s*:/i.test(line)) {
        if (!subject) subject = ensureSubject('Untitled');
        topic = ensureTopic(line.replace(/^Topic\s*:/i, '').trim());
        question = null; currentSubTopic = 'General';
        return;
      }
      if (/^SubTopic\s*:/i.test(line)) {
        currentSubTopic = line.replace(/^SubTopic\s*:/i, '').trim() || 'General';
        question = null; explanationMode = false;
        return;
      }
      if (/^Type\s*:/i.test(line)) {
        if (!subject) subject = ensureSubject('Untitled');
        if (!topic) topic = ensureTopic('General');
        var typeRaw = line.replace(/^Type\s*:/i, '').trim();
        var mapped = 'objective';
        if (/theory/i.test(typeRaw)) mapped = 'theory';
        else if (/fill/i.test(typeRaw)) mapped = 'fill';
        question = {
          id: Date.now() + Math.random(),
          text: '',
          type: mapped,
          correct: '',
          explanation: '',
          options: mapped === 'objective' ? {} : null,
          topicId: topic.id,
          subTopic: currentSubTopic || 'General',
          maxMarks: 10
        };
        subject.questions.push(question);
        explanationMode = false;
        return;
      }
      if (/^Q\d+\s*:/i.test(line)) {
        var qq = ensureQuestion();
        qq.text = line.replace(/^Q\d+\s*:/i, '').trim();
        explanationMode = false;
        return;
      }
      if (/^Marks\s*:/i.test(line)) {
        var m = Number(line.replace(/^Marks\s*:/i, '').trim());
        if (question && !isNaN(m)) question.maxMarks = m;
        explanationMode = false;
        return;
      }
      if (/^Option\s*:/i.test(line)) {
        var qo = ensureQuestion();
        if (!qo.options) qo.options = {};
        var rest = line.replace(/^Option\s*:/i, '').trim();
        var mm = rest.match(/^([A-Da-d])\s*:\s*([\s\S]*)$/);
        if (mm) {
          qo.options[mm[1].toUpperCase()] = mm[2].trim();
        } else if (rest) {
          var letters = ['A', 'B', 'C', 'D'];
          var next = letters.filter(function (l) { return qo.options[l] === undefined; })[0];
          if (next) qo.options[next] = rest;
        }
        explanationMode = false;
        return;
      }
      if (/^Answer\s*:/i.test(line)) {
        if (question) question.correct = line.replace(/^Answer\s*:/i, '').trim();
        explanationMode = false;
        return;
      }
      if (/^Explanation\s*:/i.test(line)) {
        if (question) question.explanation = line.replace(/^Explanation\s*:/i, '').trim();
        explanationMode = true;
        return;
      }
      /* bare A: option lines */
      var bare = line.match(/^([A-D])\s*:\s*(.+)$/);
      if (!explanationMode && bare && question && question.type === 'objective') {
        if (!question.options) question.options = {};
        question.options[bare[1]] = bare[2].trim();
        return;
      }
      /* explanation continuation */
      if (explanationMode && question) {
        question.explanation = (question.explanation ? question.explanation + ' ' : '') + line;
      }
    });

    /* acceptance rules */
    Object.keys(subjects).forEach(function (sid) {
      var s = subjects[sid];
      s.questions = s.questions.filter(function (q) {
        if (!q) return false;
        if (q.type === 'objective') return q.options && Object.keys(q.options).length >= 2 && !!q.correct;
        if (q.type === 'fill') return !!q.correct;
        return !!q.text;
      });
      /* drop questions whose topic vanished */
      var validTopics = {};
      s.topics.forEach(function (t) { validTopics[t.id] = true; });
      s.questions.forEach(function (q) {
        if (!validTopics[q.topicId]) {
          var t = { id: q.topicId, name: 'General' };
          s.topics.push(t);
          validTopics[q.topicId] = true;
        }
      });
      if (!s.topics.length) s.topics.push({ id: topicId('General'), name: 'General' });
    });

    return subjects;
  }

  /* ---------- boot ---------- */
  function boot() {
    var tries = 0;
    var interval = setInterval(function () {
      tries++;
      var ready = window.app && window.app.data;
      var banks = window.CBT_SUBJECT_BANKS;
      if (ready && Array.isArray(banks) && banks.length) {
        clearInterval(interval);
        try { load(); } catch (e) { console.error('question-loader.js: parse failed', e); }
      } else if (tries >= 50) {
        clearInterval(interval);
        console.error('question-loader.js: timed out waiting for app / banks.');
      }
    }, 100);
  }

  /* ---------- merge saved notes/images + external per-subject files ---------- */
  function mergeSaved(newSubjects) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('cbt_subjects') || '{}') || {}; } catch (e) { saved = {}; }
    var savedList = Object.values(saved);

    var savedImages = {};
    try { savedImages = JSON.parse(localStorage.getItem('cbt_images') || '{}') || {}; } catch (e) { savedImages = {}; }

    var remappedImages = {};
    var imagesChanged = false;

    var EXT_NOTES  = window.CBT_SUBJECT_NOTES  || {};
    var EXT_IMAGES = window.CBT_SUBJECT_IMAGES || {};

    Object.values(newSubjects).forEach(function (ns) {
      var savedSub = savedList.find(function (s) { return s && s.name === ns.name; });

      if (savedSub) {
        /* reuse persisted subject id so saved exams, images and notes keep resolving */
        if (savedSub.id) ns.id = savedSub.id;

        if (savedSub.notes && typeof savedSub.notes === 'object') {
          Object.keys(savedSub.notes).forEach(function (k) {
            if (savedSub.notes[k] && String(savedSub.notes[k]).trim() !== '') ns.notes[k] = savedSub.notes[k];
          });
        }
        if (savedSub.topicImages && typeof savedSub.topicImages === 'object') {
          Object.keys(savedSub.topicImages).forEach(function (k) {
            if (Array.isArray(savedSub.topicImages[k]) && savedSub.topicImages[k].length) ns.topicImages[k] = savedSub.topicImages[k];
          });
        }
        if (savedImages[savedSub.id] && Array.isArray(savedImages[savedSub.id]) && savedImages[savedSub.id].length) {
          remappedImages[ns.id] = savedImages[savedSub.id];
          imagesChanged = true;
        }
      }

      /* fall back to the external per-subject notes.js payloads */
      var subNotes  = EXT_NOTES[ns.name]  || {};
      var subImages = EXT_IMAGES[ns.name] || {};

      ns.topics.forEach(function (t) {
        if (subNotes[t.name] && (!ns.notes[t.id] || String(ns.notes[t.id]).trim() === '')) {
          ns.notes[t.id] = subNotes[t.name];
        }
        if (subImages[t.name] && (!ns.topicImages[t.id] || !ns.topicImages[t.id].length)) {
          ns.topicImages[t.id] = subImages[t.name].slice();
        }
      });
    });

    if (imagesChanged) {
      Object.keys(remappedImages).forEach(function (id) { savedImages[id] = remappedImages[id]; });
      try { localStorage.setItem('cbt_images', JSON.stringify(savedImages)); } catch (e) {}
    }
  }

  /* ---------- load ---------- */
  function load() {
    var text = window.CBT_SUBJECT_BANKS.join('\n');
    var parsed = parseQuestions(text);
    var count = 0;
    Object.keys(parsed).forEach(function (id) { count += parsed[id].questions.length; });
    if (!Object.keys(parsed).length) {
      console.warn('question-loader.js: no subjects parsed from banks.');
      return;
    }
    mergeSaved(parsed);

    /* rebuild the keyed object because mergeSaved may reuse persisted subject ids */
    var rebuilt = {};
    Object.values(parsed).forEach(function (s) { rebuilt[s.id] = s; });
    parsed = rebuilt;

    window.app.data.subjects = parsed;
    window.app.saveSubjects();

    var ids = Object.keys(parsed);
    if (!window.app.data.currentSubjectId || !parsed[window.app.data.currentSubjectId]) {
      window.app.data.currentSubjectId = ids[0];
    }

    /* merge any persisted subject-level reference images */
    window.app.data.images = window.app.data.images || {};
    var savedImages = {};
    try { savedImages = JSON.parse(localStorage.getItem('cbt_images') || '{}') || {}; } catch (e) { savedImages = {}; }
    Object.keys(savedImages).forEach(function (k) { window.app.data.images[k] = savedImages[k]; });

    /* seed reference-image boards from the external notes.js files */
    var refBoards = window.CBT_SUBJECT_REFERENCE_IMAGES || {};
    Object.values(parsed).forEach(function (s) {
      if (!window.app.data.images[s.id] || !window.app.data.images[s.id].length) {
        if (refBoards[s.name] && refBoards[s.name].length) {
          window.app.data.images[s.id] = refBoards[s.name].slice();
        }
      }
    });

    if (typeof window.app.saveImages === 'function') window.app.saveImages();
    window.app.data.refreshLocked = false;

    console.log('✅ question-loader.js: loaded ' + count + ' questions.');
    if (window.app.data.mode === 'landing') {
      var container = document.getElementById('app-container');
      if (container && container.innerHTML.trim() !== '') window.app.showLanding();
    }
  }

  /* ---------- public API (kept for backwards compatibility) ---------- */
  window.parseCBTBankQuestions = parseQuestions;
  /* kept as empty objects so any external code referencing them does not crash */
  window.CBT_DEFAULT_STUDY_NOTES = window.CBT_DEFAULT_STUDY_NOTES || {};

  boot();
})();
