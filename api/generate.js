export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, systemText } = req.body;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://tuo-dominio.vercel.app', // Opzionale
                'X-Title': 'KDP Empire Builder' // Opzionale
            },
            body: JSON.stringify({
                // Modello consigliato: veloce, economico e perfetto per testi KDP
                "model": "meta-llama/llama-3.1-8b-instruct", 
                "messages": [
                    { "role": "system", "content": systemText || "Sei un esperto KDP." },
                    { "role": "user", "content": prompt }
                ]
            })
        });

        if (!response.ok) throw new Error(`OpenRouter Error: ${response.status}`);

        const data = await response.json();
        const text = data.choices[0].message.content;
        
        return res.status(200).json({ text });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Errore durante la generazione." });
    }
}
