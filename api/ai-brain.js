export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key missing in Vercel' });

    try {
        const { studentAnswer, referenceAnswer, maxMarks } = req.body;

        // 🛡️ STEP 1: Ask Groq for the live list of models
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const modelsData = await modelsRes.json();

        // 🛡️ STEP 2: Pick a live model from the preferred list
        // These are the current active models on Groq's free tier
        const preferredModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'];
        let chosenModel = null;

        for (const pref of preferredModels) {
            if (modelsData.data.some(m => m.id === pref)) {
                chosenModel = pref;
                break;
            }
        }

        // Fallback: If none of the preferred models are there, pick the first available text model
        if (!chosenModel) {
            const available = modelsData.data.filter(m => 
                m.id.includes('llama') || m.id.includes('qwen') || m.id.includes('gpt-oss')
            );
            if (available.length > 0) chosenModel = available[0].id;
        }

        if (!chosenModel) {
            throw new Error("No compatible text models found on Groq.");
        }

        console.log(`Using live model: ${chosenModel}`);

        // 🧠 STEP 3: Grade the answer
        const prompt = `
            You are an automated examiner for any academic subject.
            Question Context (Admin's Answer): "${referenceAnswer}"
            Student's Answer: "${studentAnswer}"
            Maximum Marks: ${maxMarks}

            Grade the student's answer fairly based on the Admin's answer.
            - If the student's answer is factually wrong or contradicts the Admin, give a low score.
            - If the student's answer has the exact same meaning but uses different words, give a high score.
            - Do not give points for just using similar words if the logic is wrong.

            Return ONLY a valid JSON object. Do not add any other text outside the JSON.
            {"score": (number from 0 to ${maxMarks}), "reason": "A brief explanation."}
        `;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: chosenModel,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error?.message || 'Groq API Error');
        }

        const content = result.choices[0].message.content;

        // 🛡️ Safe JSON parsing
        let aiResponse;
        try {
            aiResponse = JSON.parse(content);
        } catch (e) {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                aiResponse = JSON.parse(match[0]);
            } else {
                throw new Error("AI did not return valid JSON: " + content);
            }
        }

        const finalScore = Number(aiResponse.score) || 0;

        res.status(200).json({
            score: finalScore,
            reason: aiResponse.reason || "Graded by AI."
        });

    } catch (error) {
        console.error("AI Brain Error:", error);
        res.status(500).json({ error: error.message || "The AI Brain is currently offline." });
    }
}
