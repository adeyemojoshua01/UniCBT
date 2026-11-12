// POST /api/publish-bank — commits a generated question-bank .js file to GitHub.
// Vercel serverless function (CommonJS, no build step).
// NOTE: the client sends `githubToken`, but it is IGNORED — the server uses
// process.env.GITHUB_TOKEN so the token never has to live in the browser.

const PERMISSION_MESSAGE =
  "Permission Denied. Ensure your Fine-Grained token has 'Contents: Read and Write' access to this repository.";

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { filename, code, repoOwner, repoName } = body;
    const token = process.env.GITHUB_TOKEN;

    // 2. validate
    if (!token) return res.status(400).json({ error: 'GITHUB_TOKEN is not configured on the server.' });
    if (!repoOwner || !repoName || !filename || !code) {
      return res.status(400).json({ error: 'Missing required fields: repoOwner, repoName, filename and code.' });
    }
    if (/[\\/]/.test(filename) || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    // 3. target
    const path = 'question-banks/' + filename;
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'educbt-bank-publisher'
    };

    // 4. does the file already exist?  (404 = new file)
    let sha;
    const getRes = await fetch(`${apiUrl}?ref=main`, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    } else if (getRes.status === 404) {
      sha = undefined;
    } else if (getRes.status === 403 || getRes.status === 401) {
      throw new Error(PERMISSION_MESSAGE);
    } else {
      throw new Error(`GitHub lookup failed (HTTP ${getRes.status}).`);
    }

    // 5. + 6. commit
    const content = Buffer.from(code).toString('base64');
    const message = `${sha ? 'Update' : 'Add'} question bank ${filename} via eduCBT builder`;
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content, sha: sha || undefined, branch: 'main' })
    });

    if (!putRes.ok) {
      if (putRes.status === 403 || putRes.status === 404) throw new Error(PERMISSION_MESSAGE);
      let detail = '';
      try { detail = (await putRes.json()).message; } catch (e) { /* ignore */ }
      throw new Error(`GitHub commit failed (HTTP ${putRes.status})${detail ? ': ' + detail : ''}`);
    }

    // 7. success
    const commitData = await putRes.json();
    return res.status(200).json({
      success: true,
      message: `Published ${filename} successfully.`,
      commitUrl: commitData.commit && commitData.commit.html_url
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to publish the question bank.' });
  }
};
