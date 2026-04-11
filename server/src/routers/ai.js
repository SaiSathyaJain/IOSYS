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

=== INSTRUCTIONS ===
- You have COMPLETE data above — use it to answer accurately
- Look up specific entry numbers (INW/... or OTW/...) directly in the lists above
- For questions about outward, search the OUTWARD ENTRIES section
- You CANNOT modify the database — read-only assistance only
- Never say "I don't have access" if the data is in the snapshot above

=== STRICT ENTRY FORMAT (follow exactly when listing entries) ===
When showing inward entries, output EACH entry on its own line like this:
[INW/DD/MM/YYYY-NNNN] DD Mon YYYY | From: <particulars_from_whom> | Subject: <subject> | Team: <team or Unassigned> | Status: <status> | Due: <due date or Not set>

When showing outward entries, output EACH entry on its own line like this:
[OTW/YYYY/NNN] DD Mon YYYY | To: <to_whom> | Subject: <subject> | Sent by: <sent_by> | Team: <team> | Mode: <mode>

RULES:
- NEVER use bullet points, dashes, or numbered lists for entry rows
- NEVER reformat or restructure the entry lines — use the pipe (|) separator exactly
- You MAY write a short sentence before or after the entry lines (summary, count, etc.)
- For outward with case closed, append | Case CLOSED at the end of that line`;

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
                max_tokens: 1024,
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
