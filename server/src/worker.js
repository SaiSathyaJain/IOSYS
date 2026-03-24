import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { inwardRouter } from './routers/inward.js';
import { outwardRouter } from './routers/outward.js';
import { dashboardRouter } from './routers/dashboard.js';
import { aiRouter } from './routers/ai.js';
import { sendWeeklyReport } from './services/weeklyReport.js';


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

app.get('/api/debug-env', (c) => {
    const id = c.env.GMAIL_CLIENT_ID || '';
    return c.json({
        GMAIL_CLIENT_ID_prefix: id ? id.slice(0, 16) + '...' : '❌ missing',
        GMAIL_CLIENT_SECRET:    c.env.GMAIL_CLIENT_SECRET ? '✅ set' : '❌ missing',
        GMAIL_REFRESH_TOKEN:    c.env.GMAIL_REFRESH_TOKEN ? '✅ set' : '❌ missing',
        GMAIL_FROM:             c.env.GMAIL_FROM          || '❌ missing',
        BOSS_EMAIL:             c.env.BOSS_EMAIL          || '❌ missing',
    });
});

app.post('/api/test-email', async (c) => {
    const { sendAssignmentNotification } = await import('./services/notification.js');
    try {
        await sendAssignmentNotification({
            inwardNo: 'TEST/001',
            subject: 'Test Email – Please Ignore',
            particularsFromWhom: 'System Test',
            assignedTeam: 'UG',
            assignedToEmail: c.env.BOSS_EMAIL || 'sathyajain9@gmail.com',
            assignmentInstructions: 'This is a test to verify email delivery.',
            dueDate: new Date().toISOString(),
        }, c.env);
        return c.json({ success: true, message: 'Email sent successfully' });
    } catch (err) {
        return c.json({ success: false, error: err.message });
    }
});

app.route('/api/inward', inwardRouter);
app.route('/api/outward', outwardRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/ai', aiRouter);


export default {
    fetch: app.fetch.bind(app),
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(sendWeeklyReport(env));
    }
};
