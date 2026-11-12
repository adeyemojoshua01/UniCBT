/* ==========================================================================
   math-formatter.js — wraps math in AI image-grading responses with \( ... \)
   MUST be the LAST wrapper of app.submitTest. It hijacks window.fetch ONLY
   while the wrapped submitTest is running and restores it in a finally block.
   ========================================================================== */
(function () {
  'use strict';

  const PLACEHOLDER = '___MATH_BLOCK___';

  function wrapMathForMathJax(text) {
    if (typeof text !== 'string' || !text) return text;

    // 1. protect existing \(...\) and \[...\] blocks
    const originals = [];
    let out = text.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, function (m) {
      originals.push(m);
      return PLACEHOLDER;
    });

    // 2. wrap likely-math patterns (processed per segment, so placeholders are never touched)
    const GREEK = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega';
    const stash = [];
    const hold = function (s) { stash.push('\\(' + s + '\\)'); return '\u0001' + (stash.length - 1) + '\u0002'; };

    function transform(seg) {
      // \frac{a}{b}
      seg = seg.replace(/\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}/g, hold);
      // \sqrt{x} / \sqrt[n]{x}
      seg = seg.replace(/\\sqrt(?:\[[^\]]*\])?\s*\{[^{}]*\}/g, hold);
      // superscripts / subscripts: x^2, x^{n+1}, a_i, a_{ij}   (optionally with a Greek base)
      seg = seg.replace(new RegExp('(?:\\\\(?:' + GREEK + ')|\\b[A-Za-z0-9]+)(?:[\\^_](?:\\{[^{}]*\\}|[-+]?[A-Za-z0-9]+))+', 'g'), hold);
      // bare Greek commands
      seg = seg.replace(new RegExp('\\\\(?:' + GREEK + ')\\b', 'g'), hold);
      // unicode Greek letters
      seg = seg.replace(/[\u0391-\u03A9\u03B1-\u03C9]+/g, hold);
      // word = expr   (e.g. v = u + at)
      seg = seg.replace(/\b([A-Za-z])\s*=\s*(-?[\w.]+(?:\s*[-+*\/]\s*[\w.]+)*)/g, hold);
      return seg;
    }

    out = out.split(PLACEHOLDER).map(transform).join(PLACEHOLDER);
    out = out.replace(/\u0001(\d+)\u0002/g, function (m, i) { return stash[Number(i)]; });

    // 3. restore the original blocks
    let k = 0;
    out = out.replace(new RegExp(PLACEHOLDER, 'g'), function () { return originals[k++]; });

    // 4. fix double-wrapping  \(\(...\)\)  ->  \(...\)
    let prev;
    do {
      prev = out;
      out = out.replace(/\\\(\s*\\\(([\s\S]*?)\\\)\s*\\\)/g, '\\($1\\)');
    } while (out !== prev);

    return out;
  }
  window.wrapMathForMathJax = wrapMathForMathJax;

  function install() {
    const app = window.app;
    if (!app || typeof app.submitTest !== 'function') { setTimeout(install, 100); return; }
    if (app._mathFormatterInstalled) return;
    app._mathFormatterInstalled = true;

    const originalSubmit = app.submitTest;
    let depth = 0;
    let realFetch = null;

    app.submitTest = async function () {
      if (depth === 0) {
        realFetch = window.fetch;
        const baseFetch = realFetch;
        window.fetch = async function (url, options) {
          const response = await baseFetch.apply(this, arguments);
          try {
            if (String(url).includes('/api/ai-brain') && options && typeof options.body === 'string' && response.ok) {
              const body = JSON.parse(options.body);
              if (body && body.isImage === true) {
                const data = await response.clone().json();
                if (data && typeof data.transcription === 'string') data.transcription = wrapMathForMathJax(data.transcription);
                if (data && typeof data.reason === 'string') data.reason = wrapMathForMathJax(data.reason);
                return new Response(JSON.stringify(data), {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers
                });
              }
            }
          } catch (e) { /* fall through with the untouched response */ }
          return response;
        };
      }
      depth++;
      try {
        return await originalSubmit.apply(this, arguments);
      } finally {
        depth--;
        if (depth === 0 && realFetch) { window.fetch = realFetch; realFetch = null; }
      }
    };
  }
  install();
})();
