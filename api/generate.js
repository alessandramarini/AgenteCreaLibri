export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { provider, prompt, systemText } = req.body;

    try {
        let fetchUrl, fetchOptions;

        // 1. OPENROUTER
        if (provider === 'openrouter') {
            fetchUrl = 'https://openrouter.ai/api/v1/chat/completions';
            fetchOptions = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://kdp-empire.vercel.app',
                    'X-Title': 'KDP Empire Builder'
                },
                body: JSON.stringify({
                    "model": "meta-llama/llama-3.1-8b-instruct",
                    "temperature": 0.3, // <-- IL FIX: blocca le allucinazioni e le parole inventate
                    "top_p": 0.8,
                    "messages": [
                        { "role": "system", "content": systemText || "Sei un esperto KDP." },
                        { "role": "user", "content": prompt }
                    ]
                })
            };
        } 
        // 2. GROQ
        else if (provider === 'groq') {
            fetchUrl = 'https://api.groq.com/openai/v1/chat/completions';
            fetchOptions = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "model": "llama-3.1-70b-versatile",
                    "temperature": 0.3, // <-- IL FIX
                    "top_p": 0.8,
                    "messages": [
                        { "role": "system", "content": systemText || "Sei un esperto KDP." },
                        { "role": "user", "content": prompt }
                    ]
                })
            };
        } 
        // 3. GEMINI (Default)
        else {
            fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    systemInstruction: { parts: [{ text: systemText || "Sei un esperto KDP." }] },
                    generationConfig: {
                        temperature: 0.3, // <-- IL FIX
                        topP: 0.8
                    }
                })
            };
        }

        const response = await fetch(fetchUrl, fetchOptions);
        if (!response.ok) throw new Error(`Provider ${provider} error: ${response.status}`);

        const data = await response.json();
        
        // Estrazione del testo in base alla struttura del provider
        const text = (provider === 'gemini') 
            ? data.candidates[0].content.parts[0].text 
            : data.choices[0].message.content;

        return res.status(200).json({ text });

    } catch (error) {
        console.error("ERRORE BACKEND:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
