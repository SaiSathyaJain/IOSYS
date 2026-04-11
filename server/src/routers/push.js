import { Hono } from 'hono';

export const pushRouter = new Hono();

// POST /api/push/subscribe
pushRouter.post('/subscribe', async (c) => {
    try {
        const { endpoint, keys, team } = await c.req.json();
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return c.json({ success: false, message: 'Missing subscription fields' }, 400);
        }
        await c.env.DB.prepare(
            'INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, team) VALUES (?, ?, ?, ?)'
        ).bind(endpoint, keys.p256dh, keys.auth, team || null).run();
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// POST /api/push/unsubscribe
pushRouter.post('/unsubscribe', async (c) => {
    try {
        const { endpoint } = await c.req.json();
        await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
