export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured in Vercel' });
    }

    try {
        const { type, data } = req.body;
        let payload = {};

        if (type === 'text') {
            // Semantic Grading for Fill-in-the-Gap
            const { studentAnswer, correctAnswer, questionText } = data;
            payload = {
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: `You are an automated examiner. Compare the student's answer to the correct answer for the given question. A positive result (score >= 80) means the student's answer is semantically correct, even if the wording is different. Return ONLY a valid JSON object with this exact structure: {"score": 0-100, "reason": "string"}`
                    },
                    {
                        role: "user",
                        content: `Question: "${questionText}"\nCorrect Answer: "${correctAnswer}"\nStudent Answer: "${studentAnswer}"\n\nGrade this student answer. Return the JSON.`
                    }
                ],
                response_format: { type: "json_object" }
            };
            
        } else if (type === 'theory_text') {
            // NEW: Typed Theory Answer
            const { studentAnswer, questionText, maxMarks } = data;
            payload = {
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: `You are an automated examiner. Read the student's typed theory answer and grade it out of ${maxMarks} marks. Be fair and look for key concepts. Return ONLY a valid JSON object with this exact structure: {"score": 0-${maxMarks}, "reason": "string"}`
                    },
                    {
                        role: "user",
                        content: `Question: "${questionText}"\nMaximum Marks: ${maxMarks}\nStudent's Typed Answer: "${studentAnswer}"\n\nGrade this answer.`
                    }
                ],
                response_format: { type: "json_object" }
            };
            
           
        } else if (type === 'image') {
            // Theory Image Grading
            // Note: DeepSeek's API currently may require specific vision models. 
            // If DeepSeek doesn't support images yet, you can swap this URL to OpenAI (GPT-4o-mini) or Google Gemini.
            const { imageBase64, questionText, maxMarks } = data;
            payload = {
                model: "deepseek-vl", // Or "deepseek-chat" if they support vision natively
                messages: [
                    {
                        role: "system",
                        content: `You are an automated examiner. Analyze the image of the student's handwritten theory answer. Compare it to the question. Be lenient but fair. Return ONLY a valid JSON object with this exact structure: {"score": 0-${maxMarks}, "reason": "string"}`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Question: "${questionText}"\nMaximum Marks: ${maxMarks}\n\nPlease read and grade the attached handwritten answer.` },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                        ]
                    }
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
            throw new Error(result.error?.message || 'API error');
        }

        const gradingResult = JSON.parse(result.choices[0].message.content);
        res.status(200).json(gradingResult);

    } catch (error) {
        console.error('Grading Error:', error);
        res.status(500).json({ error: 'Failed to grade. Please try again.' });
    }
}
