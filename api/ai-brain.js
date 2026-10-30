export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key missing in Vercel' });

    try {
        // Accept both text and image inputs
        const { studentAnswer, referenceAnswer, maxMarks, imageBase64, isImage } = req.body;

        // 🛡️ STEP 1: Ask Groq for the live list of models
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const modelsData = await modelsRes.json();

        let chosenModel = null;
        let prompt = '';
        let messages = [];

        if (isImage && imageBase64) {
            // --- VISION MODE (Handwriting) ---
            const preferredVisionModels = [
                'llama-3.2-11b-vision-preview', 
                'llama-3.2-90b-vision-preview'
            ];
            
            for (const pref of preferredVisionModels) {
                if (modelsData.data.some(m => m.id === pref)) {
                    chosenModel = pref;
                    break;
                }
            }

            if (!chosenModel) {
                // Fallback to any available vision model
                const availableVision = modelsData.data.filter(m => m.id.includes('vision'));
                if (availableVision.length > 0) chosenModel = availableVision[0].id;
            }

            if (!chosenModel) throw new Error("No vision models found on Groq.");

            prompt = `
                You are an automated examiner for any academic subject.
                Question Context (Admin's Answer): "${referenceAnswer}"
                Maximum Marks: ${maxMarks}

                The student has uploaded an image of their handwritten answer.
                Please do two things:
                1. Transcribe the handwritten text from the image accurately.
                2. Grade the student's transcribed answer fairly based on the Admin's answer.
                - If the student's answer is factually wrong or contradicts the Admin, give a low score.
                - If the student's answer has the exact same meaning but uses different words, give a high score.

                Return ONLY a valid JSON object. Do not add any other text outside the JSON.
                {"score": (number from 0 to ${maxMarks}), "reason": "A brief explanation.", "transcription": "The exact text you read from the image"}
            `;

            // Groq Vision API uses the OpenAI multimodal format
            messages = [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: imageBase64 } }
                    ]
                }
            ];

        } else {
            // --- TEXT MODE (Typed answers) ---
            const preferredTextModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'];
            
            for (const pref of preferredTextModels) {
                if (modelsData.data.some(m => m.id === pref)) {
                    chosenModel = pref;
                    break;
                }
            }

            if (!chosenModel) {
                const availableText = modelsData.data.filter(m => 
                    (m.id.includes('llama') || m.id.includes('qwen') || m.id.includes('gpt-oss')) && 
                    !m.id.includes('vision')
                );
                if (availableText.length > 0) chosenModel = availableText[0].id;
            }

            if (!chosenModel) throw new Error("No text models found on Groq.");

            prompt = `
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

            messages = [{ role: "user", content: prompt }];
        }

        console.log(`Using live model: ${chosenModel} | Mode: ${isImage ? 'Vision' : 'Text'}`);

        // 🧠 STEP 3: Grade the answer
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: chosenModel,
                messages: messages,
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
            reason: aiResponse.reason || "Graded by AI.",
            transcription: aiResponse.transcription || null // Pass transcription back to frontend
        });

    } catch (error) {
        console.error("AI Brain Error:", error);
        res.status(500).json({ error: error.message || "The AI Brain is currently offline." });
    }
}
