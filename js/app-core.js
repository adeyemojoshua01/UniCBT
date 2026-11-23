/* ===== VIDEO + SVG EMBEDS (shared by the note builder and the website) =====
       Syntax inside notes:
         @[Title](https://youtu.be/xxxx)        video with caption
         https://www.youtube.com/watch?v=xxxx   bare link on its own line
         @[svg](filename.svg)                   SVG from its saved file
       Chapters: lines directly under a video, e.g.
         @[Fluid statics](https://youtu.be/xxxx)
         0:00 Introduction
         2:15 Bernoulli's equation
         1:05:30 Worked examples
       Playlists: paste a YouTube playlist link; the note builder lists its videos under it:
         @[Fluid Mechanics course](https://www.youtube.com/playlist?list=PLxxxx)
         dQw4w9WgXcQ | Lecture 1: Introduction
         9bZkp7q19f0 | Lecture 2: Pressure
       Students pick any video from the list on the website.
       Supports YouTube, Vimeo, Google Drive (no seeking) and direct .mp4/.webm/.ogg */
    (function () {
      if (window.CBTVideo) return;
      var POS_KEY = 'cbt_video_pos';
      var EXPL = /^[ \t]*@\[([^\]]*)\]\(\s*([^)\s]+)\s*\)[ \t]*$/;
      var BARE = /^[ \t]*(https?:\/\/[^\s<>]+)[ \t]*$/;
      var PLITEM = /^[ \t]*(?:[-*][ \t]+)?([A-Za-z0-9_-]{11})[ \t]*\|[ \t]*(\S.*?)[ \t]*$/;
      var CHAP = /^[ \t]*(?:[-*][ \t]+)?(\d{1,2}(?::\d{2}){1,2})[ \t]*[-\u2013\u2014:.)]*[ \t]+(\S.*?)[ \t]*$/;

      var vEsc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
      function parseTime(s) { return s.split(':').reduce(function (a, p) { return a * 60 + Number(p); }, 0); }
      function fmt(sec) {
        sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (s < 10 ? '0' : '') + s;
      }

      /* ---- one-time CSS (self-contained, works on dark and light reading themes) ---- */
      if (!document.getElementById('cbt-video-css')) {
        var st = document.createElement('style'); st.id = 'cbt-video-css';
        st.textContent = '.video-chapters{display:flex;flex-direction:column;gap:4px;margin-top:10px}' +
          '.vid-chapter{display:flex;gap:10px;align-items:baseline;text-align:left;padding:7px 10px;border-radius:9px;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.18);font-size:.88em;color:inherit;cursor:pointer;transition:background .15s}' +
          '.vid-chapter:hover:not(:disabled){background:rgba(207,166,70,.2)}.vid-chapter:disabled{opacity:.5;cursor:not-allowed}' +
          '.vid-time{font-variant-numeric:tabular-nums;font-weight:700;color:#c9a23f;min-width:3.4em}' +
          '.vid-playlist{margin-top:12px;border:1px solid rgba(127,127,127,.25);border-radius:12px;overflow:hidden}' +
          '.vid-pl-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;font-size:.8em;font-weight:700;background:rgba(127,127,127,.12)}' +
          '.vid-now{font-weight:600;opacity:.75;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
          '.vid-pl-items{position:relative;max-height:340px;overflow-y:auto}' +
          '.vid-pl-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 10px;border:0;border-bottom:1px solid rgba(127,127,127,.15);background:transparent;color:inherit;cursor:pointer;transition:background .15s}' +
          '.vid-pl-item:hover{background:rgba(207,166,70,.12)}.vid-pl-item.active{background:rgba(207,166,70,.2);box-shadow:inset 3px 0 0 #c9a23f}' +
          '.vid-pl-num{width:1.8em;flex:none;text-align:center;font-size:.75em;opacity:.6;font-variant-numeric:tabular-nums}' +
          '.vid-pl-item img{width:96px;height:54px;flex:none;object-fit:cover;border-radius:6px;background:#000}' +
          '.vid-pl-title{font-size:.88em;line-height:1.35;min-width:0}' +
          '.vid-bar{margin-top:8px}.vid-resume{padding:6px 12px;border-radius:9px;font-size:.82em;font-weight:700;background:rgba(207,166,70,.16);border:1px solid rgba(207,166,70,.45);color:#c9a23f;cursor:pointer}';
        (document.head || document.documentElement).appendChild(st);
      }

      /* ---- watch position memory ---- */
      function loadPos() { try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}') || {}; } catch (e) { return {}; } }
      var lastSave = {};
      function savePos(url, sec, dur, lastKey, vid) {
        if (!url || typeof sec !== 'number' || !isFinite(sec)) return;
        var now = Date.now(); if (now - (lastSave[url] || 0) < 3000) return; lastSave[url] = now;
        var p = loadPos();
        if (sec < 5 || (dur && sec > dur - 8)) delete p[url];
        else { p[url] = Math.floor(sec); if (lastKey && vid) p[lastKey] = vid; }
        try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (e) {}
      }
      function post(f, o) { try { f.contentWindow.postMessage(JSON.stringify(o), '*'); } catch (e) {} }

      function plSrc(vid, list, start, auto) {
        return 'https://www.youtube-nocookie.com/embed/' + vid + '?rel=0&enablejsapi=1&list=' + encodeURIComponent(list) + (start ? '&start=' + Math.floor(start) : '') + (auto ? '&autoplay=1' : '');
      }
      function setActive(box, vid) {
        box.setAttribute('data-vcur', vid);
        var items = box.querySelectorAll('.vid-pl-item'), title = '', wrap = box.querySelector('.vid-pl-items');
        for (var i = 0; i < items.length; i++) {
          var on = items[i].getAttribute('data-vid') === vid;
          items[i].classList.toggle('active', on);
          if (on) {
            title = items[i].querySelector('.vid-pl-title').textContent;
            if (wrap) wrap.scrollTop = items[i].offsetTop - (wrap.clientHeight - items[i].clientHeight) / 2;
          }
        }
        var now = box.querySelector('.vid-now'); if (now && title) now.textContent = 'Now playing: ' + title;
      }
      /* choose a video from the playlist list (optionally from a saved time) */
      window.CBT_PLAY = function (btn, vid, start) {
        var box = btn.closest ? btn.closest('.video-embed') : null; if (!box) return;
        var f = box.querySelector('iframe'), list = box.getAttribute('data-list'); if (!f || !list) return;
        f.src = plSrc(vid, list, start, true);
        setActive(box, vid);
        if (f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };

      window.CBT_SEEK = function (btn, sec) {
        var box = btn.closest ? btn.closest('.video-embed') : null; if (!box) return;
        var v = box.querySelector('video');
        if (v) { v.currentTime = sec; var pr = v.play && v.play(); if (pr && pr.catch) pr.catch(function () {}); return; }
        var f = box.querySelector('iframe'); if (!f) return;
        var t = f.getAttribute('data-vtype');
        if (t === 'yt') { post(f, { event: 'command', func: 'seekTo', args: [sec, true] }); post(f, { event: 'command', func: 'playVideo', args: [] }); }
        else if (t === 'vimeo') { post(f, { method: 'setCurrentTime', value: sec }); post(f, { method: 'play' }); }
      };
      window.CBT_VID_INIT = function (f) {
        var t = f.getAttribute('data-vtype');
        if (t === 'yt') post(f, { event: 'listening', id: 1, channel: 'widget' });
        else if (t === 'vimeo') post(f, { method: 'addEventListener', value: 'timeupdate' });
      };
      window.CBT_VID_TICK = function (v) {
        var box = v.closest('.video-embed'); if (box) savePos(box.getAttribute('data-vurl'), v.currentTime, v.duration);
      };
      window.addEventListener('message', function (e) {
        var d = e.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
        if (!d || typeof d !== 'object') return;
        var frames = document.querySelectorAll('.video-embed iframe'), f = null;
        for (var i = 0; i < frames.length; i++) if (frames[i].contentWindow === e.source) { f = frames[i]; break; }
        if (!f) return;
        var box = f.closest('.video-embed'), url = box.getAttribute('data-vurl'), isPl = box.hasAttribute('data-list');
        if (d.event === 'infoDelivery' && d.info) {
          var info = d.info;
          if (isPl) {                                   // keep the list highlight in step with auto-advance
            var vid = (info.videoData && info.videoData.video_id) || '';
            if (!vid && typeof info.playlistIndex === 'number') { var it = box.querySelectorAll('.vid-pl-item')[info.playlistIndex]; if (it) vid = it.getAttribute('data-vid'); }
            if (vid && vid !== box.getAttribute('data-vcur')) setActive(box, vid);
          }
          if (typeof info.currentTime === 'number') {
            if (isPl) { var cur = box.getAttribute('data-vcur'); savePos(url + '#' + cur, info.currentTime, info.duration, url + '#last', cur); }
            else savePos(url, info.currentTime, info.duration);
          }
        } else if (d.event === 'timeupdate' && d.data) savePos(url, d.data.seconds, d.data.duration);
      });

      /* ---- recognising links ---- */
      function kindOf(url) {
        url = String(url || '').trim();
        var pl = url.match(/[?&]list=([\w-]+)/i);
        if (pl && /(?:youtube\.com|youtu\.be)\//i.test(url)) {
          var sv = url.match(/[?&]v=([\w-]{11})/i) || url.match(/youtu\.be\/([\w-]{11})/i);
          return { t: 'ytpl', list: pl[1], id: sv ? sv[1] : '' };
        }
        var m = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
        if (m) { var t = url.match(/[?&#](?:t|start)=(\d+)/i); return { t: 'yt', id: m[1], start: t ? +t[1] : 0 }; }
        m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i); if (m) return { t: 'vimeo', id: m[1] };
        m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i); if (m) return { t: 'drive', id: m[1] };
        if (/^https?:\/\/\S+\.(mp4|webm|ogg|mov)(\?\S*)?$/i.test(url)) return { t: 'file' };
        return null;
      }

      /* ---- video player markup ---- */
      function playlistEmbed(url, title, k, items, compact) {
        if (compact) {
          return '<div class="video-embed no-mathjax" style="margin:1em 0;padding:12px 14px;border-radius:12px;border:1px dashed rgba(127,127,127,.5);font-size:.9em">' +
            '<i class="fas fa-list-ul"></i> <strong>' + vEsc(title || 'Playlist') + '</strong> &middot; ' + (items.length ? items.length + ' videos' : 'playlist') +
            ' <span style="opacity:.6">(plays in the Preview tab)</span></div>';
        }
        var first = (k.id && items.some(function (i) { return i.id === k.id; })) ? k.id : (items[0] ? items[0].id : k.id);
        var src = first ? plSrc(first, k.list, 0, false) : 'https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(k.list) + '&rel=0&enablejsapi=1';
        var player = '<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;background:#000">' +
          '<iframe src="' + vEsc(src) + '" data-vtype="yt" onload="CBT_VID_INIT(this)" title="' + vEsc(title || 'Playlist') + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;border:0" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
        var pos = loadPos(), last = pos[url + '#last'], lt = last ? pos[url + '#' + last] : 0;
        var lastItem = items.filter(function (i) { return i.id === last; })[0];
        var resume = (lastItem && lt >= 10 && last !== first) || (lastItem && lt >= 10)
          ? '<div class="vid-bar"><button type="button" class="vid-resume" onclick="CBT_PLAY(this,\'' + last + '\',' + lt + ')"><i class="fas fa-rotate-left"></i> Resume “' + vEsc(lastItem.title.length > 48 ? lastItem.title.slice(0, 48) + '…' : lastItem.title) + '” from ' + fmt(lt) + '</button></div>' : '';
        var firstItem = items.filter(function (i) { return i.id === first; })[0];
        var list = items.length ? '<div class="vid-playlist"><div class="vid-pl-head"><span><i class="fas fa-list-ul"></i> Playlist · ' + items.length + ' videos</span>' +
          '<span class="vid-now">' + (firstItem ? 'Now playing: ' + vEsc(firstItem.title) : '') + '</span></div><div class="vid-pl-items">' +
          items.map(function (it, i) {
            return '<button type="button" class="vid-pl-item' + (it.id === first ? ' active' : '') + '" data-vid="' + it.id + '" onclick="CBT_PLAY(this,\'' + it.id + '\')">' +
              '<span class="vid-pl-num">' + (i + 1) + '</span><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg"><span class="vid-pl-title">' + vEsc(it.title) + '</span></button>';
          }).join('') + '</div></div>' : '';
        var cap = title ? '<div style="font-size:.85em;opacity:.75;margin-top:6px;text-align:center;font-style:italic">' + vEsc(title) + '</div>' : '';
        return '<div class="video-embed no-mathjax" data-vurl="' + vEsc(url) + '" data-list="' + vEsc(k.list) + '" data-vcur="' + first + '" style="margin:1.2em 0">' + player + resume + list + cap + '</div>';
      }

      function embed(url, title, chapters, compact, items) {
        var k = kindOf(url); if (!k) return null;
        if (k.t === 'ytpl') return playlistEmbed(url, title, k, items || [], compact);
        chapters = chapters || [];
        if (compact) {
          return '<div class="video-embed no-mathjax" style="margin:1em 0;padding:12px 14px;border-radius:12px;border:1px dashed rgba(127,127,127,.5);font-size:.9em">' +
            '<i class="fas fa-circle-play"></i> <strong>' + vEsc(title || 'Video') + '</strong>' + (chapters.length ? ' &middot; ' + chapters.length + ' chapters' : '') +
            ' <span style="opacity:.6">(plays in the Preview tab)</span></div>';
        }
        var player;
        if (k.t === 'file') {
          player = '<video controls preload="metadata" playsinline data-vtype="file" ontimeupdate="CBT_VID_TICK(this)" style="width:100%;border-radius:12px;background:#000"><source src="' + vEsc(url) + '"></video>';
        } else {
          var src = k.t === 'yt' ? 'https://www.youtube-nocookie.com/embed/' + k.id + '?rel=0&enablejsapi=1' + (k.start ? '&start=' + k.start : '')
                  : k.t === 'vimeo' ? 'https://player.vimeo.com/video/' + k.id
                  : 'https://drive.google.com/file/d/' + k.id + '/preview';
          player = '<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;background:#000">' +
            '<iframe src="' + vEsc(src) + '" data-vtype="' + k.t + '" onload="CBT_VID_INIT(this)" title="' + vEsc(title || 'Video') + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;border:0" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
        }
        var canSeek = k.t !== 'drive';
        var pos = loadPos()[url];
        var resume = (canSeek && pos >= 10) ? '<div class="vid-bar"><button type="button" class="vid-resume" onclick="CBT_SEEK(this,' + pos + ')"><i class="fas fa-rotate-left"></i> Resume from ' + fmt(pos) + '</button></div>' : '';
        var chap = chapters.length ? '<div class="video-chapters">' + chapters.map(function (c) {
          return '<button type="button" class="vid-chapter"' + (canSeek ? ' onclick="CBT_SEEK(this,' + c.t + ')"' : ' disabled title="Seeking is not available for Google Drive videos"') + '>' +
            '<span class="vid-time">' + fmt(c.t) + '</span><span>' + vEsc(c.label) + '</span></button>';
        }).join('') + '</div>' : '';
        var cap = title ? '<div style="font-size:.85em;opacity:.75;margin-top:6px;text-align:center;font-style:italic">' + vEsc(title) + '</div>' : '';
        return '<div class="video-embed no-mathjax" data-vurl="' + vEsc(url) + '" style="margin:1.2em 0">' + player + resume + chap + cap + '</div>';
      }

      /* ---- SVG from a saved file ---- */
      function isSvgRef(url, title) { return /\.svg(\?[^\s]*)?$/i.test(url) || String(title || '').toLowerCase() === 'svg'; }
      function svgSrc(ref) {
        ref = String(ref || '').trim();
        if (typeof window.CBT_SVG_RESOLVER === 'function') { var r = window.CBT_SVG_RESOLVER(ref); if (r) return r; }
        if (/^(https?:)?\/\//i.test(ref) || ref.indexOf('/') > -1) return ref;
        var all = window.CBT_SUBJECT_IMAGES || {}, want = ref.toLowerCase();
        for (var subj in all) for (var topic in all[subj]) {
          var list = all[subj][topic] || [];
          for (var i = 0; i < list.length; i++) if (list[i].filename && String(list[i].filename).toLowerCase() === want) return list[i].data;
        }
        return null;
      }
      function svgEmbedHtml(ref, title) {
        var src = svgSrc(ref);
        if (!src) return '<p class="no-mathjax" style="opacity:.6;font-style:italic">SVG not found: ' + vEsc(ref) + '</p>';
        var cap = (title && title.toLowerCase() !== 'svg') ? '<figcaption style="font-size:.8em;opacity:.7;margin-top:6px">' + vEsc(title) + '</figcaption>' : '';
        return '<figure class="svg-embed no-mathjax" style="margin:1.2em 0;text-align:center"><img src="' + vEsc(src) + '" alt="' + vEsc(title || ref) + '" style="max-width:100%;background:#fff;border-radius:12px;padding:8px;cursor:zoom-in" onclick="window.open(this.src,\'_blank\')">' + cap + '</figure>';
      }

      /* ---- scanning a note ---- */
      function scan(text, compact) {
        var lines = String(text || '').split(/\r?\n/), out = [], store = [], meta = [], i = 0;
        while (i < lines.length) {
          var line = lines[i], m = line.match(EXPL), title = '', url = '', kind = '';
          if (m) { title = m[1].trim(); url = m[2]; kind = isSvgRef(url, title) ? 'svg' : 'video'; }
          else { m = line.match(BARE); if (m && kindOf(m[1])) { url = m[1]; kind = 'video'; } }
          if (!kind) { out.push(line); i++; continue; }
          var html, next = i + 1;
          if (kind === 'svg') html = svgEmbedHtml(url, title);
          else if (!kindOf(url)) html = '<p><a href="' + vEsc(url) + '" target="_blank" rel="noopener">' + vEsc(title || url) + '</a></p>';
          else {
            var ch = [], items = [], isPl = kindOf(url).t === 'ytpl';
            if (isPl) { while (next < lines.length) { var pm = lines[next].match(PLITEM); if (!pm) break; items.push({ id: pm[1], title: pm[2] }); next++; } }
            else { while (next < lines.length) { var c = lines[next].match(CHAP); if (!c) break; ch.push({ t: parseTime(c[1]), label: c[2] }); next++; } }
            var clean = title.toLowerCase() === 'video' ? '' : title;
            meta.push({ title: clean, url: url, chapters: ch, items: items });
            html = embed(url, clean, ch, compact, items);
          }
          store.push(html);
          out.push('', '@@VIDEOEMBED' + (store.length - 1) + '@@', '');
          i = next;
        }
        return { text: out.join('\n'), store: store, meta: meta };
      }

      window.CBTVideo = {
        kindOf: kindOf,
        PLITEM: PLITEM,
        embed: embed,
        collect: function (text) { return scan(text).meta; },
        listHtml: function (list) {
          return list.map(function (v, i) { return '<div style="margin-bottom:18px">' + embed(v.url, v.title || ('Video ' + (i + 1)), v.chapters, false, v.items) + '</div>'; }).join('');
        },
        extract: function (text, store, compact) { var r = scan(text, compact); Array.prototype.push.apply(store, r.store); return r.text; },
        restore: function (html, store) { return html.replace(/(?:<p>\s*)?@@VIDEOEMBED(\d+)@@(?:\s*<\/p>)?/g, function (m, i) { return store[i]; }); }
      };
    })();
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


         parseMarkdownWithMath: function(rawText) {
      if (!rawText) return '';
      if (!window.marked) return rawText;

      var mathBlocks = [];
      var videoBlocks = [];
      var text = window.CBTVideo.extract(rawText, videoBlocks);

      text = text.replace(/\\\[([\s\S]*?)\\\]/g, function(match) { mathBlocks.push(match); return `@@MATHBLOCK${mathBlocks.length - 1}@@`; });
      text = text.replace(/\$\$([\s\S]*?)\$\$/g, function(match) { mathBlocks.push(match); return `@@MATHBLOCK${mathBlocks.length - 1}@@`; });
      text = text.replace(/\\\((.*?)\\\)/g, function(match) { mathBlocks.push(match); return `@@MATHBLOCK${mathBlocks.length - 1}@@`; });

      var html = window.marked.parse(text);

      html = html.replace(/@@MATHBLOCK(\d+)@@/g, function(match, index) {
        return mathBlocks[index];
      });

      return window.CBTVideo.restore(html, videoBlocks);
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
            images: imgs.length,
            videos: window.CBTVideo.collect(note).length
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

        '<footer class="mt-8 pb-4 flex items-center justify-center text-xs text-gray-500">' +
        '<span>version 1.0 eduCBT</span>' +
        '</footer>';

      container.innerHTML = html;
      container.scrollTop = 0;
      this.triggerMathJax();
    },

    /* ---------------- study materials browser ---------------- */
    showSubjectNotes: function (subjectId) {
      if (this._needMaterials('showSubjectNotes', arguments)) return;
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
          '<h3 class="mt-3 font-bold text-gray-800 leading-snug">' + self.esc(t.name) + self.readBadge(subject, t.id) + '</h3>' +
          '<div class="flex flex-wrap gap-2 mt-4">' +
          (t.hasNotes ? '<button onclick="app.viewTopicNote(\'' + subjectId + '\',\'' + t.id + '\')" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"><i class="fas fa-file-lines"></i>Read Notes</button>' : '') +
          (t.images ? '<button onclick="app.viewTopicImages(\'' + subjectId + '\',\'' + t.id + '\')" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"><i class="fas fa-images"></i>View Images (' + t.images + ')</button>' : '') +
          (t.videos ? '<button onclick="app.viewTopicVideos(\'' + subjectId + '\',\'' + t.id + '\')" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"><i class="fas fa-circle-play"></i>Videos (' + t.videos + ')</button>' : '') +
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


         // --- SCHOLAR VIEW FUNCTIONS ---
    noteSettings: { theme: 'dark', fontSize: 16 },
    
    loadNoteSettings: function() {
      try {
        var saved = JSON.parse(localStorage.getItem('cbt_note_settings'));
        if (saved) this.noteSettings = saved;
      } catch(e) {}
    },

    applyNoteSettings: function() {
      var shell = document.getElementById('note-viewer-shell');
      var content = document.getElementById('note-viewer-content');
      if (!shell || !content) return;
      
      shell.className = shell.className.replace(/note-theme-\w+/g, '').trim();
      shell.classList.add('note-theme-' + this.noteSettings.theme);
      content.style.fontSize = this.noteSettings.fontSize + 'px';
      
      localStorage.setItem('cbt_note_settings', JSON.stringify(this.noteSettings));
    },

    toggleNoteTheme: function() {
      var themes = ['dark', 'light', 'sepia'];
      var idx = themes.indexOf(this.noteSettings.theme);
      this.noteSettings.theme = themes[(idx + 1) % themes.length];
      this.applyNoteSettings();
    },

    adjustNoteFontSize: function(dir) {
      this.noteSettings.fontSize = Math.max(12, Math.min(24, this.noteSettings.fontSize + dir));
      this.applyNoteSettings();
    },

    toggleNoteSearch: function() {
      var bar = document.getElementById('note-search-bar');
      var input = document.getElementById('note-search-input');
      bar.classList.toggle('hidden');
      if (!bar.classList.contains('hidden')) { input.focus(); } 
      else { input.value = ''; this.performNoteSearch(''); }
    },

    toggleNoteTOC: function() {
      document.getElementById('note-toc-drawer').classList.toggle('hidden');
    },

    updateNoteProgress: function(el) {
      var progress = document.getElementById('note-progress-bar');
      if (!progress) return;
      var scrollTop = el.scrollTop;
      var scrollHeight = el.scrollHeight - el.clientHeight;
      var scrolled = (scrollTop / scrollHeight) * 100;
      progress.style.width = scrolled + '%';
      if (scrollHeight > 200 && scrollTop / scrollHeight >= 0.92) this.autoMarkRead();
    },

    generateNoteTOC: function() {
      var content = document.getElementById('note-viewer-content');
      var tocList = document.getElementById('note-toc-list');
      if (!content || !tocList) return;
      
      var headings = content.querySelectorAll('h1, h2, h3');
      if (headings.length === 0) {
        document.getElementById('note-toc-drawer').classList.add('hidden');
        return;
      }
      
      var html = '';
      headings.forEach(function(h, i) {
        var id = 'note-heading-' + i;
        h.id = id;
        html += '<li><button onclick="document.getElementById(\'' + id + '\').scrollIntoView({behavior:\'smooth\'})"><i class="fas fa-hashtag text-gray-500 mr-2 text-xs"></i>' + h.innerText + '</button></li>';
      });
      tocList.innerHTML = html;
    },

    performNoteSearch: function(query) {
      var content = document.getElementById('note-viewer-content');
      var countEl = document.getElementById('note-search-count');
      if (!content) return;
      
      // Reset highlights
      if (content.querySelector('mark.note-search-hit')) {
        content.innerHTML = content.innerHTML.replace(/<mark class="note-search-hit[^>]*>(.*?)<\/mark>/gi, '$1');
      }
      
      if (!query || query.trim().length < 2) {
        if (countEl) countEl.textContent = '';
        return;
      }
      
      // Simple text search using regex (ignores HTML tags to prevent breaking them)
      var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![^<]*>)', 'gi');
      var matches = 0;
      
      // We use a TreeWalker to safely highlight text without breaking MathJax SVGs
      var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null, false);
      var nodes = [];
      while (walker.nextNode()) { nodes.push(walker.currentNode); }
      
      nodes.forEach(function(node) {
        if (regex.test(node.nodeValue)) {
          matches += (node.nodeValue.match(regex) || []).length;
          var span = document.createElement('span');
          span.innerHTML = node.nodeValue.replace(regex, '<mark class="note-search-hit">$1</mark>');
          node.parentNode.replaceChild(span, node);
        }
      });
      
      if (countEl) countEl.textContent = matches + ' found';
    },

     
      viewTopicNote: function (subjectId, topicId, topicName) {
      if (this._needMaterials('viewTopicNote', arguments)) return;
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
      
      // SAVE FOR "CONTINUE READING"
      try {
        localStorage.setItem('cbt_last_read', JSON.stringify({
          subjectId: subjectId,
          topicId: topicId,
          subjectName: subject.name,
          topicName: resolvedName || 'Topic',
          timestamp: Date.now()
        }));
      } catch(e) {}

      this._currentNote = { text: String(note), name: resolvedName || 'Topic', sid: subjectId, tid: topicId, sname: subject.name };
      var titleEl = document.getElementById('note-viewer-title');
      if (titleEl) titleEl.textContent = (resolvedName || 'Topic') + ' · Notes';
      
      // ... REST OF THE VIEW NOTE LOGIC ...
            var bodyEl = document.getElementById('note-viewer-content');
      if (bodyEl) {
        if (window.marked && typeof this.parseMarkdownWithMath === 'function') {
          // Force line breaks by adding two spaces before every newline
          var forcedBreaks = note.replace(/\n/g, '  \n'); 
          bodyEl.innerHTML = this.parseMarkdownWithMath(forcedBreaks);
        } else {
          bodyEl.innerHTML = note.replace(/\n/g, '<br>');
        }
      }
      
      var modal = document.getElementById('note-viewer-modal');
      if (modal) modal.classList.remove('hidden');
      
      document.getElementById('note-search-bar').classList.add('hidden');
      document.getElementById('note-search-input').value = '';
      document.getElementById('note-search-count').textContent = '';
      document.getElementById('note-toc-drawer').classList.add('hidden');
      
      this.loadNoteSettings();
      this.applyNoteSettings();
      this.generateNoteTOC();
      
      document.getElementById('note-progress-bar').style.width = '0%';
      bodyEl.scrollTop = 0;
      
      this.typeset('#note-viewer-content');
      this.triggerMathJax();
      this.afterNoteTypeset();
    },

     
    

    /* ================= DEFERRED NOTES / IMAGES ================= */
    _needMaterials: function (fnName, args) {
      if (!window.cbtMaterialsReady || window.cbtMaterialsReady()) return false;
      var self = this;
      this.toast('Loading study materials…');
      window.cbtEnsureMaterials().then(function () { self[fnName].apply(self, args); });
      return true;
    },

    /* ================= STUDY FEATURES ================= */
    lsGet: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    lsSet: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    topicKey: function (subject, topicId) { return (subject ? subject.name : '') + '::' + topicId; },
    findSubjectByName: function (name) { return Object.values(this.data.subjects).find(function (s) { return s.name === name; }) || null; },

    /* --- read progress --- */
    isRead: function (subject, topicId) { return !!this.lsGet('cbt_read', {})[this.topicKey(subject, topicId)]; },
    setRead: function (subject, topicId, on) {
      var r = this.lsGet('cbt_read', {}), k = this.topicKey(subject, topicId);
      if (on) r[k] = Date.now(); else delete r[k];
      this.lsSet('cbt_read', r);
    },
    subjectProgress: function (subject) {
      var self = this, total = 0, read = 0;
      (subject.topics || []).forEach(function (t) {
        var n = subject.notes && subject.notes[t.id];
        if (n && String(n).trim()) { total++; if (self.isRead(subject, t.id)) read++; }
      });
      return { total: total, read: read };
    },
    readBadge: function (subject, topicId) {
      return this.isRead(subject, topicId) ? '<span class="read-badge"><i class="fas fa-circle-check"></i> Read</span>' : '';
    },
    updateReadButton: function () {
      var c = this._currentNote, b = document.getElementById('note-read-btn'); if (!b || !c) return;
      var subject = this.data.subjects[c.sid]; if (!subject) return;
      var on = this.isRead(subject, c.tid);
      b.classList.toggle('is-read', on);
      b.title = on ? 'Marked as read — tap to undo' : 'Mark as read';
      b.innerHTML = on ? '<i class="fas fa-circle-check"></i>' : '<i class="far fa-circle-check"></i>';
    },
    toggleNoteRead: function () {
      var c = this._currentNote; if (!c) return;
      var subject = this.data.subjects[c.sid]; if (!subject) return;
      var on = !this.isRead(subject, c.tid);
      this.setRead(subject, c.tid, on); this.updateReadButton();
      this.toast(on ? 'Marked as read' : 'Marked as unread', on ? 'success' : undefined);
    },
    autoMarkRead: function () {
      var c = this._currentNote; if (!c) return;
      var subject = this.data.subjects[c.sid]; if (!subject || this.isRead(subject, c.tid)) return;
      this.setRead(subject, c.tid, true); this.updateReadButton();
      this.toast('Finished reading — marked as read', 'success');
    },

    /* --- text offsets (survive MathJax, bold, lists, etc.) --- */
    flatText: function (root) {
      var nodes = [], parts = [], pos = 0, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n;
      while ((n = w.nextNode())) { nodes.push({ node: n, start: pos }); parts.push(n.nodeValue); pos += n.nodeValue.length; }
      return { nodes: nodes, text: parts.join('') };
    },
    selectionOffsets: function (root) {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
      var r = sel.getRangeAt(0);
      if (!root.contains(r.commonAncestorContainer)) return null;
      var pre = document.createRange(); pre.selectNodeContents(root); pre.setEnd(r.startContainer, r.startOffset);
      var start = pre.toString().length, text = r.toString();
      if (!text.trim()) return null;
      return { start: start, end: start + text.length, text: text };
    },

    /* --- highlights --- */
    wrapRange: function (root, h, id) {
      var ft = this.flatText(root), s = h.s, e = h.e;
      if (ft.text.slice(s, e) !== h.text) {            // note was edited: try to re-find the passage
        var idx = ft.text.indexOf(h.text); if (idx < 0) return;
        s = idx; e = idx + h.text.length;
      }
      var skip = 'mjx-container, .video-embed, .svg-embed, script, style';
      var targets = ft.nodes.filter(function (t) {
        var len = t.node.nodeValue.length, par = t.node.parentElement;
        if (!(t.start + len > s && t.start < e) || !par || par.closest(skip)) return false;
        if (/^\s*$/.test(t.node.nodeValue) && /^(UL|OL|TABLE|THEAD|TBODY|TR)$/.test(par.tagName)) return false;
        return true;
      });
      targets.forEach(function (t) {
        var node = t.node, len = node.nodeValue.length;
        var a = Math.max(s, t.start) - t.start, b = Math.min(e, t.start + len) - t.start;
        var mid = a > 0 ? node.splitText(a) : node;
        if (b - a < mid.nodeValue.length) mid.splitText(b - a);
        var mark = document.createElement('mark');
        mark.className = 'note-hl hl-' + (h.c || 'y'); mark.setAttribute('data-hid', id);
        mid.parentNode.insertBefore(mark, mid); mark.appendChild(mid);
      });
    },
    rebuildHighlights: function () {
      var root = document.getElementById('note-viewer-content'), c = this._currentNote; if (!root || !c) return;
      root.querySelectorAll('mark.note-hl').forEach(function (m) {
        var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize();
      });
      var subject = this.data.subjects[c.sid]; if (!subject) return;
      var list = this.lsGet('cbt_highlights', {})[this.topicKey(subject, c.tid)] || [], self = this;
      list.forEach(function (h, i) { self.wrapRange(root, h, i); });
    },
    showHlPop: function (mode, hid) {
      var pop = document.getElementById('note-hl-pop'); if (!pop) return;
      this._hlMode = mode; this._hlTarget = hid;
      document.getElementById('hl-pop-add').classList.toggle('hidden', mode !== 'add');
      document.getElementById('hl-pop-remove').classList.toggle('hidden', mode !== 'remove');
      pop.classList.remove('hidden');
    },
    hideHlPop: function () {
      var pop = document.getElementById('note-hl-pop'); if (pop) pop.classList.add('hidden');
      this._hlMode = null;
    },
    updateHlPop: function () {
      var root = document.getElementById('note-viewer-content'); if (!root) return;
      var off = this.selectionOffsets(root);
      if (off) { this._pendingSel = off; this.showHlPop('add'); }
      else if (this._hlMode === 'add') this.hideHlPop();
    },
    addHighlight: function (color) {
      var c = this._currentNote, off = this._pendingSel; if (!c || !off) return;
      if (off.text.length > 2000) { this.toast('Select a shorter passage (under 2000 characters).', 'error'); return; }
      var subject = this.data.subjects[c.sid]; if (!subject) return;
      var all = this.lsGet('cbt_highlights', {}), k = this.topicKey(subject, c.tid), list = all[k] || [];
      list.push({ s: off.start, e: off.end, text: off.text, c: color || 'y', ts: Date.now() });
      all[k] = list; this.lsSet('cbt_highlights', all);
      this._pendingSel = null;
      var sel = window.getSelection(); if (sel) sel.removeAllRanges();
      this.hideHlPop(); this.rebuildHighlights();
    },
    removeHighlight: function () {
      var c = this._currentNote, id = this._hlTarget; if (!c || id == null) return;
      var subject = this.data.subjects[c.sid]; if (!subject) return;
      var all = this.lsGet('cbt_highlights', {}), k = this.topicKey(subject, c.tid), list = all[k] || [];
      list.splice(id, 1); all[k] = list; this.lsSet('cbt_highlights', all);
      this.hideHlPop(); this.rebuildHighlights();
    },

    /* --- bookmarks (on headings) --- */
    decorateHeadings: function () {
      var root = document.getElementById('note-viewer-content'), c = this._currentNote; if (!root || !c) return;
      var bms = this.lsGet('cbt_bookmarks', []);
      root.querySelectorAll('h1, h2, h3').forEach(function (h, i) {
        var old = h.querySelector('.note-bm-btn'); if (old) old.remove();
        var on = bms.some(function (b) { return b.sname === c.sname && b.tid === c.tid && b.hIdx === i; });
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'note-bm-btn' + (on ? ' on' : ''); b.setAttribute('data-hidx', i);
        b.setAttribute('aria-label', on ? 'Remove bookmark' : 'Bookmark this section');
        b.innerHTML = '<i class="' + (on ? 'fas' : 'far') + ' fa-bookmark"></i>';
        h.appendChild(b);
      });
    },
    toggleBookmark: function (hIdx) {
      var c = this._currentNote, root = document.getElementById('note-viewer-content'); if (!c || !root) return;
      var h = root.querySelectorAll('h1, h2, h3')[hIdx]; if (!h) return;
      var heading = (h.cloneNode(true).textContent || '').trim();
      var bms = this.lsGet('cbt_bookmarks', []);
      var at = bms.findIndex(function (b) { return b.sname === c.sname && b.tid === c.tid && b.hIdx === hIdx; });
      if (at > -1) { bms.splice(at, 1); this.toast('Bookmark removed'); }
      else { bms.unshift({ sid: c.sid, sname: c.sname, tid: c.tid, tname: c.name, hIdx: hIdx, heading: heading, ts: Date.now() }); this.toast('Section bookmarked', 'success'); }
      this.lsSet('cbt_bookmarks', bms); this.decorateHeadings();
    },

    /* --- saved panel --- */
    openSaved: function (tab) {
      this._savedTab = tab || this._savedTab || 'bookmarks';
      this.renderSaved();
      var m = document.getElementById('saved-modal'); if (m) m.classList.remove('hidden');
    },
    closeSaved: function () { var m = document.getElementById('saved-modal'); if (m) m.classList.add('hidden'); },
    renderSaved: function () {
      var self = this, tab = this._savedTab, body = document.getElementById('saved-body'); if (!body) return;
      ['bookmarks', 'highlights'].forEach(function (t) { var b = document.getElementById('saved-tab-' + t); if (b) b.classList.toggle('active', t === tab); });
      var items = [], html = '';
      if (tab === 'bookmarks') {
        items = this.lsGet('cbt_bookmarks', []);
      } else {
        var all = this.lsGet('cbt_highlights', {});
        Object.keys(all).forEach(function (k) {
          var parts = k.split('::'), subject = self.findSubjectByName(parts[0]); if (!subject) return;
          var topic = (subject.topics || []).find(function (t) { return t.id === parts[1]; });
          (all[k] || []).forEach(function (h, i) { items.push({ key: k, hid: i, sid: subject.id, sname: subject.name, tid: parts[1], tname: topic ? topic.name : 'Topic', text: h.text, c: h.c, ts: h.ts || 0 }); });
        });
        items.sort(function (a, b) { return b.ts - a.ts; });
      }
      this._savedItems = items;
      html = items.length ? items.map(function (it, i) {
        var title = tab === 'bookmarks' ? self.esc(it.heading || 'Section') : '<span class="saved-hl hl-' + (it.c || 'y') + '">' + self.esc(it.text.length > 140 ? it.text.slice(0, 140) + '…' : it.text) + '</span>';
        return '<div class="saved-item"><button class="saved-open" onclick="app.openSavedItem(' + i + ')"><div class="saved-title">' + title + '</div>' +
          '<div class="saved-sub">' + self.esc(it.sname) + ' · ' + self.esc(it.tname) + '</div></button>' +
          '<button class="saved-del" onclick="app.deleteSaved(' + i + ')" aria-label="Remove"><i class="fas fa-trash"></i></button></div>';
      }).join('') : '<p class="text-sm text-gray-500 text-center py-10">' + (tab === 'bookmarks'
        ? 'No bookmarks yet. Tap the bookmark icon beside any heading while reading a note.'
        : 'No highlights yet. Select text in a note and pick a colour.') + '</p>';
      body.innerHTML = html;
    },
    openSavedItem: function (i) {
      var it = (this._savedItems || [])[i]; if (!it) return;
      var subject = this.findSubjectByName(it.sname); if (!subject) { this.toast('That subject is no longer available.', 'error'); return; }
      this._pendingJump = this._savedTab === 'bookmarks' ? { type: 'bookmark', idx: it.hIdx } : { type: 'highlight', idx: it.hid };
      this.closeSaved(); this.viewTopicNote(subject.id, it.tid, it.tname);
    },
    deleteSaved: function (i) {
      var it = (this._savedItems || [])[i]; if (!it) return;
      if (this._savedTab === 'bookmarks') {
        var bms = this.lsGet('cbt_bookmarks', []);
        var at = bms.findIndex(function (b) { return b.sname === it.sname && b.tid === it.tid && b.hIdx === it.hIdx; });
        if (at > -1) bms.splice(at, 1); this.lsSet('cbt_bookmarks', bms);
      } else {
        var all = this.lsGet('cbt_highlights', {}); if (all[it.key]) all[it.key].splice(it.hid, 1); this.lsSet('cbt_highlights', all);
      }
      this.renderSaved();
      if (this._currentNote && !document.getElementById('note-viewer-modal').classList.contains('hidden')) { this.rebuildHighlights(); this.decorateHeadings(); }
    },

    /* --- note viewer wiring --- */
    initNoteStudyUI: function () {
      if (this._noteUIInit) return; this._noteUIInit = true;
      var self = this, root = document.getElementById('note-viewer-content'); if (!root) return;
      document.addEventListener('selectionchange', function () {
        var m = document.getElementById('note-viewer-modal');
        if (!m || m.classList.contains('hidden')) return;
        clearTimeout(self._selT); self._selT = setTimeout(function () { self.updateHlPop(); }, 250);
      });
      root.addEventListener('click', function (e) {
        var bm = e.target.closest('.note-bm-btn'); if (bm) { self.toggleBookmark(parseInt(bm.getAttribute('data-hidx'), 10)); return; }
        var mk = e.target.closest('mark.note-hl'), sel = window.getSelection();
        if (mk && (!sel || sel.isCollapsed)) self.showHlPop('remove', parseInt(mk.getAttribute('data-hid'), 10));
        else if (!mk && self._hlMode === 'remove') self.hideHlPop();
      });
    },
    afterNoteTypeset: function () {
      var self = this, root = document.getElementById('note-viewer-content'), tries = 0;
      this.hideHlPop();
      // bookmarks + read button don't depend on MathJax: show them straight away
      this.initNoteStudyUI(); this.decorateHeadings(); this.updateReadButton();
      // highlights are placed by text offset, so wait until MathJax has finished rewriting the page
      (function go() {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
          window.MathJax.typesetPromise([root]).then(function () { self.decorateNote(); }, function () { self.decorateNote(); });
        } else if (tries++ < 20) setTimeout(go, 300);
        else self.decorateNote();
      })();
    },
    decorateNote: function () {
      var c = this._currentNote; if (!c) return;
      this.initNoteStudyUI(); this.rebuildHighlights(); this.decorateHeadings(); this.updateReadButton();
      var root = document.getElementById('note-viewer-content'), j = this._pendingJump, q = this._pendingSearch;
      this._pendingJump = null; this._pendingSearch = null;
      if (j && j.type === 'bookmark') {
        var h = root.querySelectorAll('h1, h2, h3')[j.idx]; if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (j && j.type === 'highlight') {
        var m = root.querySelector('mark.note-hl[data-hid="' + j.idx + '"]');
        if (m) { m.scrollIntoView({ behavior: 'smooth', block: 'center' }); m.classList.add('flash'); setTimeout(function () { m.classList.remove('flash'); }, 1800); }
      }
      if (q) {
        document.getElementById('note-search-bar').classList.remove('hidden');
        document.getElementById('note-search-input').value = q;
        this.performNoteSearch(q);
        var first = root.querySelector('mark.note-search-hit'); if (first) first.scrollIntoView({ block: 'center' });
      }
    },

    /* --- full-text search across every note (Study Hub) --- */
    plainNote: function (raw) {
      return String(raw || '')
        .replace(/^[ \t]*@\[[^\]]*\]\([^)]*\)[ \t]*$/gm, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, ' ')
        .replace(/\\[()\[\]]/g, ' ').replace(/[#*_`>~|]/g, '').replace(/\s+/g, ' ').trim();
    },
    hubFullText: function (q, type) {
      var box = document.getElementById('hub-fulltext'); if (!box) return;
      if (q.length < 2 || type === 'images') { box.classList.add('hidden'); box.innerHTML = ''; return; }
      var self = this, hits = [];
      Object.values(this.data.subjects).forEach(function (s) {
        (s.topics || []).forEach(function (t) {
          var raw = s.notes && s.notes[t.id]; if (!raw) return;
          var plain = self.plainNote(raw), low = plain.toLowerCase(), idx = low.indexOf(q), n = 0, snips = [];
          while (idx > -1) {
            n++;
            if (snips.length < 2) {
              var a = Math.max(0, idx - 45), b = Math.min(plain.length, idx + q.length + 75);
              snips.push({ pre: plain.slice(a, idx), m: plain.slice(idx, idx + q.length), post: plain.slice(idx + q.length, b), lead: a > 0, tail: b < plain.length });
            }
            idx = low.indexOf(q, idx + q.length);
          }
          if (n) hits.push({ s: s, t: t, n: n, snips: snips });
        });
      });
      hits.sort(function (a, b) { return b.n - a.n; });
      this._lastFt = q;
      if (!hits.length) { box.innerHTML = '<div class="ft-empty">No notes contain “' + self.esc(q) + '”.</div>'; box.classList.remove('hidden'); return; }
      box.innerHTML = '<div class="ft-head"><i class="fas fa-magnifying-glass"></i> ' + hits.length + ' note' + (hits.length > 1 ? 's' : '') + ' mention “' + self.esc(q) + '”</div>' +
        hits.slice(0, 20).map(function (h) {
          return '<button class="ft-card" onclick="app.openSearchHit(\'' + h.s.id + '\',\'' + h.t.id + '\')">' +
            '<div class="ft-title">' + self.esc(h.t.name) + '<span class="ft-count">' + h.n + ' match' + (h.n > 1 ? 'es' : '') + '</span></div>' +
            '<div class="ft-sub">' + self.esc(h.s.name) + '</div>' +
            h.snips.map(function (sn) { return '<div class="ft-snip">' + (sn.lead ? '…' : '') + self.esc(sn.pre) + '<mark>' + self.esc(sn.m) + '</mark>' + self.esc(sn.post) + (sn.tail ? '…' : '') + '</div>'; }).join('') +
            '</button>';
        }).join('');
      box.classList.remove('hidden');
    },
    openSearchHit: function (sid, tid) { this._pendingSearch = this._lastFt; this.viewTopicNote(sid, tid); },

   openVideoPanel: function (title, text) {
      var list = window.CBTVideo.collect(text);
      if (!list.length) { this.toast('No videos in this note.', 'error'); return; }
      var t = document.getElementById('note-video-title'); if (t) t.textContent = title + ' · Videos (' + list.length + ')';
      var body = document.getElementById('note-video-body'); if (body) body.innerHTML = window.CBTVideo.listHtml(list);
      var modal = document.getElementById('note-video-modal'); if (modal) modal.classList.remove('hidden');
    },
    closeVideoPanel: function () {
      var modal = document.getElementById('note-video-modal'); if (modal) modal.classList.add('hidden');
      var body = document.getElementById('note-video-body'); if (body) body.innerHTML = ''; // stops playback
    },
    viewNoteVideos: function () {
      var c = this._currentNote; if (!c) return;
      this.openVideoPanel(c.name, c.text);
    },
    viewTopicVideos: function (subjectId, topicId) {
      if (this._needMaterials('viewTopicVideos', arguments)) return;
      var subject = this.data.subjects[subjectId]; if (!subject || !subject.notes) return;
      var topic = (subject.topics || []).find(function (t) { return t.id === topicId; });
      this.openVideoPanel(topic ? topic.name : 'Topic', subject.notes[topicId] || '');
    },

   viewTopicImages: function (subjectId, topicId) {
      if (this._needMaterials('viewTopicImages', arguments)) return;
       
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
   getSubjectTheme: function(name) {
      var n = name.toLowerCase();
      if (n.includes('physic')) return { icon: 'fa-atom', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      if (n.includes('probab') || n.includes('math')) return { icon: 'fa-dice', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      if (n.includes('bible') || n.includes('studi')) return { icon: 'fa-book-bible', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      if (n.includes('linear') || n.includes('algebra')) return { icon: 'fa-calculator', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
      if (n.includes('fluid') || n.includes('mechanic')) return { icon: 'fa-water', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' };
      if (n.includes('chem')) return { icon: 'fa-flask', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      return { icon: 'fa-book', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' };
    },

    filterCandidateSubjects: function(query) {
      var q = query.toLowerCase().trim();
      this.hubFullText(q, type);
      var cards = document.querySelectorAll('.subject-card-container');
      cards.forEach(function(card) {
        var name = card.getAttribute('data-subject-name').toLowerCase();
        if (name.includes(q)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    },
    
     
     
    showCandidateOptions: function () {
      this.data.mode = 'candidate-options';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;
      
      var subjects = Object.values(this.data.subjects);
      
      // Sort subjects: those with the most recent results come first
      subjects.sort(function(a, b) {
        var lastA = self.data.results.filter(function(r){ return r.subjectName === a.name; }).pop();
        var lastB = self.data.results.filter(function(r){ return r.subjectName === b.name; }).pop();
        if (!lastA && !lastB) return 0;
        if (!lastA) return 1;
        if (!lastB) return -1;
        return new Date(lastB.date) - new Date(lastA.date);
      });

      var cardsHTML = subjects.map(function (s) {
        var theme = self.getSubjectTheme(s.name);
        
        // Get Last Score
        var subjectResults = self.data.results.filter(function(r){ return r.subjectName === s.name; });
        var lastResult = subjectResults.length ? subjectResults[subjectResults.length - 1] : null;
        var scoreBadge = '';
        if (lastResult) {
          var isPass = lastResult.percentage >= 50;
          var color = isPass ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400';
          scoreBadge = '<span class="score-badge ' + color + '"><i class="fas fa-chart-line"></i> Last: ' + lastResult.percentage + '%</span>';
        }

        var qCount = s.questions ? s.questions.length : 0;
        var tCount = s.topics ? s.topics.length : 0;
        var duration = s.duration || 30;

        return '<div class="subject-card-container w-full" data-subject-name="' + self.esc(s.name) + '">' +
          '<div class="subject-card" onclick="app.showModeSelection(\'' + s.id + '\')">' +
          '<div class="subject-accent-line" style="background:' + theme.color + '"></div>' +
          
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="flex items-center gap-3">' +
          '<div class="subject-icon-wrapper" style="background:' + theme.bg + '; color:' + theme.color + '"><i class="fas ' + theme.icon + '"></i></div>' +
          '<div>' +
          '<h3 class="font-extrabold text-lg text-gray-100 leading-tight">' + self.esc(s.name) + '</h3>' +
          (scoreBadge ? '<div class="mt-1">' + scoreBadge + '</div>' : '') +
          '</div>' +
          '</div>' +
          '<i class="fas fa-arrow-right text-gray-500 text-lg mt-1"></i>' +
          '</div>' +

          '<div class="flex flex-wrap items-center gap-2 mt-4">' +
          '<span class="dash-tag"><i class="fas fa-list-check" style="color:' + theme.color + '"></i> ' + qCount + ' questions</span>' +
          '<span class="dash-tag"><i class="fas fa-clock" style="color:' + theme.color + '"></i> ' + duration + ' min</span>' +
          '<span class="dash-tag"><i class="fas fa-layer-group" style="color:' + theme.color + '"></i> ' + tCount + ' topics</span>' +
          '</div>' +
          '</div></div>';
      }).join('');

      var mainHTML = '<div class="dash-header">' +
        '<button onclick="app.showLanding()" class="text-xs font-bold text-gray-400 hover:text-white mb-3 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Back to home</button>' +
        '<h2 class="text-2xl md:text-3xl font-extrabold text-white mb-1">Choose your subject</h2>' +
        '<p class="text-sm text-gray-400 mb-4">Select a paper to configure your attempt.</p>' +
        '<div class="relative max-w-md">' +
        '<i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"></i>' +
        '<input type="text" class="dash-search-input" placeholder="Search subjects..." oninput="app.filterCandidateSubjects(this.value)">' +
        '</div></div>' +
        
        '<div class="p-4 md:p-6 max-w-5xl mx-auto">' +
        (subjects.length ? '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + cardsHTML + '</div>' :
          '<div class="rounded-2xl bg-white border border-gray-200 p-10 text-center"><div class="text-4xl mb-3">🗂️</div><p class="text-gray-500">No subjects loaded. Add a question bank to get started.</p></div>') +
        '</div>';

      container.innerHTML = mainHTML;
      container.scrollTop = 0;
    },

    // --- STUDY HUB HELPERS ---
    getSubjectIcon: function(subjectName) {
      var name = subjectName.toLowerCase();
      if (name.includes('physic')) return 'fa-atom';
      if (name.includes('probab') || name.includes('math')) return 'fa-dice';
      if (name.includes('bible') || name.includes('studi')) return 'fa-cross';
      if (name.includes('linear') || name.includes('algebra')) return 'fa-calculator';
      if (name.includes('fluid') || name.includes('mechanic')) return 'fa-water';
      if (name.includes('chem')) return 'fa-flask';
      return 'fa-book';
    },

    getNoteSnippet: function(noteText) {
      if (!noteText) return 'No text available.';
      // Strip HTML tags using a temporary DOM element
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = noteText;
      var text = tempDiv.textContent || tempDiv.innerText || "";
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length === 0) return 'No text available.';
      return text.substring(0, 80) + (text.length > 80 ? '...' : '');
    },

    toggleHubAccordion: function(index) {
      var content = document.getElementById('accordion-content-' + index);
      var icon = document.getElementById('accordion-icon-' + index);
      var isOpen = content.classList.contains('open');
      
      if (isOpen) {
        content.classList.remove('open');
        icon.classList.remove('open');
      } else {
        content.classList.add('open');
        icon.classList.add('open');
      }
    },

        handleHubFilter: function(query, type) {
      var cards = document.querySelectorAll('.hub-topic-card');
      var accordions = document.querySelectorAll('.accordion-item');
      var q = query.toLowerCase().trim();
      
      cards.forEach(function(card) {
        var text = card.innerText.toLowerCase();
        var hasNotes = card.getAttribute('data-has-notes') === 'true';
        var hasImages = card.getAttribute('data-has-images') === 'true';
        
        var matchesSearch = q === '' || text.includes(q);
        var matchesType = type === 'all' || (type === 'notes' && hasNotes) || (type === 'images' && hasImages);
        
        if (matchesSearch && matchesType) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });

      accordions.forEach(function(acc) {
        // Check if any child card is NOT hidden
        var hasVisibleCards = Array.from(acc.querySelectorAll('.hub-topic-card')).some(function(c) {
          return c.style.display !== 'none';
        });
        
        if (hasVisibleCards) {
          acc.style.display = 'block';
        } else {
          acc.style.display = 'none';
        }
      });
    },

       showAllNotes: function () {
      if (this._needMaterials('showAllNotes', arguments)) return;
      this.data.mode = 'all-notes';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      this.updateHeader();
      var self = this;
      var container = document.getElementById('app-container');
      if (!container) return;

      // Check for Continue Reading data
      var lastRead = null;
      try { lastRead = JSON.parse(localStorage.getItem('cbt_last_read')); } catch(e) {}
      
      var continueHTML = '';
      if (lastRead && this.data.subjects[lastRead.subjectId]) {
        continueHTML = '<div class="continue-card" onclick="app.viewTopicNote(\'' + lastRead.subjectId + '\',\'' + lastRead.topicId + '\',\'' + self.esc(lastRead.topicName) + '\')">' +
          '<div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0"><i class="fas fa-book-reader text-lg"></i></div>' +
          '<div class="min-w-0 flex-grow">' +
          '<div class="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">Continue Reading</div>' +
          '<div class="text-sm font-bold text-white truncate">' + self.esc(lastRead.topicName) + '</div>' +
          '<div class="text-xs text-gray-400 truncate">' + self.esc(lastRead.subjectName) + '</div>' +
          '</div><i class="fas fa-chevron-right text-amber-500"></i></div>';
      }

      var subjects = Object.values(this.data.subjects);
      var accordionsHTML = '';
      var validSubjectsCount = 0;

      subjects.forEach(function (s, idx) {
        var topics = self.studyMaterialTopics(s);
        if (topics.length === 0) return; // Skip subjects with no materials
        validSubjectsCount++;

        var icon = self.getSubjectIcon(s.name);
        var prog = self.subjectProgress(s);
        var totalNotes = topics.filter(function(t){ return t.hasNotes; }).length;
        var totalImages = topics.reduce(function(acc, t){ return acc + t.images; }, 0);

        var topicsHTML = topics.map(function (t) {
          var noteText = s.notes && s.notes[t.id] ? s.notes[t.id] : '';
          var snippet = t.hasNotes ? self.getNoteSnippet(noteText) : '';
          
          return '<div class="hub-topic-card" data-has-notes="' + (t.hasNotes ? 'true' : 'false') + '" data-has-images="' + (t.images > 0 ? 'true' : 'false') + '">' +
            '<div class="flex items-start justify-between gap-3">' +
            '<div class="min-w-0 flex-grow">' +
            '<h4 class="font-bold text-sm text-gray-200">' + self.esc(t.name) + self.readBadge(s, t.id) + '</h4>' +
            (t.hasNotes ? '<p class="hub-snippet mt-1">' + self.esc(snippet) + '</p>' : '') +
            '</div>' +
            '<div class="flex flex-col gap-2 shrink-0">' +
            (t.hasNotes ? '<button onclick="app.viewTopicNote(\'' + s.id + '\',\'' + t.id + '\',\'' + self.esc(t.name) + '\')" class="hub-action-btn hub-btn-notes"><i class="fas fa-book-open"></i> Read Notes</button>' : '') +
            (t.images > 0 ? '<button onclick="app.viewTopicImages(\'' + s.id + '\',\'' + t.id + '\')" class="hub-action-btn hub-btn-images"><i class="fas fa-images"></i> Images (' + t.images + ')</button>' : '') +
            (t.videos > 0 ? '<button onclick="app.viewTopicVideos(\'' + s.id + '\',\'' + t.id + '\')" class="hub-action-btn hub-btn-images"><i class="fas fa-circle-play"></i> Videos (' + t.videos + ')</button>' : '') +
            '</div></div></div>';
        }).join('');

        accordionsHTML += '<div class="accordion-item">' +
          '<button class="accordion-header" onclick="app.toggleHubAccordion(' + idx + ')">' +
          '<div class="flex items-center gap-3">' +
          '<div class="w-8 h-8 rounded-lg bg-[#101830] border border-[#1e2740] flex items-center justify-center text-gray-300"><i class="fas ' + icon + '"></i></div>' +
          '<div class="text-left"><div class="font-bold text-sm text-gray-100">' + self.esc(s.name) + '</div>' +
          '<div class="text-[10px] text-gray-500 font-semibold">' + totalNotes + ' notes · ' + totalImages + ' images' + (prog.total ? ' · ' + prog.read + '/' + prog.total + ' read' : '') + '</div>' +
          (prog.total ? '<div class="hub-progress"><span style="width:' + Math.round(prog.read / prog.total * 100) + '%"></span></div>' : '') + '</div>' +
          '</div>' +
          '<i class="fas fa-chevron-down accordion-icon text-gray-500" id="accordion-icon-' + idx + '"></i>' +
          '</button>' +
          '<div class="accordion-content" id="accordion-content-' + idx + '">' + topicsHTML + '</div></div>';
      });

      var mainHTML = '<div class="hub-header">' +
        '<button onclick="app.showLanding()" class="text-xs font-bold text-gray-400 hover:text-white mb-3 inline-flex items-center gap-1.5"><i class="fas fa-arrow-left"></i> Back to home</button>' +
        '<div class="flex items-center justify-between gap-2 mb-1"><h2 class="text-2xl font-extrabold text-white">Study Hub</h2>' +
        '<button onclick="app.openSaved()" class="hub-action-btn hub-btn-notes"><i class="fas fa-bookmark"></i> Saved</button></div>' +
        '<p class="text-xs text-gray-400 mb-4">Browse notes, images, and diagrams across all subjects.</p>' +
        '<div class="relative">' +
        '<i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"></i>' +
        '<input type="text" id="hub-search" class="hub-search-input" placeholder="Search topics or keywords..." oninput="app.handleHubFilter(this.value, document.querySelector(\'.hub-filter-btn.active\').getAttribute(\'data-type\'))">' +
        '</div>' +
        '<div class="hub-filter-tabs">' +
        '<button class="hub-filter-btn active" data-type="all" onclick="app.handleHubFilter(document.getElementById(\'hub-search\').value, \'all\'); document.querySelectorAll(\'.hub-filter-btn\').forEach(b=>b.classList.remove(\'active\')); this.classList.add(\'active\')">All Materials</button>' +
        '<button class="hub-filter-btn" data-type="notes" onclick="app.handleHubFilter(document.getElementById(\'hub-search\').value, \'notes\'); document.querySelectorAll(\'.hub-filter-btn\').forEach(b=>b.classList.remove(\'active\')); this.classList.add(\'active\')">Notes Only</button>' +
        '<button class="hub-filter-btn" data-type="images" onclick="app.handleHubFilter(document.getElementById(\'hub-search\').value, \'images\'); document.querySelectorAll(\'.hub-filter-btn\').forEach(b=>b.classList.remove(\'active\')); this.classList.add(\'active\')">Images Only</button>' +
        '</div></div>' +
        '<div class="p-4 max-w-4xl mx-auto">' +
        continueHTML +
        '<div id="hub-fulltext" class="hidden mb-4"></div>' +
        (validSubjectsCount > 0 ? accordionsHTML : '<div class="text-center py-12"><div class="text-4xl mb-3">📭</div><p class="text-gray-500">No study materials available yet.</p></div>') +
        '</div>';

      container.innerHTML = mainHTML;
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
            '<input type="number" class="topic-quantity w-16 px-2 py-1.5 rounded-lg border border-gray-300 text-sm text-center disabled:opacity-50" data-sub-topic-id="' + subId + '" value="' + qids.length + '" min="0" max="' + qids.length + '" disabled onchange="app.clampSubTopicQuantity(this)" oninput="app.clampSubTopicQuantity(this)" onblur="app.clampSubTopicQuantity(this)">' +     
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
      
      // 1. If the user cleared the field to type a new number, let them!
      // Do not disable the input or uncheck the box immediately.
      if (input.value === '') {
        return; 
      }
      
      // 2. Clamp the value between 0 and max
      if (isNaN(val)) val = 0;
      if (val < 0) val = 0;
      if (val > max) val = max;
      input.value = val;
      
      // 3. Sync the checkbox state in the background
      var checkbox = document.querySelector('input[name="exam-topic"][data-sub-topic-id="' + input.getAttribute('data-sub-topic-id') + '"]');
      if (checkbox) {
        checkbox.checked = (val > 0);
        // REMOVED: input.disabled = !checkbox.checked; 
        // This was causing the input to lock you out while typing!
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
