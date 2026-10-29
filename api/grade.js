export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured in Vercel' });

    try {
        const { type, data } = req.body;
        let payload = {};

        // 1. TEXT GRADING (Fill-in-the-gap)
        if (type === 'text') {
            const { studentAnswer, correctAnswer, questionText } = data;
            payload = {
                model: "deepseek/deepseek-r1:free", // ✅ Free text model on OpenRouter
                messages: [
                    { role: "system", content: `You are an automated examiner. Compare the student's answer to the correct answer. A positive result (score >= 80) means the student's answer is semantically correct, even if the wording is different. Return ONLY a valid JSON object: {"score": 0-100, "reason": "string"}` },
                    { role: "user", content: `Question: "${questionText}"\nCorrect Answer: "${correctAnswer}"\nStudent Answer: "${studentAnswer}"` }
                ],
                response_format: { type: "json_object" }
            };
        
        // 2. TYPED THEORY GRADING
        } else if (type === 'theory_text') {
            const { studentAnswer, questionText, maxMarks } = data;
            payload = {
                model: "deepseek/deepseek-r1:free", // ✅ Free text model on OpenRouter
                messages: [
                    { role: "system", content: `You are an automated examiner. Read the student's typed theory answer and grade it out of ${maxMarks} marks. Be fair and look for key concepts. Return ONLY a valid JSON object: {"score": 0-${maxMarks}, "reason": "string"}` },
                    { role: "user", content: `Question: "${questionText}"\nMax Marks: ${maxMarks}\nStudent Answer: "${studentAnswer}"` }
                ],
                response_format: { type: "json_object" }
            };
        
        // 3. IMAGE / HANDWRITING GRADING
        } else if (type === 'image') {
            const { imageBase64, questionText, maxMarks } = data;
            payload = {
                model: "qwen/qwen-2.5-vl-7b-instruct:free", // ✅ Free vision model on OpenRouter
                messages: [
                    { role: "system", content: `You are an automated examiner. Read the student's handwritten answer in the image and grade it out of ${maxMarks} marks. Return ONLY a valid JSON object: {"score": 0-${maxMarks}, "reason": "string"}` },
                    { role: "user", content: [
                        { type: "text", text: `Question: "${questionText}"\nMax Marks: ${maxMarks}` },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                    ]}
                ],
                response_format: { type: "json_object" }
            };
        }

        // Call OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                // Optional but recommended by OpenRouter for app attribution
                'HTTP-Referer': 'https://academycby.vercel.app', 
                'X-OpenRouter-Title': 'University eduCBT'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error?.message || JSON.stringify(result));
        }

        const content = result.choices[0].message.content;
        
        // Parse the JSON output safely
        let gradingResult;
        try {
            gradingResult = JSON.parse(content);
        } catch (e) {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                gradingResult = JSON.parse(match[0]);
            } else {
                throw new Error("AI did not return valid JSON: " + content);
            }
        }

        res.status(200).json(gradingResult);

    } catch (error) {
        console.error('OpenRouter Grading Error:', error);
        res.status(500).json({ error: error.message || 'Failed to grade' });
    }
}
