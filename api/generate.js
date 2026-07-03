export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { provider, prompt, schema, systemText, type } = req.body;

    // --- HELPER GEMINI (Usato sia di base che come piano B) ---
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
        // =========================================================
        // 1. GENERATORE DI IMMAGINI (HIGGSFIELD)
        // =========================================================
        if (type === 'image') {
             if(!process.env.HIGGSFIELD_API_KEY) throw new Error("Chiave Higgsfield mancante.");
             
             // NOTA: Usa l'endpoint standard. Se Higgsfield lo modifica, l'errore innesca il fallback sul frontend.
             const response = await fetch('https://api.higgsfield.ai/v1/images/generations', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${process.env.HIGGSFIELD_API_KEY}`
                 },
                 body: JSON.stringify({
                     model: "flux-2-pro", 
                     prompt: prompt
                 })
             });
             
             if (!response.ok) {
                 const errText = await response.text();
                 throw new Error(`Higgsfield Image Error: ${errText}`);
             }
             
             const data = await response.json();
             const imageUrl = data.data?.[0]?.url || data.url;
             if(!imageUrl) throw new Error("Formato risposta Higgsfield sconosciuto.");
             
             return res.status(200).json({ url: imageUrl });
        }

        // =========================================================
        // 2. GENERATORE DI TESTO (GROQ ROTATION + GEMINI FALLBACK)
        // =========================================================
        let aiTextResponse;

        if (provider === 'groq') {
            let keys = [];
            if (process.env.GROQ_API_KEYS) {
                keys = process.env.GROQ_API_KEYS.split(',').map(k => k.trim()).filter(k => k);
            } else if (process.env.GROQ_API_KEY) {
                keys = [process.env.GROQ_API_KEY.trim()];
            }

            if (keys.length === 0) throw new Error("Nessuna chiave Groq configurata su Vercel.");

            const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            const safeSystemText = systemText || "Sei un assistente AI specializzato in Amazon KDP. Rispondi in JSON se richiesto.";
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

            // Logica di Rotazione Chiavi
            for (let i = 0; i < keys.length; i++) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys[i]}` },
                        body: bodyPayload
                    });

                    // Se chiave limitata o bloccata, passa alla successiva
                    if (response.status === 429 || response.status === 401 || response.status === 400) {
                        console.warn(`[API] Chiave Groq ${i + 1} esaurita (Status: ${response.status}). Passo alla successiva...`);
                        continue; 
                    }

                    if (!response.ok) throw new Error(`Status ${response.status}`);

                    const data = await response.json();
                    aiTextResponse = data.choices?.[0]?.message?.content;
                    groqSuccess = true;
                    break; // Funzionante: interrompe il ciclo
                } catch (e) {
                    console.warn(`[API] Errore Chiave Groq ${i + 1}: ${e.message}`);
                    continue;
                }
            }

            // Piano B di Emergenza
            if (!groqSuccess) {
                console.warn("[API] Tutte le chiavi Groq sono KO. Attivazione Fallback invisibile su Gemini.");
                aiTextResponse = await callGemini();
            }

        } else if (provider === 'gemini') {
            aiTextResponse = await callGemini();
        } else {
            return res.status(400).json({ error: 'Provider AI non riconosciuto' });
        }

        if (!aiTextResponse) throw new Error("L'AI ha restituito una risposta vuota.");

        // Parsing ed Export finale
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
