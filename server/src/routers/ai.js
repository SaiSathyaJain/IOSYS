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

        // Fetch live context from DB in parallel
        const [statsRow, teamRows, recentEntries, recentLogs, outwardCount] = await Promise.allSettled([
            c.env.DB.prepare(`
                SELECT
                    COUNT(*) as total_inward,
                    SUM(CASE WHEN assignment_status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN assignment_status = 'Completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN assignment_status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN assigned_team IS NULL OR assigned_team = '' THEN 1 ELSE 0 END) as unassigned
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
                SELECT inward_no, subject, particulars_from_whom, assigned_team,
                       assignment_status, due_date, sign_receipt_datetime, remarks
                FROM inward ORDER BY created_at DESC LIMIT 20
            `).all(),
            c.env.DB.prepare(`
                SELECT action, actor, description, inward_no, created_at
                FROM audit_log ORDER BY created_at DESC LIMIT 10
            `).all(),
            c.env.DB.prepare(`SELECT COUNT(*) as total FROM outward`).first(),
        ]);

        const stats = statsRow.status === 'fulfilled' ? statsRow.value : {};
        const teams = teamRows.status === 'fulfilled' ? teamRows.value.results : [];
        const entries = recentEntries.status === 'fulfilled' ? recentEntries.value.results : [];
        const logs = recentLogs.status === 'fulfilled' ? recentLogs.value.results : [];
        const totalOutward = outwardCount.status === 'fulfilled' ? outwardCount.value?.total || 0 : 0;

        const teamSummary = teams.length > 0
            ? teams.map(t =>
                `  - ${t.assigned_team}: ${t.total} assigned, ${t.pending} pending, ${t.in_progress} in progress, ${t.completed} completed, ${t.overdue} overdue`
              ).join('\n')
            : '  No team assignments yet';

        const entrySummary = entries.length > 0
            ? entries.map(e =>
                `  [${e.inward_no}] From: ${e.particulars_from_whom} | Subject: ${e.subject} | Team: ${e.assigned_team || 'Unassigned'} | Status: ${e.assignment_status || 'Unassigned'} | Due: ${e.due_date || 'Not set'}`
              ).join('\n')
            : '  No entries yet';

        const logSummary = logs.length > 0
            ? logs.map(l =>
                `  [${new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}] ${l.actor}: ${l.description}${l.inward_no ? ` (${l.inward_no})` : ''}`
              ).join('\n')
            : '  No activity yet';

        const systemPrompt = `You are IOSYS Assistant, an intelligent AI for SSSIHL's (Sri Sathya Sai Institute of Higher Learning) Inward/Outward Document Management System. You help the admin understand correspondence data, team workloads, and activity.

Current date/time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST

=== LIVE DATABASE SNAPSHOT ===

OVERALL STATS:
  - Total Inward Entries: ${stats.total_inward || 0}
  - Total Outward Entries: ${totalOutward}
  - Pending: ${stats.pending || 0}
  - In Progress: ${stats.in_progress || 0}
  - Completed: ${stats.completed || 0}
  - Unassigned: ${stats.unassigned || 0}

TEAM BREAKDOWN:
${teamSummary}

RECENT 20 INWARD ENTRIES (newest first):
${entrySummary}

RECENT ACTIVITY (last 10 actions):
${logSummary}

=== YOUR ROLE ===
- Answer questions about entries, teams, workload, overdue items, and activity
- Provide insights and summaries when asked
- Be concise — use bullet points and short sentences
- If asked about a specific inward no., look it up in the entries above
- You CANNOT make changes to the database — information and suggestions only
- If data is not in the snapshot, say so honestly`;

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
                temperature: 0.6,
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
