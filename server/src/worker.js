import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { inwardRouter } from './routers/inward.js';
import { outwardRouter } from './routers/outward.js';
import { dashboardRouter } from './routers/dashboard.js';
import { aiRouter } from './routers/ai.js';


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
app.route('/api/ai', aiRouter);


export default app;
