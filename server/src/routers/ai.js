import { Hono } from 'hono';

export const aiRouter = new Hono();

// POST /api/ai/extract  — Smart Form Fill: extract fields from raw letter text
aiRouter.post('/extract', async (c) => {
    try {
        const { text } = await c.req.json();
        if (!text || typeof text !== 'string' || text.trim().length < 5) {
            return c.json({ success: false, message: 'text is required' }, 400);
        }
        if (!c.env.OPENROUTER_API_KEY) {
            return c.json({ success: false, message: 'OPENROUTER_API_KEY not configured' }, 500);
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

        const groqRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${c.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://iosys.coeofficeinward.workers.dev',
                'X-Title': 'IOSYS Assistant',
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-3-nano-30b-a3b:free',
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
        const { messages, model: requestedModel } = await c.req.json();

        if (!messages || !Array.isArray(messages)) {
            return c.json({ success: false, message: 'messages array required' }, 400);
        }

        const ALLOWED_MODELS = new Set([
            'nvidia/nemotron-3-nano-30b-a3b:free',
            'openai/gpt-oss-20b:free',
            'openai/gpt-oss-120b:free',
            'nvidia/nemotron-3-super-120b-a12b:free',
        ]);
        const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
        const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

        if (!c.env.OPENROUTER_API_KEY) {
            return c.json({ success: false, message: 'OPENROUTER_API_KEY not configured' }, 500);
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

        // Keyword search — extract meaningful words from user message and search full DB
        const STOPWORDS = new Set([
            'the','a','an','is','are','was','were','be','been','being','have','has','had',
            'do','does','did','will','would','could','should','may','might','can','shall',
            'any','all','some','no','not','and','or','but','if','in','on','at','to','for',
            'of','by','with','from','into','about','this','that','there','here','it','its',
            'we','you','they','he','she','me','him','her','us','them','who','what','which',
            'how','when','where','why','show','list','find','give','tell','get','let','see',
            'look','check','entry','entries','inward','outward','team','please','name',
            'student','pertaining','regarding','related','also','still','yet','even','just',
            'only','very','too','so','now','then','than','more','most','much','many','such',
            'own','same','other','our','your','their','yes','iam','sir','madam','dear',
        ]);
        const msgWords = (lastUserMsg.match(/\b[a-zA-Z]{3,}\b/g) || [])
            .map(w => w.toLowerCase())
            .filter(w => !STOPWORDS.has(w));
        const searchKeywords = [...new Set(msgWords)].slice(0, 3);

        let keywordSearchResults = '';
        if (searchKeywords.length > 0) {
            try {
                const iLike = searchKeywords.map(() =>
                    '(particulars_from_whom LIKE ? OR subject LIKE ? OR remarks LIKE ?)'
                ).join(' OR ');
                const iBinds = searchKeywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`]);
                const { results: iHits } = await c.env.DB.prepare(
                    `SELECT inward_no, subject, particulars_from_whom, assigned_team,
                            assignment_status, due_date, sign_receipt_datetime, remarks
                     FROM inward WHERE ${iLike} LIMIT 10`
                ).bind(...iBinds).all();

                const oLike = searchKeywords.map(() =>
                    '(subject LIKE ? OR to_whom LIKE ? OR remarks LIKE ?)'
                ).join(' OR ');
                const oBinds = searchKeywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`]);
                const { results: oHits } = await c.env.DB.prepare(
                    `SELECT outward_no, subject, to_whom, created_by_team, means, created_at, case_closed
                     FROM outward WHERE ${oLike} LIMIT 5`
                ).bind(...oBinds).all();

                if (iHits.length > 0 || oHits.length > 0) {
                    keywordSearchResults = `\nSEARCH RESULTS for [${searchKeywords.join(', ')}]:\n`;
                    if (iHits.length > 0) {
                        keywordSearchResults += 'INWARD MATCHES:\n' + iHits.map(e => {
                            const date = e.sign_receipt_datetime ? new Date(e.sign_receipt_datetime).toLocaleDateString('en-IN') : '-';
                            return `  ${e.inward_no}|${date}|${e.particulars_from_whom}|${e.subject}|${e.assigned_team || 'Unassigned'}|${e.assignment_status || 'Unassigned'}|${e.due_date || '-'}${e.remarks ? '|' + e.remarks : ''}`;
                        }).join('\n');
                    }
                    if (oHits.length > 0) {
                        keywordSearchResults += '\nOUTWARD MATCHES:\n' + oHits.map(e => {
                            const date = new Date(e.created_at).toLocaleDateString('en-IN');
                            return `  ${e.outward_no}|${date}|${e.to_whom}|${e.subject}|${e.created_by_team || '-'}${e.case_closed ? '|CLOSED' : ''}`;
                        }).join('\n');
                    }
                } else {
                    keywordSearchResults = `\nSEARCH for [${searchKeywords.join(', ')}]: No matching entries found in the full database.`;
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
${keywordSearchResults}
=== RULES ===
- Answer using the data above — never say "I don't have access" if data is shown
- Read-only — you cannot modify the database
- SEARCH RESULTS (if present above) are from a full database search — always use them to answer name/keyword queries; they are more complete than the latest-25 snapshot
- For unassigned entries: filter rows where team = "Unassigned" or "-"
- For overdue: entries where status != Completed and due date is past today
- For trend analysis: group by month using date in inward_no (INW/DD/MM/YYYY-NNNN)

=== OUTPUT FORMAT RULES ===
1. For aggregated/grouped/counted data (top senders, team stats, counts, trends, SLA, comparisons): use a markdown table. Do NOT include ENTRIES_JSON for these queries.
2. For listing actual entries (pending list, overdue list, recent entries, search results): write your text first, then one ENTRIES_JSON block (max 10 entries). If more exist, say "Showing X of Y" in your text.

ENTRIES_JSON format (only for #2 above):
ENTRIES_JSON
[
  {"no":"INW/...","type":"inward","date":"1 Apr 2026","from":"Sender","subject":"Subject text","team":"UG","status":"Pending","due":"2026-04-15"},
  {"no":"OTW/...","type":"outward","date":"1 Apr 2026","to":"Receiver","subject":"Subject","sentBy":"Name","team":"PhD","mode":"Email","file":"REF-1","closed":false}
]
END_ENTRIES_JSON

Rules: valid JSON array, double quotes, no trailing commas, "" for missing values, boolean for "closed", ONE block per reply max.
Never include ENTRIES_JSON for summary tables, counts, statistics, or grouped data — use a markdown table instead.`;

        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${c.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://iosys.coeofficeinward.workers.dev',
                'X-Title': 'IOSYS Assistant',
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                max_tokens: 2500,
                temperature: 0.4,
                stream: true,
            }),
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error('OpenRouter API error:', aiRes.status, errText);
            let errMsg = 'AI service error. Please try again.';
            try {
                const errJson = JSON.parse(errText);
                if (errJson?.error?.message) errMsg = errJson.error.message;
            } catch { /* use default */ }
            return c.json({ success: false, message: errMsg }, 500);
        }

        // Proxy the SSE stream directly to the client
        return new Response(aiRes.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('AI chat error:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});
