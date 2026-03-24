// AI service using OpenRouter API (fetch-based — CF Workers compatible)

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'mistralai/mistral-7b-instruct:free';

/**
 * Fetch a summary of recent inward/outward entries to give the AI context.
 */
async function getDbContext(db) {
    try {
        const [inwardRes, outwardRes] = await Promise.all([
            db.prepare(`SELECT inward_no, subject, particulars_from_whom, assigned_team, assignment_status, due_date
                        FROM inward ORDER BY id DESC LIMIT 20`).all(),
            db.prepare(`SELECT outward_no, subject, to_whom, created_by_team, case_closed
                        FROM outward ORDER BY id DESC LIMIT 10`).all(),
        ]);

        const inwardSummary = (inwardRes.results || [])
            .map(r => `${r.inward_no}: "${r.subject}" from ${r.particulars_from_whom} → ${r.assigned_team || 'Unassigned'} [${r.assignment_status}]`)
            .join('\n');

        const outwardSummary = (outwardRes.results || [])
            .map(r => `${r.outward_no}: "${r.subject}" to ${r.to_whom} by ${r.created_by_team} [${r.case_closed ? 'Closed' : 'Open'}]`)
            .join('\n');

        return `Recent Inward Entries:\n${inwardSummary || 'None'}\n\nRecent Outward Entries:\n${outwardSummary || 'None'}`;
    } catch {
        return '';
    }
}

/**
 * Chat with AI using OpenRouter.
 * @param {Array}  messages  - Array of { role, content } objects
 * @param {object} db        - Cloudflare D1 database binding
 * @param {string} apiKey    - OPENROUTER_API_KEY from env
 */
export async function chatWithAi(messages, db, apiKey) {
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    const dbContext = await getDbContext(db);

    const systemPrompt = `You are an intelligent assistant for the SSSIHL Inward/Outward Document Management System (IOSYS).
You help staff manage correspondence, track entries, and understand workflows.
Answer questions clearly and concisely. If asked about entries, refer to the data below.

${dbContext}`;

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://iosys.pages.dev',
            'X-Title': 'IOSYS Intelligence',
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response from AI.';
}
