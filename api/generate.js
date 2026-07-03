export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { provider, prompt, schema, systemText, type } = req.body;

    try {
        if (type === 'image') {
            const seed = Math.floor(Math.random() * 1000000);
            return res.status(200).json({ url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=600&seed=${seed}` });
        }

        // Chiamata Gemini ottimizzata
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key mancante");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemText || "Sei un esperto KDP." }] }
            })
        });

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        return res.status(200).json(schema ? JSON.parse(text.replace(/
http://googleusercontent.com/immersive_entry_chip/0

### 3. Debug istantaneo nel tuo `index.html`
Per capire se il problema è la chiave o il server, apri la console del browser (F12) mentre l'agente gira. Se vedi un errore 500, clicca sulla voce rossa in console: lì troverai il messaggio d'errore reale (es: "API KEY INVALID" o "TIMEOUT").

**Nota importante sulla stabilità:**
Se continui a ricevere `FUNCTION_INVOCATION_FAILED` anche dopo aver aggiornato il codice, significa che Vercel sta faticando a gestire le chiamate lunghe. 
**Prova a fare questo:**
1. Vai su Vercel > **Settings** > **Functions**.
2. Aumenta il **Timeout** della funzione se il piano lo permette, oppure semplicemente esegui un nuovo **Deploy** (Deployment tab -> Redeploy) per forzare il riavvio completo dei server.

Se il problema persiste, conferma se nella dashboard di Vercel, nella sezione **Logs**, compare un errore specifico (es. "Timeout" o "Module not found").
