/* api/publish-bank.js — commits a file to GitHub and updates index.html */
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

    if (!githubToken || !repoOwner || !repoName || !filename) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eduCBT-builder'
    };

    // ==========================================
    // ACTION 1: UPDATE INDEX.HTML SCRIPT TAGS
    // ==========================================
    if (filename === 'update-index') {
      // 1. Fetch the tree
      const treeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`, { headers });
      if (!treeRes.ok) throw new Error('Failed to fetch repository tree.');
      const treeData = await treeRes.json();

      // Strictly get ONLY the notes files
      const noteFiles = treeData.tree
        .filter(item => 
          item.type === 'blob' && 
          item.path.startsWith('question-banks/') && 
          item.path.endsWith('.js') && 
          !item.path.endsWith('-bank.js') && 
          !item.path.endsWith('question-loader.js') &&
          item.path !== 'question-banks/question-loader.js'
        )
        .map(item => item.path);

      // 2. Fetch index.html
      const indexRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/index.html`, { headers });
      if (!indexRes.ok) throw new Error('Failed to fetch index.html.');
      const indexData = await indexRes.json();
      const indexSha = indexData.sha;
      const indexContent = Buffer.from(indexData.content, 'base64').toString('utf8');

      // 3. Generate new script tags
      // 3. Generate new script tags (FIX: Added defer)
      const scriptTags = noteFiles.map(path => `  <script defer src="${path}"></script>`).join('\n');
      // 4. Safely replace the content between markers
      const startMarker = '<!-- NOTES_SCRIPTS_START -->';
      const endMarker = '<!-- NOTES_SCRIPTS_END -->';
      
      const startIndex = indexContent.indexOf(startMarker);
      const endIndex = indexContent.indexOf(endMarker);

      if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return res.status(400).json({ error: 'Could not find valid start/end markers in index.html.' });
      }

      const before = indexContent.substring(0, startIndex + startMarker.length);
      const after = indexContent.substring(endIndex);
      
      const updatedContent = `${before}\n${scriptTags}\n${after}`;

      // 5. Commit if changed
      if (updatedContent === indexContent) {
        return res.status(200).json({ success: true, message: 'No changes needed.' });
      }

      const updatedBase64 = Buffer.from(updatedContent, 'utf8').toString('base64');
      const putRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/index.html`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `chore: auto-update notes scripts in index.html`,
          content: updatedBase64,
          sha: indexSha,
          branch: 'main'
        })
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new Error(`GitHub commit failed (${putRes.status}): ${errText.slice(0, 100)}`);
      }

      return res.status(200).json({ success: true, message: 'index.html updated successfully.' });
    }

    // ==========================================
    // ACTION 2: PUBLISH NORMAL FILES (NOTES/SVGS)
    // ==========================================
    const isGitkeep = filename && filename.endsWith('.gitkeep');
    if (!code && !isGitkeep) {
      return res.status(400).json({ error: 'Missing code content.' });
    }

    let cleanName = filename.replace(/^question-banks\//i, '').replace(/^\/+/, '');
    const path = `question-banks/${cleanName}`;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedPath}`;

    let sha = null;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
      const existingData = await existing.json();
      sha = existingData.sha || null;
    }

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
