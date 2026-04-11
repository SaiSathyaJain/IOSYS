import { Hono } from 'hono';

export const aiRouter = new Hono();

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

        // Fetch all live context from DB in parallel
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
                FROM inward ORDER BY created_at DESC LIMIT 50
            `).all(),
            c.env.DB.prepare(`
                SELECT outward_no, subject, to_whom, sent_by, means,
                       created_by_team, file_reference, postal_tariff,
                       case_closed, linked_inward_id, sign_receipt_datetime,
                       remarks, created_at
                FROM outward ORDER BY created_at DESC LIMIT 30
            `).all(),
            c.env.DB.prepare(`
                SELECT action, actor, description, inward_no, created_at
                FROM audit_log ORDER BY created_at DESC LIMIT 15
            `).all(),
        ]);

        const stats   = statsRow.status === 'fulfilled' ? statsRow.value : {};
        const teams   = teamRows.status === 'fulfilled' ? teamRows.value.results : [];
        const inward  = allInward.status === 'fulfilled' ? allInward.value.results : [];
        const outward = allOutward.status === 'fulfilled' ? allOutward.value.results : [];
        const logs    = recentLogs.status === 'fulfilled' ? recentLogs.value.results : [];

        // If the latest user message references a specific INW number, fetch its full audit trail
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        const inwardNoMatch = lastUserMsg.match(/INW\/\d{2}\/\d{2}\/\d{4}-\d+/i);
        let entryAuditTrail = '';
        if (inwardNoMatch) {
            try {
                const { results: entryLogs } = await c.env.DB.prepare(
                    `SELECT action, actor, description, created_at FROM audit_log WHERE inward_no = ? ORDER BY created_at ASC`
                ).bind(inwardNoMatch[0].toUpperCase()).all();
                if (entryLogs.length > 0) {
                    entryAuditTrail = `\nAUDIT TRAIL FOR ${inwardNoMatch[0].toUpperCase()}:\n` +
                        entryLogs.map(l =>
                            `  [${new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}] ${l.actor}: ${l.description}`
                        ).join('\n');
                } else {
                    entryAuditTrail = `\nAUDIT TRAIL FOR ${inwardNoMatch[0].toUpperCase()}: No activity recorded yet.`;
                }
            } catch { /* ignore */ }
        }

        const teamSummary = teams.length > 0
            ? teams.map(t =>
                `  - ${t.assigned_team} Team: ${t.total} assigned | ${t.pending} pending | ${t.in_progress} in progress | ${t.completed} completed | ${t.overdue} overdue`
              ).join('\n')
            : '  No team assignments yet';

        const inwardSummary = inward.length > 0
            ? inward.map(e =>
                `  [${e.inward_no}] ${e.sign_receipt_datetime ? new Date(e.sign_receipt_datetime).toLocaleDateString('en-IN') : 'No date'} | From: ${e.particulars_from_whom} | Subject: ${e.subject} | Mode: ${e.means || '-'} | Team: ${e.assigned_team || 'Unassigned'} | Status: ${e.assignment_status || 'Unassigned'} | Due: ${e.due_date || 'Not set'}${e.remarks ? ` | Remarks: ${e.remarks}` : ''}`
              ).join('\n')
            : '  No inward entries yet';

        const outwardSummary = outward.length > 0
            ? outward.map(e =>
                `  [${e.outward_no}] ${e.sign_receipt_datetime ? new Date(e.sign_receipt_datetime).toLocaleDateString('en-IN') : new Date(e.created_at).toLocaleDateString('en-IN')} | To: ${e.to_whom} | Subject: ${e.subject} | Sent by: ${e.sent_by || '-'} | Team: ${e.created_by_team || '-'} | Mode: ${e.means || '-'}${e.file_reference ? ` | File: ${e.file_reference}` : ''}${e.postal_tariff ? ` | Postal: ₹${e.postal_tariff}` : ''}${e.case_closed ? ' | Case CLOSED' : ''}${e.remarks ? ` | Remarks: ${e.remarks}` : ''}`
              ).join('\n')
            : '  No outward entries yet';

        const logSummary = logs.length > 0
            ? logs.map(l =>
                `  [${new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}] ${l.actor}: ${l.description}${l.inward_no ? ` (${l.inward_no})` : ''}`
              ).join('\n')
            : '  No activity yet';

        const systemPrompt = `You are IOSYS Assistant, an intelligent AI for SSSIHL's (Sri Sathya Sai Institute of Higher Learning) Inward/Outward Document Management System. You have full access to live database data.

Current date/time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST

=== LIVE DATABASE — COMPLETE SNAPSHOT ===

OVERALL STATS:
  - Total Inward: ${stats.total_inward || 0}
  - Total Outward: ${outward.length > 0 ? outward.length + ' (showing latest 30)' : 0}
  - Inward Pending: ${stats.pending || 0}
  - Inward In Progress: ${stats.in_progress || 0}
  - Inward Completed: ${stats.completed || 0}
  - Inward Unassigned: ${stats.unassigned || 0}
  - Total Overdue: ${stats.total_overdue || 0}

TEAM BREAKDOWN:
${teamSummary}

ALL INWARD ENTRIES (latest 50, newest first):
${inwardSummary}

ALL OUTWARD ENTRIES (latest 30, newest first):
${outwardSummary}

RECENT ACTIVITY LOG (last 15 actions):
${logSummary}
${entryAuditTrail}
=== INSTRUCTIONS ===
- You have COMPLETE data above — use it to answer accurately
- Look up specific entry numbers (INW/... or OTW/...) directly in the lists above
- For questions about outward, search the OUTWARD ENTRIES section
- You CANNOT modify the database — read-only assistance only
- Never say "I don't have access" if the data is in the snapshot above

=== CAPABILITY GUIDE ===

DAILY BRIEFING — when asked for today's briefing:
  State: entries received today (match today's date in inward_no), overdue count, team with most pending, any unassigned entries. Keep it to 4-5 bullet points.

TREND ANALYSIS — when asked about volume trends or patterns:
  Count entries per month from the inward_no dates (format INW/DD/MM/YYYY-NNNN). Compare months and state if volume is rising/falling.

SENDER ANALYSIS — when asked who sends the most:
  Group entries by particulars_from_whom, count each, sort descending, show top 10 as a numbered list.

BOTTLENECK DETECTION — when asked about longest pending:
  Find entries with status Pending/In Progress, sort by date in inward_no ascending (oldest first), show the oldest 10.

SLA / TURNAROUND — when asked about completion time:
  For completed entries that have both assignment and completion info in the audit log, estimate average days per team. If exact dates unavailable, state that clearly.

ENTRY CLASSIFICATION — when asked to categorise entries:
  Scan subject text and group into categories like: Exam/ESE, Certificate Requests, Attendance, Concessions, Duplicate Grade Card, Course Completion, General/Other. Show category name + count.

STATUS REPORT — when asked for a formal report:
  Output a professional paragraph: "As of [date], the COE office has received [N] inward entries. [Team breakdown]. [Overdue count] entries are overdue. [Unassigned count] entries await assignment."

TEAM COMPARISON — when asked to compare teams:
  Show a table-style text comparison: total assigned, pending, completed, overdue, completion rate % for each team.

ASSIGNMENT SUGGESTION — when asked which team should handle something:
  Read the subject/description, reason about UG (undergraduate), PG/PRO (postgraduate/professional), PhD, and suggest the best fit with a one-line reason.

DRAFT REPLY / FOLLOW-UP — when asked to draft a letter or follow-up:
  Write a formal, concise reply addressed appropriately. Start with "Respected Sir/Madam," and end with "Yours sincerely, Controller of Examinations, SSSIHL".

ENTRY LOOKUP — when asked about a specific INW or OTW number:
  Find it in the lists above and show full details as an entry card + a plain English 2-line summary of what action may be needed.

UNASSIGNED ENTRIES — when asked for unassigned entries:
  Filter inward entries where team = "" or "Unassigned" and show them as entry cards.

AUDIT TRAIL — when asked for activity on a specific entry:
  Search the RECENT ACTIVITY LOG for lines containing that inward_no and list them chronologically.

=== OUTPUT FORMAT FOR ENTRY DATA (MANDATORY) ===
Whenever you need to show one or more inward OR outward entries, you MUST output a JSON block in EXACTLY this structure — no exceptions:

ENTRIES_JSON
[
  {
    "no": "OTW/2026/001",
    "type": "outward",
    "date": "8 Apr 2026",
    "to": "Finance office",
    "subject": "Re: Shredded Paper amount",
    "sentBy": "PCS",
    "team": "PhD",
    "mode": "Email",
    "file": "GEN-17",
    "closed": true
  }
]
END_ENTRIES_JSON

For inward entries use these fields instead: "no", "type":"inward", "date", "from", "subject", "team", "status", "due"

RULES — follow exactly:
1. Write your answer text FIRST (e.g. "Here are the first 10 of 35 UG entries:")
2. Then output the ENTRIES_JSON block on its own line
3. The JSON must be a valid array — double quotes, no trailing commas
4. Use "" for missing values, true/false for closed (boolean)
5. NEVER use bullet points or numbered lists for entry data — use the JSON block only
6. ONE ENTRIES_JSON block per response maximum
7. MAXIMUM 10 entries per ENTRIES_JSON block — if there are more, say "Showing 10 of N" in the text and list only the first 10`;

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
                max_tokens: 2048,
                temperature: 0.5,
            }),
        });

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            console.error('Groq API error:', errText);
            return c.json({ success: false, message: 'AI service error. Please try again.' }, 500);
        }

        const groqData = await groqRes.json();
        const reply = groqData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

        return c.json({ success: true, reply });
    } catch (error) {
        console.error('AI chat error:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});
