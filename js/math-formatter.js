/* ============================================================
   math-formatter.js — wraps app.submitTest (MUST be last wrapper)
   Temporarily hijacks window.fetch only during the wrapped call;
   restores it in a finally block.
   ============================================================ */
(function () {
  'use strict';

  function wrapMathForMathJax(text) {
    if (!text || typeof text !== 'string') return text;
    var blocks = [];
    var out = text;

    /* 1. preserve existing \(...\) and \[...\] blocks */
    out = out.replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g, function (match) {
      var token = '___MATH_BLOCK_' + blocks.length + '___';
      blocks.push(match);
      return token;
    });

    /* 2. wrap likely math patterns */
    var greek = 'alpha|beta|gamma|delta|Delta|theta|lambda|mu|nu|sigma|Sigma|omega|Omega|pi|rho|tau|phi|Phi|epsilon|varepsilon';
    out = out.replace(new RegExp('\\b(' + greek + ')\\b', 'g'), function (m) {
      return '\\(\\' + (m === 'Delta' || m === 'Sigma' || m === 'Omega' || m === 'Phi' ? m : m.toLowerCase()) + '\\)';
    });
    out = out.replace(/([A-Za-z0-9)\]])\s*\^\s*\{?([A-Za-z0-9+\-]{1,8})\}?/g, '\\($1^{$2}\\)');
    out = out.replace(/([A-Za-z0-9)\]])_\{?([A-Za-z0-9+\-]{1,8})\}?/g, '\\($1_{$2}\\)');
    out = out.replace(/(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\})/g, '\\($1\\)');
    out = out.replace(/(\\sqrt\s*\{[^{}]*\})/g, '\\($1\\)');
    out = out.replace(/\b([A-Za-z])\s*=\s*([A-Za-z0-9][A-Za-z0-9\s.+\-*\/^]{0,40})/g, '\\($1 = $2\\)');

    /* 3. restore preserved blocks */
    out = out.replace(/___MATH_BLOCK_(\d+)___/g, function (m, i) {
      return blocks[Number(i)] || m;
    });

    /* 4. collapse accidental double wrapping */
    out = out.replace(/\\\(\\\(/g, '\\(').replace(/\\\)\\\)/g, '\\)');
    return out;
  }
  window.wrapMathForMathJax = wrapMathForMathJax;

  if (!window.app || typeof app.submitTest !== 'function') return;
  var originalSubmit = app.submitTest;

  app.submitTest = async function () {
    var originalFetch = window.fetch;

    window.fetch = async function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var body = init && init.body;
      var parsed = null;
      try { parsed = typeof body === 'string' ? JSON.parse(body) : (body || null); } catch (e) { parsed = null; }

      if (url.indexOf('/api/ai-brain') !== -1 && parsed && parsed.isImage === true) {
        var response = await originalFetch.apply(this, arguments);
        try {
          var clone = response.clone();
          var data = await clone.json();
          if (data && typeof data === 'object') {
            if (data.transcription) data.transcription = wrapMathForMathJax(String(data.transcription));
            if (data.reason) data.reason = wrapMathForMathJax(String(data.reason));
            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
        } catch (e) {
          return response;
        }
        return response;
      }
      return originalFetch.apply(this, arguments);
    };

    try {
      return await originalSubmit.apply(this, arguments);
    } finally {
      window.fetch = originalFetch;
    }
  };
})();
