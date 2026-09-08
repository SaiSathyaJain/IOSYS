import { Hono } from 'hono';
import { normalizeTeam } from '../utils/teams.js';
import {
    OPENROUTER_TEXT_MODELS, OPENROUTER_VISION_MODELS, OPENROUTER_DEFAULT_MODEL,
    ALLOWED_CHAT_MODELS, GROQ_MODELS,
} from '../utils/aiModels.js';
import { extractJsonObject } from '../utils/aiJson.js';

export const aiRouter = new Hono();

/**
 * Start reading an SSE response and decide whether the model is actually
 * answering. OpenRouter returns HTTP 200 and then reports provider failures as
 * an `error` object inside the stream, so checking the status alone would proxy
 * an empty reply to the user instead of failing over to the next model.
 *
 * Reads until the model produces real output (content or reasoning), then
 * returns a stream that replays what was consumed and continues from there.
 * Returns { error } instead if the stream carried a failure.
 */
async function openStream(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const seen = [];
    let text = '';

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                reader.releaseLock();
                return { error: 'model returned an empty response' };
            }
            seen.push(value);
            text += decoder.decode(value, { stream: true });

            const errMatch = text.match(/"error"\s*:\s*\{[^}]*"message"\s*:\s*"([^"]+)"/);
            if (errMatch) {
                await reader.cancel();
                return { error: errMatch[1] };
            }

            // Any delta carrying content or reasoning means the model is running.
            if (/"(content|reasoning)"\s*:\s*"[^"]/.test(text)) {
                const stream = new ReadableStream({
                    start(controller) {
                        for (const chunk of seen) controller.enqueue(chunk);
                    },
                    async pull(controller) {
                        const { value, done } = await reader.read();
                        if (done) { controller.close(); return; }
                        controller.enqueue(value);
                    },
                    cancel(reason) { reader.cancel(reason); },
                });
                return { stream };
            }
        }
    } catch (err) {
        try { await reader.cancel(); } catch { /* already gone */ }
        return { error: err.message };
    }
}

/**
 * Ask a model for a JSON object, trying Groq first (higher free limits) and then
 * the OpenRouter models in order. Free models drop out or rate-limit often, and
 * a reasoning model sometimes answers with prose instead of JSON, so a model is
 * only accepted once its reply actually parses. Returns null if none succeed.
 */
async function completeJson(env, prompt, maxTokens = 2000) {
    const attempts = [];
    if (env.GROQ_API_KEY) {
        for (const model of GROQ_MODELS) {
            attempts.push({
                url: 'https://api.groq.com/openai/v1/chat/completions',
                headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                model,
            });
        }
    }
    if (env.OPENROUTER_API_KEY) {
        for (const model of OPENROUTER_TEXT_MODELS) {
            attempts.push({
                url: 'https://openrouter.ai/api/v1/chat/completions',
                headers: {
                    'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://iosys.coeofficeinward.workers.dev',
                    'X-Title': 'IOSYS Assistant',
                },
                model,
            });
        }
    }

    for (const attempt of attempts) {
        try {
            const res = await fetch(attempt.url, {
                method: 'POST',
                headers: attempt.headers,
                body: JSON.stringify({
                    model: attempt.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens,
                    temperature: 0.1,
                }),
            });
            if (!res.ok) {
                console.error(`Model ${attempt.model} failed:`, res.status, (await res.text()).slice(0, 200));
                continue;
            }
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content || '';
            return JSON.parse(extractJsonObject(raw));
        } catch (err) {
            console.error(`Model ${attempt.model} returned unusable output:`, err.message);
        }
    }
    return null;
}

// POST /api/ai/extract  — Smart Form Fill: extract fields from raw letter text
aiRouter.post('/extract', async (c) => {
    try {
        const { text } = await c.req.json();
        if (!text || typeof text !== 'string' || text.trim().length < 5) {
            return c.json({ success: false, message: 'text is required' }, 400);
        }
        if (!c.env.OPENROUTER_API_KEY && !c.env.GROQ_API_KEY) {
            return c.json({ success: false, message: 'No AI API key configured (GROQ_API_KEY or OPENROUTER_API_KEY)' }, 500);
        }

        const today = new Date().toISOString().split('T')[0];

        const prompt = `Extract fields from this letter/document and return ONLY a valid JSON object — no explanation, no markdown.

Fields to extract:
- "particularsFromWhom": sender name or organization (string)
- "subject": concise subject line, max 120 chars (string)
- "means": delivery mode — one of "Post" | "Email" | "Hand Delivery" | "Courier" | "" (string)
- "assignedTeam": which team should handle it — "UPAS" (undergraduate, postgraduate and professional), "DPAS" (doctoral), or "" if unclear (string)
- "dueDate": suggested deadline as YYYY-MM-DD — use 7 days from ${today} if urgent, 14 days if normal, "" if not applicable (string)
- "remarks": one short sentence capturing the key ask or action needed, or "" (string)

Letter text:
"""
${text.slice(0, 2000)}
"""

Return ONLY the JSON object:`;

        // Try each provider/model in turn. A free model can be rate-limited or
        // answer with reasoning prose instead of JSON, so keep going until one
        // returns something parseable.
        const fields = await completeJson(c.env, prompt);
        if (!fields) {
            return c.json({ success: false, message: 'AI service unavailable. Please try again later.' }, 500);
        }

        fields.assignedTeam = normalizeTeam(fields.assignedTeam);

        return c.json({ success: true, fields });
    } catch (error) {
        console.error('AI extract error:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// POST /api/ai/agent  — AI Agent actions (suggest-assign)
aiRouter.post('/agent', async (c) => {
    try {
        const { action, subject, from, remarks, means } = await c.req.json();

        if (action !== 'suggest-assign') {
            return c.json({ success: false, message: 'Unknown action' }, 400);
        }
        if (!subject || !from) {
            return c.json({ success: false, message: 'subject and from are required' }, 400);
        }

        const useGroq = !!c.env.GROQ_API_KEY;
        const apiKey  = useGroq ? c.env.GROQ_API_KEY : c.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return c.json({ success: false, message: 'No AI API key configured (GROQ_API_KEY or OPENROUTER_API_KEY)' }, 500);
        }

        const today = new Date().toISOString().split('T')[0];

        const prompt = `Classify this document and respond with ONLY a JSON object, nothing else.

From: ${from}
Subject: ${subject}
Remarks: ${remarks || ''}

Teams:
UPAS = undergraduate, postgraduate and professional (exams, hall tickets, bonafide, attendance, fee, admission, certificates; M.Tech, MBA, M.Sc, PGDM and professional courses)
DPAS = doctoral (research scholars, thesis, synopsis, fellowship, research grants)

Respond with ONLY this JSON (no explanation, no markdown, no extra text):
{"assignedTeam":"UPAS","assignmentInstructions":"Action for team.","dueDate":"${new Date(Date.now()+14*86400000).toISOString().split('T')[0]}","reasoning":"reason"}`;

        // Try Groq first (if key available), then fall back to OpenRouter models
        let raw = '';
        let succeeded = false;

        if (useGroq) {
            for (const groqModel of GROQ_MODELS) {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${c.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: groqModel,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 2000,
                        temperature: 0.1,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const content = data.choices?.[0]?.message?.content || '';
                    if (content.trim()) {
                        raw = content;
                        succeeded = true;
                        break;
                    }
                } else {
                    const errText = await res.text();
                    console.error(`Groq model ${groqModel} error:`, res.status, errText);
                }
            }
            if (!succeeded) console.error('All Groq models failed — falling back to OpenRouter');
        }

        // OpenRouter fallback (always tried if Groq failed or not configured)
        if (!succeeded && c.env.OPENROUTER_API_KEY) {
            const FALLBACK_MODELS = OPENROUTER_TEXT_MODELS;
            const orHeaders = {
                'Authorization': `Bearer ${c.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://iosys.coeofficeinward.workers.dev',
                'X-Title': 'IOSYS Agent',
            };
            for (const tryModel of FALLBACK_MODELS) {
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: orHeaders,
                    body: JSON.stringify({
                        model: tryModel,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 2000,
                        temperature: 0.1,
                    }),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`Agent model ${tryModel} failed:`, res.status, errText);
                    continue;
                }
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content || '';
                if (!content.trim()) {
                    console.error(`Agent model ${tryModel} returned empty content`);
                    continue;
                }
                raw = content;
                succeeded = true;
                break;
            }
        }

        if (!succeeded) {
            return c.json({ success: false, message: 'All AI models are currently unavailable. Please try again later.' }, 500);
        }

        console.log('Agent raw response:', raw);

        // Strip markdown fences, then try to extract a JSON object even if model adds surrounding text
        let jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Extract first {...} block if model added prose around the JSON
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        let suggestion;
        try {
            suggestion = JSON.parse(jsonStr);
        } catch {
            console.error('Agent JSON parse failed. Raw:', raw);
            // Build a fallback suggestion from the text using keyword matching
            const teamMatch = raw.match(/\b(UPAS\/PPAS|UPAS|PPAS|DPAS|upas\/ppas|upas|ppas|dpas)\b/);
            if (teamMatch) {
                const today = new Date();
                today.setDate(today.getDate() + 14);
                suggestion = {
                    assignedTeam: teamMatch[1],
                    assignmentInstructions: 'Please review and process this entry.',
                    dueDate: today.toISOString().split('T')[0],
                    reasoning: 'Extracted from AI response text.',
                };
            } else {
                return c.json({ success: false, message: 'AI could not determine the team. Try again.' }, 500);
            }
        }

        suggestion.assignedTeam = normalizeTeam(suggestion.assignedTeam);

        return c.json({ success: true, suggestion });
    } catch (error) {
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

        const VISION_MODELS = OPENROUTER_VISION_MODELS;
        const ALLOWED_MODELS = ALLOWED_CHAT_MODELS;
        const DEFAULT_MODEL = OPENROUTER_DEFAULT_MODEL;

        // Any image_url part in the conversation means we must use a vision-capable model
        const hasImage = messages.some(m =>
            Array.isArray(m.content) && m.content.some(part => part?.type === 'image_url')
        );

        let model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
        if (hasImage && !VISION_MODELS.includes(model)) {
            model = VISION_MODELS[0];
        }

        if (!c.env.OPENROUTER_API_KEY) {
            return c.json({ success: false, message: 'OPENROUTER_API_KEY not configured' }, 500);
        }

        // Cache DB context for 45 seconds — avoids 5 parallel D1 queries on every chat message.
        // Key rotates every 45s so data stays reasonably fresh.
        const ctxCache   = caches.default;
        const ctxBucket  = Math.floor(Date.now() / 45000);
        const ctxCacheKey = new Request(`https://iosys-internal/chat-context/${ctxBucket}`);

        let stats, teams, inward, outward, logs;
        const cachedCtx = await ctxCache.match(ctxCacheKey);
        if (cachedCtx) {
            ({ stats, teams, inward, outward, logs } = await cachedCtx.json());
        } else {
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

            stats   = statsRow.status === 'fulfilled' ? statsRow.value : {};
            teams   = teamRows.status === 'fulfilled' ? teamRows.value.results : [];
            inward  = allInward.status === 'fulfilled' ? allInward.value.results : [];
            outward = allOutward.status === 'fulfilled' ? allOutward.value.results : [];
            logs    = recentLogs.status === 'fulfilled' ? recentLogs.value.results : [];

            // Store in cache (fire-and-forget — don't block the response)
            c.executionCtx.waitUntil(
                ctxCache.put(ctxCacheKey, new Response(JSON.stringify({ stats, teams, inward, outward, logs }), {
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=45' },
                }))
            );
        }

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
- Read-only — you cannot modify the database yourself. Deleting, reassigning, closing, and marking-complete are all done by the user clicking a button on the entry card the UI renders from your ENTRIES_JSON — you never say "I've deleted it" or "done" for these; you only locate and present the entry
- SEARCH RESULTS (if present above) are from a full database search — always use them to answer name/keyword queries; they are more complete than the latest-25 snapshot
- For unassigned entries: filter rows where team = "Unassigned" or "-"
- For overdue: entries where status != Completed and due date is past today
- For trend analysis: group by month using date in inward_no (INW/DD/MM/YYYY-NNNN)
- If the user wants to delete, remove, or correct a wrongly created/duplicate entry but doesn't give an exact inward number: find the best-matching candidate(s) using SEARCH RESULTS / recent inward data (by sender, subject keywords, or date they mention), ask a brief clarifying question if more than one plausible match exists, then show the matching entry (or entries) via ENTRIES_JSON so they can review it and delete it directly from the card

=== OUTPUT FORMAT RULES ===
1. For aggregated/grouped/counted data (top senders, team stats, counts, trends, SLA, comparisons): use a markdown table. Do NOT include ENTRIES_JSON for these queries.
2. For listing actual entries (pending list, overdue list, recent entries, search results): write your text first, then one ENTRIES_JSON block (max 10 entries). If more exist, say "Showing X of Y" in your text.

ENTRIES_JSON format (only for #2 above):
ENTRIES_JSON
[
  {"no":"INW/...","type":"inward","date":"1 Apr 2026","from":"Sender","subject":"Subject text","team":"UPAS","status":"Pending","due":"2026-04-15"},
  {"no":"OTW/...","type":"outward","date":"1 Apr 2026","to":"Receiver","subject":"Subject","sentBy":"Name","team":"DPAS","mode":"Email","file":"REF-1","closed":false}
]
END_ENTRIES_JSON

Rules: valid JSON array, double quotes, no trailing commas, "" for missing values, boolean for "closed", ONE block per reply max.
Never include ENTRIES_JSON for summary tables, counts, statistics, or grouped data — use a markdown table instead.`;

        // Image messages can only fall back to other vision-capable models — a text-only
        // model would reject the image_url content part outright.
        const FALLBACK_MODELS = hasImage
            ? [model, ...VISION_MODELS]
            : [model, ...OPENROUTER_TEXT_MODELS];
        // Deduplicate while preserving order
        const tryModels = [...new Set(FALLBACK_MODELS)];

        const openRouterHeaders = {
            'Authorization': `Bearer ${c.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://iosys.coeofficeinward.workers.dev',
            'X-Title': 'IOSYS Assistant',
        };

        let aiRes = null;
        let lastErr = 'AI service error. Please try again.';
        let isRateLimit = false;

        for (const tryModel of tryModels) {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: openRouterHeaders,
                body: JSON.stringify({
                    model: tryModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages
                    ],
                    max_tokens: 4096,
                    temperature: 0.4,
                    stream: true,
                }),
            });

            if (res.ok) {
                // A provider can still fail *inside* a 200 stream ("Service
                // temporarily overloaded"), which would proxy through as an empty
                // reply. Read far enough to tell a real answer from an error
                // before committing to this model.
                const opened = await openStream(res);
                if (opened.stream) {
                    aiRes = { body: opened.stream };
                    break;
                }
                console.error(`Model ${tryModel} failed mid-stream:`, opened.error);
                lastErr = opened.error || lastErr;
                if (lastErr.toLowerCase().includes('rate limit') || lastErr.toLowerCase().includes('per-day')) {
                    isRateLimit = true;
                }
                continue;
            }

            // Parse error for logging/message
            const errText = await res.text();
            console.error(`OpenRouter error with model ${tryModel}:`, res.status, errText);
            try {
                const errJson = JSON.parse(errText);
                if (errJson?.error?.message) {
                    lastErr = errJson.error.message;
                    if (lastErr.toLowerCase().includes('rate limit') || lastErr.toLowerCase().includes('per-day')) {
                        isRateLimit = true;
                    }
                }
            } catch { /* use default */ }
        }

        if (!aiRes) {
            const message = isRateLimit
                ? 'Daily free model limit reached on OpenRouter. The AI assistant will be available again tomorrow, or add credits at openrouter.ai to restore access immediately.'
                : `AI service unavailable. ${lastErr}`;
            return c.json({ success: false, message }, 500);
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
