/* api/publish-bank.js — commits a file to GitHub, creating folders if necessary */
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

    if (!githubToken || !repoOwner || !repoName || !filename || !code) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Sanitize path (remove leading/trailing slashes, fix double slashes)
    filename = filename.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    
    // GitHub API requires each path segment to be encoded separately
    const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedPath}`;
    
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eduCBT-builder'
    };

    // 1. Check if file exists to get SHA (required for updating)
    let sha = null;
    const existing = await fetch(apiUrl, { headers });
    
    if (existing.ok) {
      const existingData = await existing.json();
      sha = existingData.sha || null;
    } else if (existing.status !== 404) {
      const errText = await existing.text();
      throw new Error(`GitHub lookup failed (${existing.status}): ${errText.slice(0, 300)}`);
    }

    // 2. Prepare and Upload the file
    // Note: GitHub's /contents API DOES allow creating nested files as long as the final path is encoded right.
    const encoded = Buffer.from(String(code), 'utf8').toString('base64');
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore: update ${filename}`,
        content: encoded,
        sha: sha || undefined,
        branch: 'main'
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      
      // If it fails because folder doesn't exist, we give a clearer error
      if (putRes.status === 404 || putRes.status === 422) {
        throw new Error(`GitHub rejected the path. Ensure the repository has the base folder 'question-banks/' created. Raw error: ${errText.slice(0, 100)}`);
      }
      
      throw new Error(`GitHub commit failed (${putRes.status}): ${errText.slice(0, 300)}`);
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
