// POST /api/ai-brain  — Groq proxy for AI theory grading (text + handwritten image)
// Vercel serverless function (CommonJS, no build step).

const GROQ_BASE = 'https://api.groq.com/openai/v1';

const VISION_PREFERENCE = [
  'qwen/qwen3.8-27b',
  'meta-models/muse-spark-open',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct'
];

const TEXT_PREFERENCE = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

function parseJsonLoose(content) {
  try { return JSON.parse(content); } catch (e) { /* try next strategy */ }
  const match = String(content).match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (e) { /* try repair */ }
    try {
      // repair un-escaped backslashes (LaTeX) that break JSON
      return JSON.parse(match[0].replace(/\\(?!["\\\/bfnrtu])/g, '\\\\'));
    } catch (e) { /* give up */ }
  }
  throw new Error('The AI returned an invalid response format.');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { studentAnswer, imageBase64, referenceAnswer, isImage } = body;
    const maxMarks = Number(body.maxMarks) || 10;

    if (isImage ? !imageBase64 : !studentAnswer) {
      return res.status(400).json({ error: isImage ? 'imageBase64 is required.' : 'studentAnswer is required.' });
    }

    // 3. discover which models this key can use
    const modelsRes = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!modelsRes.ok) {
      throw new Error(`Could not list Groq models (HTTP ${modelsRes.status}).`);
    }
    const modelsJson = await modelsRes.json();
    const availableModels = (modelsJson.data || []).map((m) => m.id);

    let model;
    let messages;

    if (isImage) {
      // 4. vision model + transcribe-and-grade prompt
      model = VISION_PREFERENCE.find((m) => availableModels.includes(m));
      if (!model) model = availableModels.find((id) => /vision|llava/i.test(id));
      if (!model) throw new Error('No vision-capable model is currently available on Groq.');

      const prompt =
        'You are a fair but rigorous examiner.\n' +
        'The attached image contains a student\'s HANDWRITTEN answer to an exam question.\n' +
        'Step 1: transcribe the handwriting as accurately as you can.\n' +
        'Step 2: grade the transcribed answer against the reference answer below.\n\n' +
        `REFERENCE (model) ANSWER:\n"""${referenceAnswer || 'General knowledge'}"""\n\n` +
        `Award a score between 0 and ${maxMarks} (decimals allowed), giving credit for correct ideas even if worded differently.\n` +
        'Respond with ONLY a JSON object of the form:\n' +
        '{"score": <number>, "reason": "<2-3 sentence feedback>", "transcription": "<what the student wrote>"}\n' +
        'If you use LaTeX, escape every backslash so the JSON stays valid.';

      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      }];
    } else {
      // 5. text model (no vision / whisper / guard models)
      const textModels = availableModels.filter((id) => !/vision|whisper|guard/i.test(id));
      model = TEXT_PREFERENCE.find((m) => textModels.includes(m)) || textModels[0];
      if (!model) throw new Error('No text model is currently available on Groq.');

      const prompt =
        'You are a fair but rigorous examiner marking a theory question.\n\n' +
        `REFERENCE (model) ANSWER:\n"""${referenceAnswer || 'General knowledge'}"""\n\n` +
        `STUDENT ANSWER:\n"""${studentAnswer}"""\n\n` +
        `Award a score between 0 and ${maxMarks} (decimals allowed), giving credit for correct ideas even if worded differently.\n` +
        'Respond with ONLY a JSON object of the form:\n' +
        '{"score": <number>, "reason": "<2-3 sentence feedback>"}\n' +
        'If you use LaTeX, escape every backslash so the JSON stays valid.';

      messages = [{ role: 'user', content: prompt }];
    }

    // 6. chat completion
    const completionRes = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 800,
        temperature: 0.1
      })
    });

    if (!completionRes.ok) {
      let detail = '';
      try { detail = (await completionRes.json()).error.message; } catch (e) { /* ignore */ }
      throw new Error(`Groq request failed (HTTP ${completionRes.status})${detail ? ': ' + detail : ''}`);
    }

    const completion = await completionRes.json();
    const content = completion.choices && completion.choices[0] && completion.choices[0].message
      ? completion.choices[0].message.content
      : '';

    // 7. parse (strict, then first {...} block)
    const parsed = parseJsonLoose(content);

    let score = Number(parsed.score);
    if (!isFinite(score)) score = 0;
    score = Math.max(0, Math.min(maxMarks, score));

    // 8. respond
    return res.status(200).json({
      score: score,
      reason: String(parsed.reason || ''),
      transcription: isImage ? String(parsed.transcription || '') : null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'The AI Brain is currently offline.' });
  }
};
