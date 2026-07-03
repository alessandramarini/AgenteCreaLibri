export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { provider, prompt, schema, systemText, type } = req.body;

    try {
        // --- 1. GENERAZIONE IMMAGINI (Higgsfield Fallback) ---
        if (type === 'image') {
            try {
                const response = await fetch('https://api.higgsfield.ai/v1/images/generations', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.HIGGSFIELD_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: "flux-2-pro", prompt: prompt })
                });
                if (!response.ok) throw new Error("Higgsfield fail");
                const data = await response.json();
                return res.status(200).json({ url: data.url || data.data[0].url });
            } catch (e) {
                const seed = Math.floor(Math.random() * 1000000);
                return res.status(200).json({ url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=600&seed=${seed}` });
            }
        }

        // --- 2. GENERAZIONE TESTO (Modello aggiornato) ---
        let aiTextResponse;

        if (provider === 'gemini' || provider === 'groq') { // Fallback unificato
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const bodyPayload = {
                contents: [{ parts: [{ text: prompt + (schema ? "\nJSON Format: " + JSON.stringify(schema) : "") }] }],
                systemInstruction: { parts: [{ text: systemText || "Sei un esperto KDP." }] }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            aiTextResponse = data.candidates[0].content.parts[0].text;
        }

        return res.status(200).json(schema ? JSON.parse(aiTextResponse.replace(/
http://googleusercontent.com/immersive_entry_chip/0

### Riassunto azionario per te:
1.  **Sposta i file alla radice** (non tenerti la cartella `kdp-empire-vercel` di mezzo).
2.  **Svuota la "Root Directory"** nelle impostazioni di Vercel.
3.  **Aggiorna il file `api/generate.js`** con il codice qui sopra (usa il modello `gemini-1.5-flash` standard, che è il più stabile ora).

Fai queste due modifiche e il sistema non avrà più scuse per fermarsi!
