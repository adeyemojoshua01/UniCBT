/* ==========================================================================
   navigation.js — back-button / history manager
   Boots AFTER window.app exists (retries every 100 ms).
   ========================================================================== */
(function () {
  'use strict';

  let attempts = 0;

  function boot() {
    const app = window.app;
    if (!app ||
        typeof app.showLanding !== 'function' ||
        typeof app.showCandidateOptions !== 'function' ||
        typeof app.showFullReview !== 'function' ||
        typeof app.showTestInterface !== 'function') {
      if (++attempts < 300) setTimeout(boot, 100);
      return;
    }
    if (app._navInstalled) return;
    app._navInstalled = true;

    const nav = {
      stack: ['landing'],
      _suppress: false,
      _booted: false,

      push(screenKey, state, renderFn) {
        if (!this._suppress && this._booted && this.stack[this.stack.length - 1] !== screenKey) {
          this.stack.push(screenKey);
          history.pushState(Object.assign({ screen: screenKey }, state || {}), '', '#' + screenKey);
        }
        if (renderFn) renderFn();
      },

      replace(screenKey, state, renderFn) {
        if (!this._suppress && this._booted) {
          this.stack[this.stack.length - 1] = screenKey;
          history.replaceState(Object.assign({ screen: screenKey }, state || {}), '', '#' + screenKey);
        }
        if (renderFn) renderFn();
      },

      handlePop(state) {
        state = state || { screen: 'landing' };
        this._suppress = true;
        try {
          switch (state.screen) {
            case 'landing': app.showLanding(); break;
            case 'candidate-options': app.showCandidateOptions(); break;
            case 'mode-selection':
              state.subjectId ? app.showModeSelection(state.subjectId) : app.showCandidateOptions(); break;
            case 'login-practice':
              state.subjectId ? app.showCandidateLogin('practice', state.subjectId) : app.showCandidateOptions(); break;
            case 'login-study':
              state.subjectId ? app.showCandidateLogin('study', state.subjectId) : app.showCandidateOptions(); break;
            case 'notes-browser':
              state.subjectId ? app.showSubjectNotes(state.subjectId) : app.showLanding(); break;
            case 'result':
              if (app.data.lastResults) {
                const r = app.data.lastResults;
                app.showSimplifiedResult(r.score, r.total, r.percentage);
              } else app.showLanding();
              break;
            case 'review':
              app.data.lastResults ? app.showFullReview() : app.showLanding(); break;
            case 'test':
              if (app.data.mode === 'test') {
                history.pushState({ screen: 'test' }, '', '#test');
                app.toast('Finish or submit your exam before leaving.', 'error');
              } else app.showLanding();
              break;
            default: app.showLanding();
          }
        } finally {
          setTimeout(() => { nav._suppress = false; }, 0);
        }
      }
    };
    window.cbtNav = nav;

    /* ---------- wrap app.* methods ---------- */
    function wrap(name, fn) {
      const orig = app[name];
      if (typeof orig !== 'function') return;
      app[name] = function () {
        const self = this;
        const args = arguments;
        const run = function () { return orig.apply(self, args); };
        return fn(args, run);
      };
    }

    wrap('showLanding', (a, run) => nav.replace('landing', {}, run));
    wrap('showCandidateOptions', (a, run) => nav.push('candidate-options', {}, run));
    wrap('showModeSelection', (a, run) => nav.push('mode-selection', { subjectId: a[0] }, run));
    wrap('showCandidateLogin', (a, run) => nav.push('login-' + a[0], { mode: a[0], subjectId: a[1] }, run));
    wrap('showSubjectNotes', (a, run) => nav.push('notes-browser', { subjectId: a[0] }, run));
    wrap('showSimplifiedResult', (a, run) => nav.replace('result', { score: a[0] }, run));
    wrap('showFullReview', (a, run) => nav.push('review', {}, run));
    wrap('showTestInterface', (a, run) => nav.push('test', {}, run));

    /* ---------- popstate ---------- */
    window.addEventListener('popstate', (e) => {
      if (app.data.mode === 'test') {
        history.pushState({ screen: 'test' }, '', '#test');      // undo the pop
        if (confirm('Leave the exam? Your answers will be lost.')) {
          app.stopTimer();
          app.clearExamState();
          app.data.questions = [];
          app.data.userAnswers = {};
          app.data.answerRevealed = {};
          app.data.currentQuestionIndex = 0;
          app.data.timeLeft = 0;
          app.data.endTime = null;
          nav.stack = ['landing'];
          nav._suppress = true;
          history.replaceState({ screen: 'landing' }, '', '#landing');
          app.showLanding();
          setTimeout(() => { nav._suppress = false; }, 0);
        }
        return;
      }
      const state = e.state || { screen: 'landing' };
      const target = state.screen || 'landing';
      const idx = nav.stack.lastIndexOf(target);
      nav.stack = idx >= 0 ? nav.stack.slice(0, idx + 1) : [target];
      nav.handlePop(state);
    });

    /* ---------- init ---------- */
    history.replaceState({ screen: 'landing' }, '', '#landing');
    nav._suppress = true;
    app.showLanding();
    nav._suppress = false;
    nav._booted = true;
  }

  boot();
})();
