import { Hono } from 'hono';
import { toCamelCase } from '../utils/caseConverter.js';

export const notificationsRouter = new Hono();

const MAX_LIMIT = 50;

/**
 * Build the recipient filter. A caller identifies itself by email, by team,
 * or both — a notification matches if either side matches.
 * Returns null when the caller gave us nothing to match on.
 */
function recipientFilter(email, team) {
    const clauses = [];
    const params = [];
    if (email) { clauses.push('recipient_email = ?'); params.push(email); }
    if (team)  { clauses.push('recipient_team = ?');  params.push(team); }
    if (clauses.length === 0) return null;
    return { where: `(${clauses.join(' OR ')})`, params };
}

// GET /api/notifications?email=&team=&limit=&unreadOnly=1
notificationsRouter.get('/', async (c) => {
    try {
        const { email, team, limit, unreadOnly } = c.req.query();
        const filter = recipientFilter(email, team);
        if (!filter) {
            return c.json({ success: false, message: 'email or team is required' }, 400);
        }

        let where = filter.where;
        if (unreadOnly === '1' || unreadOnly === 'true') {
            where += ' AND is_read = 0';
        }

        const lim = Math.min(parseInt(limit) || 30, MAX_LIMIT);
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`
        ).bind(...filter.params, lim).all();

        const unread = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM notifications WHERE ${filter.where} AND is_read = 0`
        ).bind(...filter.params).first();

        return c.json({
            success: true,
            notifications: toCamelCase(results),
            unreadCount: unread?.count || 0
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// GET /api/notifications/unread/count?email=&team=
notificationsRouter.get('/unread/count', async (c) => {
    try {
        const { email, team } = c.req.query();
        const filter = recipientFilter(email, team);
        if (!filter) {
            return c.json({ success: false, message: 'email or team is required' }, 400);
        }

        const row = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM notifications WHERE ${filter.where} AND is_read = 0`
        ).bind(...filter.params).first();

        return c.json({ success: true, count: row?.count || 0 });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// PUT /api/notifications/read-all  { userEmail, team }
notificationsRouter.put('/read-all', async (c) => {
    try {
        const { userEmail, team } = await c.req.json();
        const filter = recipientFilter(userEmail, team);
        if (!filter) {
            return c.json({ success: false, message: 'userEmail or team is required' }, 400);
        }

        const res = await c.env.DB.prepare(
            `UPDATE notifications SET is_read = 1 WHERE ${filter.where} AND is_read = 0`
        ).bind(...filter.params).run();

        return c.json({ success: true, updated: res.meta?.changes ?? 0 });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// PUT /api/notifications/:id/read
notificationsRouter.put('/:id/read', async (c) => {
    try {
        const id = c.req.param('id');
        const existing = await c.env.DB.prepare(
            'SELECT id FROM notifications WHERE id = ?'
        ).bind(id).first();
        if (!existing) {
            return c.json({ success: false, message: 'Notification not found' }, 404);
        }

        await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// POST /api/notifications
notificationsRouter.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const { type, title, recipientEmail, recipientTeam } = body;

        if (!type || !title) {
            return c.json({ success: false, message: 'type and title are required' }, 400);
        }
        if (!recipientEmail && !recipientTeam) {
            return c.json({ success: false, message: 'recipientEmail or recipientTeam is required' }, 400);
        }

        const result = await c.env.DB.prepare(`
            INSERT INTO notifications
                (type, title, body, recipient_email, recipient_team, inward_no, entry_id, link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
        `).bind(
            type, title, body.body || '',
            recipientEmail || null, recipientTeam || null,
            body.inwardNo || null, body.entryId || null, body.link || null
        ).first();

        return c.json({ success: true, id: result?.id });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// DELETE /api/notifications/:id
notificationsRouter.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
