import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { inwardRouter } from './routers/inward.js';
import { outwardRouter } from './routers/outward.js';
import { dashboardRouter } from './routers/dashboard.js';
import { notesRouter } from './routers/notes.js';
import { auditRouter } from './routers/auditLog.js';
import { pushRouter } from './routers/push.js';
import { aiRouter } from './routers/ai.js';
import { inboxQueueRouter } from './routers/inboxQueue.js';
import { sendWeeklyReport } from './services/weeklyReport.js';
import { pollInbox } from './services/inboxPoller.js';


const app = new Hono();

app.use('/*', cors());

app.get('/', (c) => {
    return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inward/Outward API Server</title>
        <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.5; }
            h1 { color: #333; }
            .status { color: green; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>🚀 Inward/Outward API (Cloudflare Worker)</h1>
        <p class="status">✅ Server Running</p>
        <p>Database: Cloudflare D1 (SQLite)</p>
    </body>
    </html>
  `);
});

app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        database: 'Cloudflare D1 (SQLite)',
        timestamp: new Date().toISOString()
    });
});


app.route('/api/inward', inwardRouter);
app.route('/api/outward', outwardRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/notes', notesRouter);
app.route('/api/audit', auditRouter);
app.route('/api/push', pushRouter);
app.route('/api/ai', aiRouter);
app.route('/api/inbox-queue', inboxQueueRouter);

// One-time migration endpoint — run once, then ignore
app.get('/api/run-migration', async (c) => {
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS inbox_queue (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                gmail_message_id TEXT UNIQUE NOT NULL,
                from_email       TEXT NOT NULL,
                from_name        TEXT,
                subject          TEXT NOT NULL,
                body_preview     TEXT,
                received_at      TEXT NOT NULL,
                ai_from          TEXT,
                ai_means         TEXT DEFAULT 'Email',
                ai_team          TEXT,
                ai_due_date      TEXT,
                ai_remarks       TEXT,
                status           TEXT DEFAULT 'pending',
                inward_id        INTEGER,
                created_at       TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        await c.env.DB.prepare(
            `CREATE INDEX IF NOT EXISTS idx_inbox_queue_status ON inbox_queue(status)`
        ).run();
        return c.json({ success: true, message: 'inbox_queue table created' });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// Manual trigger for inbox poll (testing)
app.get('/api/trigger-inbox-poll', async (c) => {
    try {
        await pollInbox(c.env);
        return c.json({ success: true, message: 'Inbox poll completed' });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// Hidden trigger to bypass cron limitations for testing purposes
app.get('/api/trigger-email', async (c) => {
    try {
        await sendWeeklyReport(c.env);
        return c.json({ success: true, message: "Boss Email successfully triggered to " + (c.env.BOSS_EMAIL || 'no-email-set') });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});


export default {
    fetch: app.fetch.bind(app),
    async scheduled(event, env, ctx) {
        if (event.cron === '30 5 * * 6') {
            ctx.waitUntil(sendWeeklyReport(env));
        } else if (event.cron === '*/5 * * * *') {
            ctx.waitUntil(pollInbox(env));
        }
    }
};
