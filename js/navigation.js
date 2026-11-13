/* ============================================================
   navigation.js — back-button / history manager
   Boots once window.app exists (retries every 100 ms).
   ============================================================ */
(function () {
  'use strict';

  var nav = { stack: ['landing'], _suppress: false, _booted: false };
  window.cbtNav = nav;

  var tries = 0;
  var timer = setInterval(function () {
    if (window.app && typeof app.showLanding === 'function' && typeof app.startTestPrep === 'function') {
      clearInterval(timer);
      boot();
    } else if (++tries > 60) {
      clearInterval(timer);
      console.warn('navigation.js: timed out waiting for app.');
    }
  }, 100);

  function stateFor(screen, state) {
    var s = { screen: screen };
    if (state) Object.keys(state).forEach(function (k) { s[k] = state[k]; });
    return s;
  }

  nav.push = function (screenKey, state, renderFn) {
    if (this._suppress) { if (typeof renderFn === 'function') renderFn(); return; }
    var top = this.stack[this.stack.length - 1];
    if (top !== screenKey) this.stack.push(screenKey);
    try { history.pushState(stateFor(screenKey, state), '', '#' + screenKey); } catch (e) {}
    if (typeof renderFn === 'function') renderFn();
  };

  nav.replace = function (screenKey, state, renderFn) {
    if (this._suppress) { if (typeof renderFn === 'function') renderFn(); return; }
    this.stack[this.stack.length - 1] = screenKey;
    try { history.replaceState(stateFor(screenKey, state), '', '#' + screenKey); } catch (e) {}
    if (typeof renderFn === 'function') renderFn();
  };

  nav.handlePop = function (state) {
    var screen = state && state.screen ? state.screen : 'landing';
    this._suppress = true;
    try {
      switch (screen) {
        case 'landing':
          app.showLanding();
          break;
        case 'candidate-options':
          app.showCandidateOptions();
          break;
        case 'mode-selection':
          if (state.subjectId && typeof app.showModeSelection === 'function') app.showModeSelection(state.subjectId);
          else app.showCandidateOptions();
          break;
        case 'all-notes':
          app.showAllNotes();
          break;
        case 'login-practice':
          if (state.subjectId) app.showCandidateLogin('practice', state.subjectId);
          else app.showCandidateOptions();
          break;
        case 'login-study':
          if (state.subjectId) app.showCandidateLogin('study', state.subjectId);
          else app.showCandidateOptions();
          break;
        case 'notes-browser':
          if (state.subjectId) app.showSubjectNotes(state.subjectId);
          else app.showLanding();
          break;
        case 'result':
          if (app.data.lastResults) app.showSimplifiedResult(app.data.lastResults.score, app.data.lastResults.total, app.data.lastResults.percentage);
          else app.showLanding();
          break;
        case 'review':
          if (app.data.lastResults) app.showFullReview();
          else app.showLanding();
          break;
        case 'test':
          if (app.data.mode === 'test') {
            try { history.pushState({ screen: 'test' }, '', '#test'); } catch (e) {}
            window.alert('Use the submit button to finish the exam. The back button is locked during a test.');
          } else {
            app.showLanding();
          }
          break;
        default:
          app.showLanding();
      }
    } finally {
      var self = this;
      setTimeout(function () { self._suppress = false; }, 0);
    }
  };

  function wrap(name, maker) {
    if (typeof app[name] !== 'function') return;
    var original = app[name];
    app[name] = function () {
      var args = Array.prototype.slice.call(arguments);
      if (nav._suppress) return original.apply(app, args);
      var spec = maker(args);
      return nav[spec.type](spec.screen, spec.state, function () {
        return original.apply(app, args);
      });
    };
  }

  function boot() {
    if (nav._booted) return;
    nav._booted = true;

    wrap('showLanding', function () { return { type: 'replace', screen: 'landing', state: {} }; });
    wrap('showCandidateOptions', function () { return { type: 'push', screen: 'candidate-options', state: {} }; });
    wrap('showModeSelection', function (args) { return { type: 'push', screen: 'mode-selection', state: { subjectId: args[0] } }; });
     wrap('showAllNotes', function () { return { type: 'push', screen: 'all-notes', state: {} }; });
    wrap('showCandidateLogin', function (args) {
      var mode = args[0] || 'practice';
      return { type: 'push', screen: 'login-' + mode, state: { mode: mode, subjectId: args[1] } };
    });
    wrap('showSubjectNotes', function (args) { return { type: 'push', screen: 'notes-browser', state: { subjectId: args[0] } }; });
    wrap('showSimplifiedResult', function (args) {
      return { type: 'replace', screen: 'result', state: { score: args[0], total: args[1], percentage: args[2] } };
    });
    wrap('showFullReview', function () { return { type: 'push', screen: 'review', state: {} }; });
    wrap('showTestInterface', function () { return { type: 'push', screen: 'test', state: {} }; });

    window.addEventListener('popstate', function (e) {
      if (window.app && app.data && app.data.mode === 'test') {
        try { history.pushState({ screen: 'test' }, '', '#test'); } catch (err) {}
        var leave = window.confirm('Leave the exam? Your answers will be lost.');
        if (leave) {
          app.clearExamState();
          app.stopTimer();
          app.data.questions = [];
          app.data.userAnswers = {};
          app.data.answerRevealed = {};
          app.data.mode = 'landing';
          nav.stack = ['landing'];
          nav._suppress = true;
          app.showLanding();
          setTimeout(function () { nav._suppress = false; }, 0);
        }
        return;
      }
      var target = e.state && e.state.screen ? e.state.screen : 'landing';
      var idx = nav.stack.lastIndexOf(target);
      if (idx >= 0) nav.stack = nav.stack.slice(0, idx + 1);
      else nav.stack = [target];
      nav.handlePop(e.state);
    });

    try { history.replaceState({ screen: 'landing' }, '', '#landing'); } catch (e) {}
    nav._suppress = true;
    app.showLanding();
    setTimeout(function () { nav._suppress = false; }, 0);
  }
})();
