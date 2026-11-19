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
    let { filename, code, repoOwner, repoName, action } = body;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken || !repoOwner || !repoName) {
      return res.status(400).json({ error: 'Missing GitHub credentials or repository config.' });
    }

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eduCBT-builder'
    };

    // ==========================================
    // ACTION: AUTO-UPDATE INDEX.HTML SCRIPT TAGS
    // ==========================================
    if (action === 'update-index' || filename === 'update-index') {
      const treeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`, { headers });
      if (!treeRes.ok) throw new Error('Failed to fetch repository tree.');
      const treeData = await treeRes.json();

      const noteFiles = [];
      const bankFiles = [];

      treeData.tree.forEach(item => {
        if (item.type !== 'blob' || !item.path.startsWith('question-banks/') || !item.path.endsWith('.js')) return;
        if (item.path.includes('question-loader.js')) return;

        if (item.path.endsWith('-bank.js')) {
          bankFiles.push(item.path);
        } else if (item.path.includes('notes') || item.path.endsWith('.js')) {
          noteFiles.push(item.path);
        }
      });

      const indexRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/index.html`, { headers });
      if (!indexRes.ok) throw new Error('Failed to fetch index.html.');
      const indexData = await indexRes.json();
      const indexSha = indexData.sha;
      let indexContent = Buffer.from(indexData.content, 'base64').toString('utf8');

      const noteTags = noteFiles.map(path => `  <script defer src="${path}"></script>`).join('\n');
      const bankTags = bankFiles.map(path => `  <script defer src="${path}"></script>`).join('\n');

      function replaceBlock(content, startMarker, endMarker, newTags) {
        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);
        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return content;
        const before = content.substring(0, startIndex + startMarker.length);
        const after = content.substring(endIndex);
        return `${before}\n${newTags}\n${after}`;
      }

      const updatedContent = replaceBlock(
        replaceBlock(
          indexContent, 
          '<!-- NOTES_SCRIPTS_START -->', 
          '<!-- NOTES_SCRIPTS_END -->', 
          noteTags
        ),
        '<!-- BANKS_SCRIPTS_START -->',
        '<!-- BANKS_SCRIPTS_END -->',
        bankTags
      );

      if (updatedContent === indexContent) {
        return res.status(200).json({ success: true, message: 'Index.html already up to date.' });
      }

      const updatedBase64 = Buffer.from(updatedContent, 'utf8').toString('base64');
      const putRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/index.html`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `chore: auto-update script bundles in index.html`,
          content: updatedBase64,
          sha: indexSha,
          branch: 'main'
        })
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new Error(`GitHub index commit failed (${putRes.status}): ${errText.slice(0, 100)}`);
      }

      return res.status(200).json({ success: true, message: 'index.html updated successfully.' });
    }

    // ==========================================
    // ACTION: PUBLISH STANDARD FILE
    // ==========================================
    const isGitkeep = filename && filename.endsWith('.gitkeep');
    if (!code && !isGitkeep) {
      return res.status(400).json({ error: 'Missing code content for file publication.' });
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
      message: 'File published successfully.',
      commitUrl: commitData.commit ? commitData.commit.html_url : null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Publishing failed.' });
  }
};
