/* api/publish-bank.js — commits a file to GitHub */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    let { filename, code, repoOwner, repoName } = body;
    const githubToken = process.env.GITHUB_TOKEN;

    // Allow empty code if it's a .gitkeep file (used for folder creation)
    const isGitkeep = filename && filename.endsWith('.gitkeep');
    if (!githubToken || !repoOwner || !repoName || !filename || (!code && !isGitkeep)) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // 1. Remove any duplicate 'question-banks/' or leading slashes
    let cleanName = filename.replace(/^question-banks\//i, '').replace(/^\/+/, '');
    
    // 2. Force the path to ALWAYS start with question-banks/
    const path = `question-banks/${cleanName}`;
    
    // 3. Encode the path properly for GitHub
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedPath}`;
    
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eduCBT-builder'
    };

    // Check if file exists to get SHA
    let sha = null;
    const existing = await fetch(apiUrl, { headers });
    
    if (existing.ok) {
      const existingData = await existing.json();
      sha = existingData.sha || null;
    }

    // Upload
    const encoded = Buffer.from(String(code || ''), 'utf8').toString('base64');
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore: update ${cleanName}`,
        content: encoded,
        sha: sha || undefined,
        branch: 'main'
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub commit failed (${putRes.status}): ${errText.slice(0, 200)}`);
    }

    const commitData = await putRes.json();
    return res.status(200).json({
      success: true,
      message: 'Published successfully.',
      commitUrl: commitData.commit ? commitData.commit.html_url : null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Publishing failed.' });
  }
};
