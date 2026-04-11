import { Hono } from 'hono';

export const auditRouter = new Hono();

// GET /api/audit?page=1
auditRouter.get('/', async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1'));
        const limit = 20;
        const offset = (page - 1) * limit;

        const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM audit_log').first();
        const total = countResult.count || 0;

        const { results } = await c.env.DB.prepare(
            'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).bind(limit, offset).all();

        return c.json({
            success: true,
            logs: results,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
