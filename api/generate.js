export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { provider, prompt, schema, systemText } = req.body;

    // Funzione helper per chiamare Gemini (usata sia come scelta principale che come fallback)
    async function callGemini() {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const headers = { 'Content-Type': 'application/json' };
        const safeSystemText = systemText || "Sei un assistente AI specializzato in Amazon KDP.";
        
        const bodyPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: safeSystemText }] }
        };

        if (schema) {
            bodyPayload.generationConfig = { responseMimeType: "application/json", responseSchema: schema };
        }

        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini Error: ${errText}`);
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    try {
        let aiTextResponse;

        if (provider === 'groq') {
            // Recupera l'array di chiavi separate da virgola
            let keys = [];
            if (process.env.GROQ_API_KEYS) {
                keys = process.env.GROQ_API_KEYS.split(',').map(k => k.trim()).filter(k => k);
            } else if (process.env.GROQ_API_KEY) {
                keys = [process.env.GROQ_API_KEY.trim()];
            }

            if (keys.length === 0) throw new Error("Nessuna chiave Groq configurata su Vercel.");

            const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            const safeSystemText = systemText || "Sei un assistente AI specializzato in Amazon KDP. Rispondi sempre in formato testo pulito o JSON se richiesto.";
            const messages = [
                { role: "system", content: safeSystemText },
                { role: "user", content: prompt }
            ];

            if (schema) {
                messages[1].content += "\n\nOUTPUT REQUIRED: JSON. You must return ONLY a valid JSON object matching this schema. No markdown, no intro:\n" + JSON.stringify(schema);
            }

            const bodyPayload = JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                temperature: 0.7,
                ...(schema && { response_format: { type: "json_object" } })
            });

            let groqSuccess = false;

            // ROTAZIONE CHIAVI GROQ
            for (let i = 0; i < keys.length; i++) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys[i]}` },
                        body: bodyPayload
                    });

                    // Se la chiave ha finito i crediti (429) o è invalida (401), ignora e passa alla successiva
                    if (response.status === 429 || response.status === 401 || response.status === 400) {
                        console.warn(`[API] Chiave Groq ${i + 1} esaurita o bloccata (Status: ${response.status}). Passo alla successiva...`);
                        continue; 
                    }

                    if (!response.ok) throw new Error(`Status ${response.status}`);

                    const data = await response.json();
                    aiTextResponse = data.choices?.[0]?.message?.content;
                    groqSuccess = true;
                    break; // Chiave funzionante, interrompe il ciclo for
                } catch (e) {
                    console.warn(`[API] Errore di rete con Chiave Groq ${i + 1}: ${e.message}`);
                    continue;
                }
            }

            // FALLBACK EMERGENZA SU GEMINI
            if (!groqSuccess) {
                console.warn("[API] Tutte le chiavi Groq hanno esaurito i crediti. Fallback invisibile su Gemini attivato.");
                aiTextResponse = await callGemini();
            }

        } else if (provider === 'gemini') {
            aiTextResponse = await callGemini();
        } else {
            return res.status(400).json({ error: 'Provider AI non riconosciuto' });
        }

        if (!aiTextResponse) throw new Error("L'AI ha restituito una risposta vuota.");

        // Parsing e invio al frontend
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
