export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key missing' });

    try {
        const { studentAnswer, referenceAnswer, maxMarks } = req.body;

        // 1. 🛡️ FETCH LIVE MODELS (The Anti-Break Shield)
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const modelsData = await modelsRes.json();
        
        // Find a reliable text model from the live list
        // We prioritize the newest stable models on the free tier
        const preferredModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
        let chosenModel = null;
        
        for (const pref of preferredModels) {
            if (modelsData.data.some(m => m.id === pref)) {
                chosenModel = pref;
                break;
            }
        }
        
        // Fallback: If none of the preferred models are there, pick the first available text model
        if (!chosenModel) {
            const available = modelsData.data.filter(m => m.id.includes('llama') || m.id.includes('qwen') || m.id.includes('gpt-oss'));
            if (available.length > 0) chosenModel = available[0].id;
        }

        if (!chosenModel) throw new Error("No compatible text models found on Groq.");

        console.log(`Using live model: ${chosenModel}`);

        // 2. 🧠 GRADE THE ANSWER
        const prompt = `
            You are an automated examiner for any academic subject.
            Question Context (Admin's Answer): "${referenceAnswer}"
            Student's Answer: "${studentAnswer}"
            Maximum Marks: ${maxMarks}

            Grade the student's answer fairly based on the Admin's answer.
            - If the student's answer is factually wrong or contradicts the Admin, give a low score.
            - If the student's answer has the exact same meaning but uses different words, give a high score.
            
            Return ONLY a valid JSON object:
            {"score": (number from 0 to ${maxMarks}), "reason": "A brief explanation."}
        `;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: chosenModel, // ✅ Dynamically selected live model
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error?.message || 'Groq Error');

        const aiResponse = JSON.parse(result.choices[0].message.content);
        
        res.status(200).json({
            score: aiResponse.score,
            reason: aiResponse.reason
        });

    } catch (error) {
        console.error("AI Brain Error:", error);
        res.status(500).json({ error: "The AI Brain is currently offline. Try again later." });
    }
}
