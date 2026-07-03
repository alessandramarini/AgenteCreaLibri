export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { provider, prompt, schema, systemText } = req.body;

    try {
        let endpoint, headers, bodyPayload, aiTextResponse;

        if (provider === 'groq') {
            endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}` 
            };
            
            // Assicuriamoci che il system prompt non sia mai vuoto
            const safeSystemText = systemText || "Sei un assistente AI specializzato in Amazon KDP. Rispondi sempre in formato testo pulito o JSON se richiesto.";

            const messages = [
                { role: "system", content: safeSystemText },
                { role: "user", content: prompt }
            ];

            // Groq impone che la parola "json" sia esplicita nel messaggio utente se si usa json_object
            if (schema) {
                messages[1].content += "\n\nOUTPUT REQUIRED: JSON. You must return ONLY a valid JSON object matching this schema. No markdown, no intro:\n" + JSON.stringify(schema);
            }

            bodyPayload = JSON.stringify({
                model: "llama-3.3-70b-versatile", // AGGIORNATO AL MODELLO GROQ PIU' RECENTE E STABILE
                messages: messages,
                temperature: 0.7,
                ...(schema && { response_format: { type: "json_object" } })
            });

            const response = await fetch(endpoint, { method: 'POST', headers, body: bodyPayload });
            
            // Se c'è un errore, ORA ESTRAIAMO IL MOTIVO REALE DA GROQ
            if (!response.ok) {
                const errorDetails = await response.text();
                throw new Error(`Dettagli Groq: ${errorDetails}`);
            }
            
            const data = await response.json();
            aiTextResponse = data.choices?.[0]?.message?.content;

        } else if (provider === 'gemini') {
            endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`; 
            headers = { 'Content-Type': 'application/json' };
            
            const safeSystemText = systemText || "Sei un assistente AI specializzato in Amazon KDP.";

            bodyPayload = {
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: safeSystemText }] }
            };

            if (schema) {
                bodyPayload.generationConfig = { responseMimeType: "application/json", responseSchema: schema };
            }

            const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
            
            if (!response.ok) {
                const errorDetails = await response.text();
                throw new Error(`Dettagli Gemini: ${errorDetails}`);
            }
            
            const data = await response.json();
            aiTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
            return res.status(400).json({ error: 'Provider AI non riconosciuto' });
        }

        if (!aiTextResponse) throw new Error("L'AI ha restituito una risposta vuota.");

        // Formatta e spedisci al frontend
        if (schema) {
            let cleanJson = aiTextResponse.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '').trim();
            return res.status(200).json(JSON.parse(cleanJson));
        } else {
            return res.status(200).json({ text: aiTextResponse });
        }

    } catch (error) {
        console.error("Backend Errore:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
