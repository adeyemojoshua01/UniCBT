/* api/update-index.js — injects script tags into index.html */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { repoOwner, repoName, githubToken } = req.body;
    if (!repoOwner || !repoName || !githubToken) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eduCBT-builder'
    };

    // 1. Fetch the current tree to get all .js files in question-banks/
    const treeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error('Failed to fetch repository tree.');
    const treeData = await treeRes.json();

    const noteFiles = treeData.tree
      .filter(item => item.type === 'blob' && item.path.startsWith('question-banks/') && item.path.endsWith('.js') && item.path !== 'question-banks/question-loader.js')
      .map(item => item.path);

    // 2. Fetch index.html
    const indexRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/index.html`, { headers });
    if (!indexRes.ok) throw new Error('Failed to fetch index.html. Does it exist?');
    const indexData = await indexRes.json();
    const indexSha = indexData.sha;
    const indexContent = Buffer.from(indexData.content, 'base64').toString('utf8');

    // 3. Generate the script tags
    const scriptTags = noteFiles.map(path => `  <script src="${path}"></script>`).join('\n');

    // 4. Inject into index.html
    const startMarker = '<!-- NOTES_SCRIPTS_START -->';
    const endMarker = '<!-- NOTES_SCRIPTS_END -->';
    
    let updatedContent = indexContent;
    if (indexContent.includes(startMarker) && indexContent.includes(endMarker)) {
      // Replace content between markers
      const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
      updatedContent = indexContent.replace(regex, `${startMarker}\n${scriptTags}\n${endMarker}`);
    } else {
      // Fallback: insert before </body> if markers don't exist
      updatedContent = indexContent.replace('</body>', `${startMarker}\n${scriptTags}\n${endMarker}\n</body>`);
    }

    // 5. Check if content actually changed to avoid empty commits
    if (updatedContent === indexContent) {
      return res.status(200).json({ success: true, message: 'No changes needed.' });
    }

    // 6. Commit the updated index.html
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
      throw new Error(`Failed to update index.html: ${errText.slice(0, 200)}`);
    }

    return res.status(200).json({ success: true, message: 'index.html updated successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update index.html.' });
  }
};
