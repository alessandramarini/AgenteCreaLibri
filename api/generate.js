export default async function handler(req, res) {
    // Accetta solo richieste POST
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
                // Prende la chiave dalle variabili d'ambiente di Vercel
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}` 
            };
            
            const messages = [
                { role: "system", content: systemText },
                { role: "user", content: prompt }
            ];

            if (schema) {
                messages[1].content += "\n\nIMPORTANTE: RESTITUISCI SOLO ED ESCLUSIVAMENTE UN OGGETTO JSON VALIDO CHE RISPETTI QUESTA STRUTTURA. NESSUNA INTRODUZIONE:\n" + JSON.stringify(schema);
            }

            bodyPayload = JSON.stringify({
                model: "llama3-70b-8192",
                messages: messages,
                temperature: 0.7,
                ...(schema && { response_format: { type: "json_object" } })
            });

            const response = await fetch(endpoint, { method: 'POST', headers, body: bodyPayload });
            if (!response.ok) throw new Error(`Groq Error: ${response.status}`);
            
            const data = await response.json();
            aiTextResponse = data.choices?.[0]?.message?.content;

        } else if (provider === 'gemini') {
            // Prende la chiave dalle variabili d'ambiente di Vercel
            endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`; 
            headers = { 'Content-Type': 'application/json' };
            
            bodyPayload = {
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemText }] }
            };

            if (schema) {
                bodyPayload.generationConfig = { responseMimeType: "application/json", responseSchema: schema };
            }

            const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
            if (!response.ok) throw new Error(`Gemini Error: ${response.status}`);
            
            const data = await response.json();
            aiTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
            return res.status(400).json({ error: 'Provider non valido' });
        }

        if (!aiTextResponse) throw new Error("Risposta vuota dall'AI");

        // Formatta la risposta e la invia al frontend
        if (schema) {
            let cleanJson = aiTextResponse.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '').trim();
            return res.status(200).json(JSON.parse(cleanJson));
        } else {
            return res.status(200).json({ text: aiTextResponse });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}