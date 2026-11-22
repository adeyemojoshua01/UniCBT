/* api/youtube-playlist.js
   GET /api/youtube-playlist?list=PLxxxx  ->  { title, items: [{ id, title }], total, truncated }
   Used by the note builder to list the videos inside a PUBLIC (or unlisted) YouTube playlist.

   Two modes:
   1. YOUTUBE_API_KEY set in your Vercel environment variables  -> official YouTube Data API (most reliable, up to 500 videos).
   2. No key                                                    -> reads the public playlist page (works without setup, first ~100 videos).
*/

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function textOf(t) {
  if (!t) return '';
  if (t.simpleText) return t.simpleText;
  if (Array.isArray(t.runs)) return t.runs.map(r => r.text).join('');
  return '';
}

/* ---- Mode 2: parse the playlist page's embedded JSON (ytInitialData) ---- */
function parsePlaylistHtml(html) {
  const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) throw new Error('Could not read the playlist page (is the playlist public?)');
  let data;
  try { data = JSON.parse(m[1]); } catch (e) { throw new Error('Playlist page format not recognised'); }

  const items = [], seen = new Set();
  let truncated = false;
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.playlistVideoRenderer) {
      const r = node.playlistVideoRenderer;
      const title = textOf(r.title);
      if (r.videoId && !seen.has(r.videoId) && r.isPlayable !== false && !/^(Private|Deleted) video$/i.test(title)) {
        seen.add(r.videoId); items.push({ id: r.videoId, title: title || 'Video' });
      }
      return;
    }
    if (node.continuationItemRenderer) truncated = true;
    Object.keys(node).forEach(k => walk(node[k]));
  })(data);

  const meta = data.metadata && data.metadata.playlistMetadataRenderer;
  const title = (meta && meta.title) || textOf(data.header && data.header.playlistHeaderRenderer && data.header.playlistHeaderRenderer.title) || '';
  return { title, items, total: items.length, truncated };
}

async function viaPage(list) {
  const r = await fetch('https://www.youtube.com/playlist?list=' + encodeURIComponent(list) + '&hl=en', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'CONSENT=YES+1; SOCS=CAI' }
  });
  if (!r.ok) throw new Error('YouTube returned ' + r.status);
  return parsePlaylistHtml(await r.text());
}

/* ---- Mode 1: official API ---- */
async function viaApi(list, key) {
  const items = [];
  let pageToken = '', pages = 0, truncated = false;
  do {
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=' + encodeURIComponent(list) +
      '&key=' + encodeURIComponent(key) + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || 'YouTube API error ' + r.status);
    (j.items || []).forEach(it => {
      const s = it.snippet || {};
      const id = s.resourceId && s.resourceId.videoId;
      if (id && !/^(Private|Deleted) video$/i.test(s.title || '')) items.push({ id, title: s.title || 'Video' });
    });
    pageToken = j.nextPageToken || '';
    pages++;
  } while (pageToken && pages < 10);
  if (pageToken) truncated = true;

  let title = '';
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=' + encodeURIComponent(list) + '&key=' + encodeURIComponent(key));
    const j = await r.json();
    title = (j.items && j.items[0] && j.items[0].snippet && j.items[0].snippet.title) || '';
  } catch (e) { /* title is optional */ }
  return { title, items, total: items.length, truncated };
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Use GET.' }); }

  const list = String((req.query && req.query.list) || '').trim();
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(list)) return res.status(400).json({ error: 'Missing or invalid playlist id.' });

  try {
    const key = process.env.YOUTUBE_API_KEY;
    const result = key ? await viaApi(list, key) : await viaPage(list);
    if (!result.items.length) return res.status(404).json({ error: 'No public videos found in that playlist.' });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Could not read the playlist.' });
  }
}

module.exports = handler;
module.exports.parsePlaylistHtml = parsePlaylistHtml;
