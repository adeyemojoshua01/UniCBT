export default async function handler(req, res) {
    // 🚨 TEMPORARY DEBUG TEST
    if (req.method === 'GET') {
        return res.status(200).json({ 
            hasKey: !!process.env.GROQ_API_KEY,
            keyStart: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 4) : "none"
        });
    }
    //...rest of the code
    
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key missing in Vercel' });

    try {
        const { studentAnswer, referenceAnswer, maxMarks } = req.body;

        // Use a highly stable, fast model that supports JSON
        const chosenModel = "llama-3.1-8b-instant";

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
                temperature: 0.1 // Keep it focused and strict
            })
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error?.message || 'Groq API Error');
        }

        const content = result.choices[0].message.content;
        
        // 🛡️ Safe JSON parsing (in case the AI adds markdown like ```json)
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

        // Ensure score is a number
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
