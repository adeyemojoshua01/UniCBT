/* ============================================================
   question-loader.js — parses the CBT_SUBJECT_BANKS text DSL
   ============================================================ */
(function () {
  'use strict';

  function slug(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'topic';
  }
  function topicId(name) { return 'topic_' + slug(name); }
  function uniqueSubjectId() { return 'subj_' + Date.now() + '_' + Math.floor(Math.random() * 100000); }

  function parseQuestions(text) {
    var subjects = {};
    var subject = null, topic = null, question = null;
    var currentSubTopic = 'General', explanationMode = false;

    function ensureSubject(name) {
      var sname = String(name || 'Untitled').trim();
      // Check if subject already exists and MERGE it
      var existingId = Object.keys(subjects).find(function(id) {
        return subjects[id].name.toLowerCase() === sname.toLowerCase();
      });
      if (existingId) return subjects[existingId];
      
      var id = uniqueSubjectId();
      var s = { id: id, name: sname, duration: 30, questions: [], topics: [], notes: {}, topicImages: {} };
      subjects[id] = s;
      return s;
    }
    function ensureTopic(name) {
      var tname = String(name || 'General').trim();
      var found = subject.topics.find(function (t) { return t.name.toLowerCase() === tname.toLowerCase(); });
      if (!found) { found = { id: topicId(tname), name: tname }; subject.topics.push(found); }
      return found;
    }
    function ensureQuestion() {
      if (!subject) subject = ensureSubject('Untitled');
      if (!topic) topic = ensureTopic('General');
      if (!question) {
        question = { id: Date.now() + Math.random(), text: '', type: 'objective', correct: '', explanation: '', options: {}, topicId: topic.id, subTopic: currentSubTopic || 'General', maxMarks: 10 };
        subject.questions.push(question);
      }
      return question;
    }

    var lines = String(text || '').split(/\r?\n/);
    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line || line.indexOf('===') === 0) return;

      if (/^Subject\s*:/i.test(line)) { subject = ensureSubject(line.replace(/^Subject\s*:/i, '').trim()); topic = null; question = null; currentSubTopic = 'General'; return; }
      if (/^Duration\s*:/i.test(line)) { if (subject) subject.duration = Number(line.replace(/^Duration\s*:/i, '').trim()) || 30; return; }
      if (/^Topic\s*:/i.test(line)) { if (!subject) subject = ensureSubject('Untitled'); topic = ensureTopic(line.replace(/^Topic\s*:/i, '').trim()); question = null; currentSubTopic = 'General'; return; }
      if (/^SubTopic\s*:/i.test(line)) { currentSubTopic = line.replace(/^SubTopic\s*:/i, '').trim() || 'General'; question = null; explanationMode = false; return; }
      if (/^Type\s*:/i.test(line)) {
        if (!subject) subject = ensureSubject('Untitled'); if (!topic) topic = ensureTopic('General');
        var typeRaw = line.replace(/^Type\s*:/i, '').trim(); var mapped = 'objective';
        if (/theory/i.test(typeRaw)) mapped = 'theory'; else if (/fill/i.test(typeRaw)) mapped = 'fill';
        question = { id: Date.now() + Math.random(), text: '', type: mapped, correct: '', explanation: '', options: mapped === 'objective' ? {} : null, topicId: topic.id, subTopic: currentSubTopic || 'General', maxMarks: 10 };
        subject.questions.push(question); explanationMode = false; return;
      }
      if (/^Q\d+\s*:/i.test(line)) { var qq = ensureQuestion(); qq.text = line.replace(/^Q\d+\s*:/i, '').trim(); explanationMode = false; return; }
      if (/^Marks\s*:/i.test(line)) { var m = Number(line.replace(/^Marks\s*:/i, '').trim()); if (question && !isNaN(m)) question.maxMarks = m; explanationMode = false; return; }
      if (/^Option\s*:/i.test(line)) {
        var qo = ensureQuestion(); if (!qo.options) qo.options = {};
        var rest = line.replace(/^Option\s*:/i, '').trim(); var mm = rest.match(/^([A-Da-d])\s*:\s*([\s\S]*)$/);
        if (mm) qo.options[mm[1].toUpperCase()] = mm[2].trim(); else if (rest) {
          var letters = ['A', 'B', 'C', 'D']; var next = letters.filter(function (l) { return qo.options[l] === undefined; })[0]; if (next) qo.options[next] = rest;
        } explanationMode = false; return;
      }
      if (/^Answer\s*:/i.test(line)) { if (question) question.correct = line.replace(/^Answer\s*:/i, '').trim(); explanationMode = false; return; }
      if (/^Explanation\s*:/i.test(line)) { if (question) question.explanation = line.replace(/^Explanation\s*:/i, '').trim(); explanationMode = true; return; }
      var bare = line.match(/^([A-D])\s*:\s*(.+)$/);
      if (!explanationMode && bare && question && question.type === 'objective') { if (!question.options) question.options = {}; question.options[bare[1]] = bare[2].trim(); return; }
      if (explanationMode && question) { question.explanation = (question.explanation ? question.explanation + ' ' : '') + line; }
    });

    Object.keys(subjects).forEach(function (sid) {
      var s = subjects[sid];
      s.questions = s.questions.filter(function (q) {
        if (!q) return false;
        if (q.type === 'objective') return q.options && Object.keys(q.options).length >= 2 && !!q.correct;
        if (q.type === 'fill') return !!q.correct;
        return !!q.text;
      });
      var validTopics = {}; s.topics.forEach(function (t) { validTopics[t.id] = true; });
      s.questions.forEach(function (q) { if (!validTopics[q.topicId]) { s.topics.push({ id: q.topicId, name: 'General' }); validTopics[q.topicId] = true; } });
      if (!s.topics.length) s.topics.push({ id: topicId('General'), name: 'General' });
    });
    return subjects;
  }

  function boot() {
    var tries = 0;
    var interval = setInterval(function () {
      tries++;
      var ready = window.app && window.app.data;
      var banks = window.CBT_SUBJECT_BANKS;
      if (ready && Array.isArray(banks) && banks.length) {
        clearInterval(interval); try { load(); } catch (e) { console.error('question-loader.js: parse failed', e); }
      } else if (tries >= 50) { clearInterval(interval); console.error('question-loader.js: timed out.'); }
    }, 100);
  }

  function mergeSaved(newSubjects) {
    var saved = {}; try { saved = JSON.parse(localStorage.getItem('cbt_subjects') || '{}') || {}; } catch (e) { saved = {}; }
    var savedList = Object.values(saved);
    var savedImages = {}; try { savedImages = JSON.parse(localStorage.getItem('cbt_images') || '{}') || {}; } catch (e) { savedImages = {}; }
    var remappedImages = {}, imagesChanged = false;

    var EXT_NOTES  = window.CBT_SUBJECT_NOTES  || {};
    var EXT_IMAGES = window.CBT_SUBJECT_IMAGES || {};

    Object.values(newSubjects).forEach(function (ns) {
      var savedSub = savedList.find(function (s) { return s && s.name === ns.name; });
      if (savedSub) {
        if (savedSub.id) ns.id = savedSub.id;
        if (savedSub.notes && typeof savedSub.notes === 'object') { Object.keys(savedSub.notes).forEach(function (k) { if (savedSub.notes[k] && String(savedSub.notes[k]).trim() !== '') ns.notes[k] = savedSub.notes[k]; }); }
        if (savedSub.topicImages && typeof savedSub.topicImages === 'object') { Object.keys(savedSub.topicImages).forEach(function (k) { if (Array.isArray(savedSub.topicImages[k]) && savedSub.topicImages[k].length) ns.topicImages[k] = savedSub.topicImages[k]; }); }
        if (savedImages[savedSub.id] && Array.isArray(savedImages[savedSub.id]) && savedImages[savedSub.id].length) { remappedImages[ns.id] = savedImages[savedSub.id]; imagesChanged = true; }
      }

      var subNotes  = EXT_NOTES[ns.name]  || {};
      var subImages = EXT_IMAGES[ns.name] || {};

      Object.keys(subNotes).forEach(function(topicName) {
        var existingTopic = ns.topics.find(function(t) { return t.name.toLowerCase() === topicName.toLowerCase(); });
        if (!existingTopic) { existingTopic = { id: topicId(topicName), name: topicName }; ns.topics.push(existingTopic); }
        ns.notes[existingTopic.id] = subNotes[topicName];
      });

      Object.keys(subImages).forEach(function(topicName) {
        var existingTopic = ns.topics.find(function(t) { return t.name.toLowerCase() === topicName.toLowerCase(); });
        if (!existingTopic) { existingTopic = { id: topicId(topicName), name: topicName }; ns.topics.push(existingTopic); }
        ns.topicImages[existingTopic.id] = subImages[topicName].slice();
      });
    });

    if (imagesChanged) { Object.keys(remappedImages).forEach(function (id) { savedImages[id] = remappedImages[id]; }); try { localStorage.setItem('cbt_images', JSON.stringify(savedImages)); } catch (e) {} }
  }

  function load() {
    var text = window.CBT_SUBJECT_BANKS.join('\n');
    var parsed = parseQuestions(text);
    var count = 0; Object.keys(parsed).forEach(function (id) { count += parsed[id].questions.length; });
    if (!Object.keys(parsed).length) { console.warn('question-loader.js: no subjects parsed.'); return; }
    
    mergeSaved(parsed);

    var rebuilt = {}; Object.values(parsed).forEach(function (s) { rebuilt[s.id] = s; }); parsed = rebuilt;

    window.app.data.subjects = parsed;
    window.app.saveSubjects();

    var ids = Object.keys(parsed);
    if (!window.app.data.currentSubjectId || !parsed[window.app.data.currentSubjectId]) { window.app.data.currentSubjectId = ids[0]; }

    window.app.data.images = window.app.data.images || {};
    var savedImages = {}; try { savedImages = JSON.parse(localStorage.getItem('cbt_images') || '{}') || {}; } catch (e) { savedImages = {}; }
    Object.keys(savedImages).forEach(function (k) { window.app.data.images[k] = savedImages[k]; });

    if (typeof window.app.saveImages === 'function') window.app.saveImages();
    window.app.data.refreshLocked = false;

    console.log('✅ question-loader.js: loaded ' + count + ' questions.');
    if (window.app.data.mode === 'landing') {
      var container = document.getElementById('app-container');
      if (container && container.innerHTML.trim() !== '') window.app.showLanding();
    }
  }

  window.parseCBTBankQuestions = parseQuestions;
  boot();
})();
