export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    try {
        const { type, data } = req.body;
        let payload = {};

        if (type === 'text') {
            const { studentAnswer, correctAnswer, questionText } = data;
            payload = {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: `You are an automated examiner. Compare the student's answer to the correct answer. Return ONLY a valid JSON object: {"score": 0-100, "reason": "string"}` },
                    { role: "user", content: `Question: "${questionText}"\nCorrect Answer: "${correctAnswer}"\nStudent Answer: "${studentAnswer}"` }
                ],
                response_format: { type: "json_object" }
            };
        } else if (type === 'theory_text') {
            const { studentAnswer, questionText, maxMarks } = data;
            payload = {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: `You are an automated examiner. Read the student's typed theory answer and grade it out of ${maxMarks} marks. Return ONLY a valid JSON object: {"score": 0-${maxMarks}, "reason": "string"}` },
                    { role: "user", content: `Question: "${questionText}"\nMax Marks: ${maxMarks}\nStudent Answer: "${studentAnswer}"` }
                ],
                response_format: { type: "json_object" }
            };
        } else if (type === 'image') {
            const { imageBase64, questionText, maxMarks } = data;
            payload = {
                model: "deepseek-chat", 
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

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error?.message || JSON.stringify(result));
        }

        const content = result.choices[0].message.content;
        
        // Safely extract JSON even if the AI adds markdown formatting
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
        console.error('Grading Error:', error);
        res.status(500).json({ error: error.message || 'Failed to grade' });
    }
}
