/* ============================================================
   question-loader.js — parses the CBT_SUBJECT_BANKS text DSL
   into window.app.data.subjects (object keyed by subjectId)
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
      var mode = null;

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

  /* ---------- built-in study material (defaults; admin notes win) ---------- */
  function svgImage(title, subtitle, accent, type) {
    var shapes = '';
    if (type === 'pvd') {
      shapes = '<path d="M90 300 C 180 140, 260 120, 330 90" stroke="' + accent + '" stroke-width="4" fill="none"/>' +
        '<path d="M90 300 C 170 240, 250 210, 340 200" stroke="#7c3aed" stroke-width="3" stroke-dasharray="7 6" fill="none"/>' +
        '<text x="200" y="150" fill="#cbd5e1" font-size="14">isothermal</text>' +
        '<text x="235" y="235" fill="#a78bfa" font-size="14">adiabatic</text>';
    } else if (type === 'tree') {
      shapes = '<g stroke="#64748b" stroke-width="2"><line x1="200" y1="90" x2="120" y2="170"/><line x1="200" y1="90" x2="280" y2="170"/><line x1="120" y1="170" x2="80" y2="250"/><line x1="120" y1="170" x2="160" y2="250"/><line x1="280" y1="170" x2="240" y2="250"/><line x1="280" y1="170" x2="320" y2="250"/></g>' +
        '<circle cx="200" cy="90" r="16" fill="' + accent + '"/><circle cx="120" cy="170" r="12" fill="#0d9488"/><circle cx="280" cy="170" r="12" fill="#0d9488"/>' +
        '<circle cx="80" cy="250" r="9" fill="#7c3aed"/><circle cx="160" cy="250" r="9" fill="#7c3aed"/><circle cx="240" cy="250" r="9" fill="#7c3aed"/><circle cx="320" cy="250" r="9" fill="#7c3aed"/>';
    } else if (type === 'matrix') {
      shapes = '<g stroke="#334155" stroke-width="1">' +
        '<line x1="80" y1="120" x2="340" y2="120"/><line x1="80" y1="180" x2="340" y2="180"/><line x1="80" y1="240" x2="340" y2="240"/>' +
        '<line x1="120" y1="80" x2="120" y2="290"/><line x1="180" y1="80" x2="180" y2="290"/><line x1="240" y1="80" x2="240" y2="290"/><line x1="300" y1="80" x2="300" y2="290"/></g>' +
        '<polygon points="180,120 300,120 240,240 120,240" fill="' + accent + '" opacity=".35" stroke="' + accent + '" stroke-width="3"/>' +
        '<text x="88" y="108" fill="#94a3b8" font-size="12">v₁ →</text><text x="88" y="168" fill="#94a3b8" font-size="12">v₂ →</text>';
    } else {
      shapes = '<line x1="70" y1="210" x2="340" y2="210" stroke="#475569" stroke-width="3"/>' +
        '<circle cx="110" cy="210" r="8" fill="' + accent + '"/><circle cx="190" cy="210" r="8" fill="#14b8a6"/><circle cx="270" cy="210" r="8" fill="#a78bfa"/><circle cx="330" cy="210" r="8" fill="#f59e0b"/>' +
        '<text x="78" y="245" fill="#94a3b8" font-size="12">birth</text><text x="160" y="245" fill="#94a3b8" font-size="12">baptism</text><text x="243" y="245" fill="#94a3b8" font-size="12">ministry</text><text x="310" y="245" fill="#94a3b8" font-size="12">cross</text>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="320" viewBox="0 0 420 320">' +
      '<rect width="420" height="320" rx="16" fill="#0B1020"/>' +
      '<rect x="1" y="1" width="418" height="318" rx="16" fill="none" stroke="#22304F"/>' +
      '<text x="28" y="44" fill="#EAF2F6" font-family="sans-serif" font-size="18" font-weight="700">' + title + '</text>' +
      '<text x="28" y="64" fill="#8598AC" font-family="sans-serif" font-size="12">' + subtitle + '</text>' +
      shapes +
      '<text x="28" y="300" fill="#5EEAD4" font-family="sans-serif" font-size="11">eduCBT study library</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var DEFAULT_NOTES = {
    'Physics::Thermodynamics': `<h2>Thermodynamics — core notes</h2>
<p><strong>System and surroundings.</strong> A thermodynamic system is the part of the universe under study. Its boundary may allow heat or work to cross.</p>
<h3>First law</h3>
<p>Energy is conserved: \\(\\Delta U = Q - W\\), where \\(Q\\) is heat added to the system and \\(W\\) is work done <em>by</em> the system.</p>
<ul>
<li><strong>Isothermal</strong> — constant temperature, \\(\\Delta U = 0\\) for an ideal gas.</li>
<li><strong>Adiabatic</strong> — no heat exchange, \\(Q = 0\\), so \\(\\Delta U = -W\\).</li>
<li><strong>Isobaric</strong> — constant pressure, \\(W = P\\Delta V\\).</li>
<li><strong>Isochoric</strong> — constant volume, \\(W = 0\\).</li>
</ul>
<h3>Second law and entropy</h3>
<p>Spontaneous change increases total entropy. For a reversible step, \\(\\Delta S = \\frac{Q_{rev}}{T}\\), and microscopically \\(S = k_B \\ln \\Omega\\).</p>
<blockquote>Exam tip: always state the sign convention you are using before substituting into \\(\\Delta U = Q - W\\).</blockquote>`,
    'Probability::Conditional Probability': `<h2>Conditional probability &amp; Bayes</h2>
<p>The conditional probability of \\(A\\) given \\(B\\) is \\(P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}\\), provided \\(P(B) &gt; 0\\).</p>
<h3>Independence</h3>
<p>Events are independent when \\(P(A \\cap B) = P(A)P(B)\\). Equivalently, knowing \\(B\\) does not change the chance of \\(A\\).</p>
<h3>Total probability and Bayes</h3>
<p>For a partition \\(B_1, \\dots, B_n\\): \\(P(A) = \\sum_i P(A \\mid B_i)P(B_i)\\), and therefore</p>
<p>\\[P(B_j \\mid A) = \\frac{P(A \\mid B_j)P(B_j)}{\\sum_i P(A \\mid B_i)P(B_i)}\\]</p>
<ul><li>Prior × likelihood gives the posterior numerator.</li><li>The denominator is the overall evidence.</li><li>Without replacement, the sample space shrinks each draw.</li></ul>`,
    'Bible Studies::Gospels': `<h2>The Four Gospels</h2>
<p>Each Gospel presents the life, teaching, death and resurrection of Jesus with a distinct emphasis.</p>
<ul>
<li><strong>Matthew</strong> — Jesus as promised Messiah and teacher; structured in five major discourses.</li>
<li><strong>Mark</strong> — the action-paced servant; the earliest Gospel.</li>
<li><strong>Luke</strong> — the compassionate Saviour, attentive to outsiders and prayer.</li>
<li><strong>John</strong> — the divine Word; seven signs and extended discourses.</li>
</ul>
<h3>Sermon on the Mount</h3>
<p>Matthew 5–7 opens with the Beatitudes, reframes the Law around the heart, and calls disciples to love enemies and trust the Father.</p>
<blockquote>The kingdom is announced as a gift, then practised as a new way of life.</blockquote>`,
    'Linear Algebra::Matrices': `<h2>Matrices — working notes</h2>
<p>A matrix is a rectangular array of numbers acting as a linear map between coordinate spaces.</p>
<h3>Determinants</h3>
<p>For \\(\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\), \\(\\det = ad - bc\\). The map is invertible exactly when \\(\\det A \\neq 0\\).</p>
<h3>Inverses</h3>
<p>\\(A^{-1} = \\frac{1}{\\det A}\\,\\text{adj}(A)\\). Always verify \\(AA^{-1} = I\\).</p>
<ul><li>Product dimension: \\((m \\times n)(n \\times p) = m \\times p\\).</li><li>Transpose swaps rows and columns.</li><li>Singular matrices have dependent rows and non-trivial kernels.</li></ul>`
  };

  var DEFAULT_IMAGES = {
    'Physics::Thermodynamics': [
      { title: 'PV diagram', subtitle: 'Reversible expansion paths', type: 'pvd', filename: 'pv-diagram.svg' },
      { title: 'Carnot cycle', subtitle: 'Two isotherms, two adiabats', type: 'tree', filename: 'carnot-cycle.svg' }
    ],
    'Probability::Conditional Probability': [
      { title: 'Probability tree', subtitle: 'Without-replacement branches', type: 'tree', filename: 'probability-tree.svg' }
    ],
    'Bible Studies::Gospels': [
      { title: 'Gospel timeline', subtitle: 'From Bethlehem to the cross', type: 'timeline', filename: 'gospel-timeline.svg' }
    ],
    'Linear Algebra::Matrices': [
      { title: 'Linear transformation', subtitle: 'Unit square mapped by A', type: 'matrix', filename: 'linear-map.svg' }
    ]
  };

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

  function mergeSaved(newSubjects) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('cbt_subjects') || '{}') || {}; } catch (e) { saved = {}; }
    var savedList = Object.values(saved);
    var savedImages = {};
    try { savedImages = JSON.parse(localStorage.getItem('cbt_images') || '{}') || {}; } catch (e) { savedImages = {}; }
    var remappedImages = {};
    var imagesChanged = false;

    Object.values(newSubjects).forEach(function (ns) {
      var savedSub = savedList.find(function (s) { return s && s.name === ns.name; });
      if (savedSub) {
        /* reuse the persisted subject id so saved exams, images and notes keep resolving */
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

      /* seed defaults per topic where nothing was merged */
      ns.topics.forEach(function (t) {
        var key = ns.name + '::' + t.name;
        if (DEFAULT_NOTES[key] && (!ns.notes[t.id] || String(ns.notes[t.id]).trim() === '')) {
          ns.notes[t.id] = DEFAULT_NOTES[key];
        }
        if (DEFAULT_IMAGES[key] && (!ns.topicImages[t.id] || !ns.topicImages[t.id].length)) {
          ns.topicImages[t.id] = DEFAULT_IMAGES[key].map(function (spec) {
            return { data: svgImage(spec.title, spec.subtitle, '#2DD4BF', spec.type), filename: spec.filename };
          });
        }
      });
    });

    if (imagesChanged) {
      Object.keys(remappedImages).forEach(function (id) { savedImages[id] = remappedImages[id]; });
      try { localStorage.setItem('cbt_images', JSON.stringify(savedImages)); } catch (e) {}
    }
  }

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
    window.app.data.images = window.app.data.images || {};
    var savedImages = {};
    try { savedImages = JSON.parse(localStorage.getItem('cbt_images') || '{}') || {}; } catch (e) { savedImages = {}; }
    Object.keys(savedImages).forEach(function (k) { window.app.data.images[k] = savedImages[k]; });

    /* seed reference-image boards for subjects that have none (visual study aids) */
    var refTypes = { 'Physics': 'pvd', 'Probability': 'tree', 'Bible Studies': 'timeline', 'Linear Algebra': 'matrix' };
    Object.values(parsed).forEach(function (s) {
      if (!window.app.data.images[s.id] || !window.app.data.images[s.id].length) {
        window.app.data.images[s.id] = [{
          data: svgImage(s.name + ' — reference board', 'Key relationships and worked-figure overview', '#F59E0B', refTypes[s.name] || 'tree'),
          filename: (s.name || 'subject').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-reference.svg'
        }];
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

  window.parseCBTBankQuestions = parseQuestions;
  window.CBT_DEFAULT_STUDY_NOTES = DEFAULT_NOTES;
  boot();
})();
