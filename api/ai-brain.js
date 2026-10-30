export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key missing in Vercel' });

    try {
        const { studentAnswer, referenceAnswer, maxMarks, imageBase64, isImage } = req.body;

        // 🛡️ STEP 1: Ask Groq for the live list of models
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const modelsData = await modelsRes.json();

        let chosenModel = null;
        let prompt = '';
        let messages = [];

        // Get a simple array of all available model IDs
        const availableModels = modelsData.data.map(m => m.id);

        if (isImage && imageBase64) {
            // --- VISION MODE (Handwriting) ---
            // Dynamically find ANY model that supports vision/multimodal
            const visionModels = availableModels.filter(id => 
                id.includes('vision') || id.includes('vlm') || id.includes('multimodal')
            );
            
            if (visionModels.length > 0) {
                chosenModel = visionModels[0]; // Automatically pick the first available vision model
            } else {
                throw new Error("No vision models are currently available on this Groq account.");
            }

            prompt = `
                You are an automated examiner for any academic subject.
                Question Context (Admin's Answer): "${referenceAnswer}"
                Maximum Marks: ${maxMarks}

                The student has uploaded an image of their handwritten answer.
                Please do two things:
                1. Transcribe the handwritten text from the image accurately.
                2. Grade the student's transcribed answer fairly based on the Admin's answer.

                Return ONLY a valid JSON object.
                {"score": (number from 0 to ${maxMarks}), "reason": "A brief explanation.", "transcription": "The exact text you read from the image"}
            `;

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
            // Find text models (exclude vision models)
            const textModels = availableModels.filter(id => 
                !id.includes('vision') && !id.includes('whisper')
            );

            // Optional: Try to prefer the ones you originally had, but fallback to any text model
            const preferredTextModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'];
            chosenModel = preferredTextModels.find(p => textModels.includes(p)) || textModels[0];

            if (!chosenModel) throw new Error("No text models found on Groq.");

            prompt = `
                You are an automated examiner for any academic subject.
                Question Context (Admin's Answer): "${referenceAnswer}"
                Student's Answer: "${studentAnswer}"
                Maximum Marks: ${maxMarks}

                Grade the student's answer fairly based on the Admin's answer.

                Return ONLY a valid JSON object.
                {"score": (number from 0 to ${maxMarks}), "reason": "A brief explanation."}
            `;

            messages = [{ role: "user", content: prompt }];
        }

        console.log(`Using dynamically selected model: ${chosenModel} | Mode: ${isImage ? 'Vision' : 'Text'}`);

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
            transcription: aiResponse.transcription || null 
        });

    } catch (error) {
        console.error("AI Brain Error:", error);
        res.status(500).json({ error: error.message || "The AI Brain is currently offline." });
    }
}
