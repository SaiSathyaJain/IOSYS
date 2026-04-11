import { Hono } from 'hono';

export const aiRouter = new Hono();

// POST /api/ai/extract  — Smart Form Fill: extract fields from raw letter text
aiRouter.post('/extract', async (c) => {
    try {
        const { text } = await c.req.json();
        if (!text || typeof text !== 'string' || text.trim().length < 5) {
            return c.json({ success: false, message: 'text is required' }, 400);
        }
        if (!c.env.GROQ_API_KEY) {
            return c.json({ success: false, message: 'GROQ_API_KEY not configured' }, 500);
        }

        const today = new Date().toISOString().split('T')[0];

        const prompt = `Extract fields from this letter/document and return ONLY a valid JSON object — no explanation, no markdown.

Fields to extract:
- "particularsFromWhom": sender name or organization (string)
- "subject": concise subject line, max 120 chars (string)
- "means": delivery mode — one of "Post" | "Email" | "Hand Delivery" | "Courier" | "" (string)
- "assignedTeam": which team should handle it — "UG" (undergraduate), "PG/PRO" (postgraduate/professional), "PhD" (doctoral), or "" if unclear (string)
- "dueDate": suggested deadline as YYYY-MM-DD — use 7 days from ${today} if urgent, 14 days if normal, "" if not applicable (string)
- "remarks": one short sentence capturing the key ask or action needed, or "" (string)

Letter text:
"""
${text.slice(0, 2000)}
"""

Return ONLY the JSON object:`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${c.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0.1,
            }),
        });

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            console.error('Groq extract error:', groqRes.status, errText);
            return c.json({ success: false, message: 'AI service error' }, 500);
        }

        const groqData = await groqRes.json();
        const raw = groqData.choices?.[0]?.message?.content || '';

        // Parse the JSON — strip any markdown fences if model added them
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let fields;
        try {
            fields = JSON.parse(jsonStr);
        } catch {
            console.error('Failed to parse AI extract response:', raw);
            return c.json({ success: false, message: 'AI returned invalid JSON. Try with clearer text.' }, 500);
        }

        return c.json({ success: true, fields });
    } catch (error) {
        console.error('AI extract error:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// POST /api/ai/chat
aiRouter.post('/chat', async (c) => {
    try {
        const { messages } = await c.req.json();

        if (!messages || !Array.isArray(messages)) {
            return c.json({ success: false, message: 'messages array required' }, 400);
        }

        if (!c.env.GROQ_API_KEY) {
            return c.json({ success: false, message: 'GROQ_API_KEY not configured' }, 500);
        }

        // Fetch live context from DB in parallel (reduced limits to save tokens)
        const [statsRow, teamRows, allInward, allOutward, recentLogs] = await Promise.allSettled([
            c.env.DB.prepare(`
                SELECT
                    COUNT(*) as total_inward,
                    SUM(CASE WHEN assignment_status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN assignment_status = 'Completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN assignment_status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN assigned_team IS NULL OR assigned_team = '' THEN 1 ELSE 0 END) as unassigned,
                    SUM(CASE WHEN due_date < DATE('now') AND assignment_status != 'Completed' THEN 1 ELSE 0 END) as total_overdue
                FROM inward
            `).first(),
            c.env.DB.prepare(`
                SELECT assigned_team,
                    COUNT(*) as total,
                    SUM(CASE WHEN assignment_status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN assignment_status = 'Completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN assignment_status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN due_date < DATE('now') AND assignment_status != 'Completed' THEN 1 ELSE 0 END) as overdue
                FROM inward
                WHERE assigned_team IS NOT NULL AND assigned_team != ''
                GROUP BY assigned_team
            `).all(),
            c.env.DB.prepare(`
                SELECT inward_no, subject, particulars_from_whom, means,
                       assigned_team, assignment_status, due_date,
                       sign_receipt_datetime, file_reference, remarks
                FROM inward ORDER BY created_at DESC LIMIT 25
            `).all(),
            c.env.DB.prepare(`
                SELECT outward_no, subject, to_whom, sent_by, means,
                       created_by_team, file_reference, postal_tariff,
                       case_closed, linked_inward_id, sign_receipt_datetime,
                       remarks, created_at
                FROM outward ORDER BY created_at DESC LIMIT 15
            `).all(),
            c.env.DB.prepare(`
                SELECT action, actor, description, inward_no, created_at
                FROM audit_log ORDER BY created_at DESC LIMIT 10
            `).all(),
        ]);

        const stats   = statsRow.status === 'fulfilled' ? statsRow.value : {};
        const teams   = teamRows.status === 'fulfilled' ? teamRows.value.results : [];
        const inward  = allInward.status === 'fulfilled' ? allInward.value.results : [];
        const outward = allOutward.status === 'fulfilled' ? allOutward.value.results : [];
        const logs    = recentLogs.status === 'fulfilled' ? recentLogs.value.results : [];

        // If user mentions a specific INW number, fetch its full audit trail
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        const inwardNoMatch = lastUserMsg.match(/INW\/\d{2}\/\d{2}\/\d{4}-\d+/i);
        let entryAuditTrail = '';
        if (inwardNoMatch) {
            try {
                const { results: entryLogs } = await c.env.DB.prepare(
                    `SELECT action, actor, description, created_at FROM audit_log WHERE inward_no = ? ORDER BY created_at ASC`
                ).bind(inwardNoMatch[0].toUpperCase()).all();
                if (entryLogs.length > 0) {
                    entryAuditTrail = `\nAUDIT FOR ${inwardNoMatch[0].toUpperCase()}:\n` +
                        entryLogs.map(l =>
                            `  [${new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}] ${l.actor}: ${l.description}`
                        ).join('\n');
                }
            } catch { /* ignore */ }
        }

        // Compact summaries (shorter format = fewer tokens)
        const teamSummary = teams.length > 0
            ? teams.map(t =>
                `  ${t.assigned_team}: total=${t.total} pending=${t.pending} inprogress=${t.in_progress} completed=${t.completed} overdue=${t.overdue}`
              ).join('\n')
            : '  No team assignments yet';

        const inwardSummary = inward.length > 0
            ? inward.map(e => {
                const date = e.sign_receipt_datetime ? new Date(e.sign_receipt_datetime).toLocaleDateString('en-IN') : '-';
                return `  ${e.inward_no}|${date}|${e.particulars_from_whom}|${e.subject}|${e.means || '-'}|${e.assigned_team || 'Unassigned'}|${e.assignment_status || 'Unassigned'}|${e.due_date || '-'}${e.remarks ? '|' + e.remarks : ''}`;
              }).join('\n')
            : '  No inward entries';

        const outwardSummary = outward.length > 0
            ? outward.map(e => {
                const date = e.sign_receipt_datetime
                    ? new Date(e.sign_receipt_datetime).toLocaleDateString('en-IN')
                    : new Date(e.created_at).toLocaleDateString('en-IN');
                return `  ${e.outward_no}|${date}|${e.to_whom}|${e.subject}|${e.sent_by || '-'}|${e.created_by_team || '-'}|${e.means || '-'}${e.file_reference ? '|' + e.file_reference : ''}${e.postal_tariff ? '|₹' + e.postal_tariff : ''}${e.case_closed ? '|CLOSED' : ''}${e.remarks ? '|' + e.remarks : ''}`;
              }).join('\n')
            : '  No outward entries';

        const logSummary = logs.length > 0
            ? logs.map(l =>
                `  [${new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}] ${l.actor}: ${l.description}${l.inward_no ? ' (' + l.inward_no + ')' : ''}`
              ).join('\n')
            : '  No activity';

        const systemPrompt = `You are IOSYS Assistant for SSSIHL's Inward/Outward Document Management System. You have live database access.
Current time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST

=== LIVE DATA ===

STATS: inward=${stats.total_inward || 0} | pending=${stats.pending || 0} | in_progress=${stats.in_progress || 0} | completed=${stats.completed || 0} | unassigned=${stats.unassigned || 0} | overdue=${stats.total_overdue || 0} | outward=${outward.length}

TEAMS (assigned_team|total|pending|in_progress|completed|overdue):
${teamSummary}

INWARD (latest 25, format: no|date|from|subject|mode|team|status|due[|remarks]):
${inwardSummary}

OUTWARD (latest 15, format: no|date|to|subject|sentBy|team|mode[|file][|postal][|CLOSED][|remarks]):
${outwardSummary}

ACTIVITY LOG (latest 10):
${logSummary}
${entryAuditTrail}
=== RULES ===
- Answer using the data above — never say "I don't have access" if data is shown
- Read-only — you cannot modify the database
- For unassigned entries: filter rows where team = "Unassigned" or "-"
- For overdue: entries where status != Completed and due date is past today
- For trend analysis: group by month using date in inward_no (INW/DD/MM/YYYY-NNNN)

=== ENTRY OUTPUT FORMAT (use whenever showing entries) ===
Write your text answer first, then one ENTRIES_JSON block (max 10 entries). If more exist, say "Showing X of Y" in your text.

ENTRIES_JSON
[
  {"no":"INW/...","type":"inward","date":"1 Apr 2026","from":"Sender","subject":"Subject text","team":"UG","status":"Pending","due":"2026-04-15"},
  {"no":"OTW/...","type":"outward","date":"1 Apr 2026","to":"Receiver","subject":"Subject","sentBy":"Name","team":"PhD","mode":"Email","file":"REF-1","closed":false}
]
END_ENTRIES_JSON

Rules: valid JSON array, double quotes, no trailing commas, "" for missing values, boolean for "closed", ONE block per reply max.`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${c.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                max_tokens: 1500,
                temperature: 0.4,
            }),
        });

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            console.error('Groq API error:', groqRes.status, errText);
            let errMsg = 'AI service error. Please try again.';
            try {
                const errJson = JSON.parse(errText);
                if (errJson?.error?.message) errMsg = errJson.error.message;
            } catch { /* use default */ }
            return c.json({ success: false, message: errMsg }, 500);
        }

        const groqData = await groqRes.json();
        const reply = groqData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

        return c.json({ success: true, reply });
    } catch (error) {
        console.error('AI chat error:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});
