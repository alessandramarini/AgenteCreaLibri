export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { provider, prompt, systemText } = req.body;

    try {
        // Usiamo OpenRouter come orchestratore principale per stabilità
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://kdp-empire.vercel.app',
                'X-Title': 'KDP Empire Builder'
            },
            body: JSON.stringify({
                "model": "meta-llama/llama-3.1-8b-instruct", 
                "messages": [
                    { "role": "system", "content": systemText || "Sei un esperto KDP." },
                    { "role": "user", "content": prompt }
                ]
            })
        });

        if (!response.ok) throw new Error(`OpenRouter Error: ${response.status}`);
        const data = await response.json();
        return res.status(200).json({ text: data.choices[0].message.content });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
