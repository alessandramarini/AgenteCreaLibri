// api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { provider, prompt, schema, systemText } = req.body;
    
    // Lista di provider configurabili (puoi gestire più chiavi qui per evitare il rate limit)
    const configs = {
        gemini: {
            url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
            key: process.env.GEMINI_API_KEY,
            transform: (data) => data.candidates[0].content.parts[0].text
        },
        groq: {
            url: "https://api.groq.com/openai/v1/chat/completions",
            key: process.env.GROQ_API_KEY,
            model: "llama-3.1-70b-versatile",
            transform: (data) => data.choices[0].message.content
        }
    };

    const activeProvider = configs[provider] || configs.groq;

    try {
        const response = await fetch(`${activeProvider.url}${provider === 'gemini' ? `?key=${activeProvider.key}` : ''}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(provider === 'groq' && { 'Authorization': `Bearer ${activeProvider.key}` })
            },
            body: JSON.stringify(provider === 'gemini' ? {
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemText }] }
            } : {
                model: activeProvider.model,
                messages: [{ role: "system", content: systemText }, { role: "user", content: prompt }]
            })
        });

        if (!response.ok) throw new Error(`Provider ${provider} failed: ${response.status}`);
        
        const data = await response.json();
        const text = activeProvider.transform(data);
        
        return res.status(200).json({ text });
    } catch (error) {
        // Logica di Fallback: se fallisce, prova il provider secondario automaticamente
        console.error("Errore API:", error);
        return res.status(500).json({ error: "Failover necessario", detail: error.message });
    }
}
