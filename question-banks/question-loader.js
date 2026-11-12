/* ==========================================================================
   question-loader.js — parses the bank text DSL into app.data.subjects
   MUST be loaded after ALL *-bank.js files.
   ========================================================================== */
(function () {
  'use strict';

  var TYPE_MAP = { mcq: 'objective', theory: 'theory', fill: 'fill' };
  var usedQuestionIds = new Set();
  var idCounter = 0;

  // Date.now() + Math.random() only has ~4096 distinct values per millisecond,
  // so guard against collisions explicitly.
  function newQuestionId() {
    var id;
    do { id = Date.now() + Math.random(); } while (usedQuestionIds.has(id));
    usedQuestionIds.add(id);
    return id;
  }
  function rid(prefix) {
    idCounter++;
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + idCounter;
  }
  function normLetter(v) {
    var s = String(v).trim();
    var m = s.match(/^\(?([A-Za-z])\)?(?:[\s.:\-)]|$)/);
    return m ? m[1].toUpperCase() : s.toUpperCase();
  }

  /* ---------------------------------------------------------------------- *
   *  DSL parser
   * ---------------------------------------------------------------------- */
  function parseQuestions(text) {
    var subjects = {};
    var subj = null;
    var topic = null;
    var subTopic = 'General';
    var q = null;
    var inExp = false;

    function ensureSubject(name) {
      subj = {
        id: rid('subj'),
        name: name || 'Untitled Subject',
        duration: 30,
        questions: [],
        topics: [],
        notes: {},
        topicImages: {}
      };
      subjects[subj.id] = subj;
      topic = null;
      subTopic = 'General';
      return subj;
    }
    function ensureTopic(name) {
      if (!subj) ensureSubject('Untitled Subject');
      var t = subj.topics.find(function (x) { return x.name === name; });
      if (!t) { t = { id: rid('topic'), name: name }; subj.topics.push(t); }
      return t;
    }
    function startQuestion(type) {
      if (!subj) ensureSubject('Untitled Subject');
      if (!topic) topic = ensureTopic('General');
      q = {
        id: newQuestionId(),
        text: '',
        type: type,
        correct: '',
        explanation: '',
        options: type === 'objective' ? {} : null,
        topicId: topic.id,
        subTopic: subTopic || 'General',
        maxMarks: 10
      };
      inExp = false;
    }
    function finish() {
      if (!q) return;
      var ok = false;
      if (q.type === 'objective') ok = !!q.options && Object.keys(q.options).length >= 2 && !!q.correct;
      else if (q.type === 'fill') ok = !!q.correct;
      else ok = !!q.text;
      if (ok) {
        if (q.type !== 'objective') q.options = null;
        subj.questions.push(q);
      } else {
        console.warn('question-loader.js: skipped an incomplete ' + q.type + ' question:', (q.text || '').slice(0, 60));
      }
      q = null;
      inExp = false;
    }

    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.indexOf('===') === 0) return;
      var m;

      if ((m = line.match(/^Subject:\s*(.*)$/i))) { finish(); ensureSubject(m[1].trim()); return; }
      if (!q && (m = line.match(/^Duration:\s*(\d+)/i))) { if (subj) subj.duration = parseInt(m[1], 10) || 30; return; }
      if ((m = line.match(/^Topic:\s*(.*)$/i))) { finish(); topic = ensureTopic(m[1].trim()); subTopic = 'General'; return; }
      if ((m = line.match(/^SubTopic:\s*(.*)$/i))) { finish(); subTopic = m[1].trim() || 'General'; return; }
      if ((m = line.match(/^Type:\s*(MCQ|Theory|Fill)\b/i))) { finish(); startQuestion(TYPE_MAP[m[1].toLowerCase()]); return; }
      if ((m = line.match(/^Q\d+:\s*(.*)$/i))) {
        if (!q) { console.warn('question-loader.js: question text without a preceding Type: line'); return; }
        q.text = m[1].trim();
        inExp = false;
        return;
      }
      if ((m = line.match(/^Marks:\s*(\d+)/i))) { if (q) q.maxMarks = parseInt(m[1], 10) || 10; return; }
      if ((m = line.match(/^Option:\s*([A-Za-z])\s*[:.)]\s*(.*)$/i))) {
        if (q && q.type === 'objective') { q.options[m[1].toUpperCase()] = m[2].trim(); inExp = false; }
        return;
      }
      if (q && q.type === 'objective' && !inExp && (m = line.match(/^([A-H])\s*[:.)]\s*(.*)$/))) {
        q.options[m[1].toUpperCase()] = m[2].trim();
        return;
      }
      if ((m = line.match(/^Answer:\s*(.*)$/i))) {
        if (q) q.correct = q.type === 'objective' ? normLetter(m[1]) : m[1].trim();
        inExp = false;
        return;
      }
      if ((m = line.match(/^Explanation:\s*(.*)$/i))) {
        if (q) { q.explanation = m[1].trim(); inExp = true; }
        return;
      }

      // continuation lines
      if (q && inExp) { q.explanation += (q.explanation ? ' ' : '') + line; return; }
      if (q && q.text && !(q.options && Object.keys(q.options).length) && !q.correct) { q.text += '\n' + line; }
    });
    finish();
    return subjects;
  }
  window.parseQuestions = parseQuestions;

  /* ---------------------------------------------------------------------- *
   *  Merge admin-added notes / topic images from the SAVED subjects, BY NAME.
   *  (Topic / subject ids are re-used so the note keys keep lining up.)
   * ---------------------------------------------------------------------- */
  function mergeSaved(newSubjects) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('cbt_subjects') || '{}') || {}; } catch (e) { saved = {}; }
    var savedList = Object.values(saved).filter(Boolean);
    var usedOld = new Set();
    var merged = {};

    Object.values(newSubjects).forEach(function (ns) {
      var old = savedList.find(function (s) { return s.name === ns.name && !usedOld.has(s.id); });
      if (old) {
        usedOld.add(old.id);
        var oldTopics = old.topics || [];
        var idMap = {};
        ns.topics.forEach(function (t) {
          var ot = oldTopics.find(function (x) { return x.name === t.name; });
          if (ot) { idMap[t.id] = ot.id; t.id = ot.id; }
        });
        ns.questions.forEach(function (qq) { if (idMap[qq.topicId]) qq.topicId = idMap[qq.topicId]; });
        if (old.id) ns.id = old.id;
        if (old.notes) ns.notes = old.notes;
        if (old.topicImages) ns.topicImages = old.topicImages;
      }
      merged[ns.id] = ns;
    });
    return merged;
  }

  /* ---------------------------------------------------------------------- *
   *  Runtime: poll every 100 ms (max 50 tries = 5 s)
   * ---------------------------------------------------------------------- */
  function load() {
    var text = window.CBT_SUBJECT_BANKS.join('\n');
    var parsed = parseQuestions(text);
    var merged = mergeSaved(parsed);
    window.app.data.subjects = merged;
    window.app.saveSubjects();

    var count = 0;
    Object.values(merged).forEach(function (s) { count += s.questions.length; });
    console.log('✅ question-loader.js: loaded ' + count + ' questions.');

    var cont = document.getElementById('app-container');
    if (window.app.data.mode === 'landing' && cont && cont.innerHTML.trim() !== '') {
      window.app.showLanding();
    }
  }

  var tries = 0;
  var poll = setInterval(function () {
    tries++;
    var ready = window.app && window.app.data &&
                Array.isArray(window.CBT_SUBJECT_BANKS) && window.CBT_SUBJECT_BANKS.length > 0;
    if (ready) {
      clearInterval(poll);
      load();
    } else if (tries >= 50) {
      clearInterval(poll);
      console.warn('question-loader.js: gave up waiting for app / question banks.');
    }
  }, 100);
})();
