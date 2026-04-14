import { Hono } from 'hono';

export const inboxQueueRouter = new Hono();

// GET /api/inbox-queue?status=pending|accepted|rejected
inboxQueueRouter.get('/', async (c) => {
    const status = c.req.query('status') || 'pending';
    const { results } = await c.env.DB.prepare(
        'SELECT * FROM inbox_queue WHERE status = ? AND inward_id IS NULL ORDER BY created_at DESC'
    ).bind(status).all();

    const pendingRow = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM inbox_queue WHERE status = 'pending' AND inward_id IS NULL"
    ).first();

    return c.json({ success: true, items: results, pendingCount: pendingRow?.count || 0 });
});

// GET /api/inbox-queue/by-inward/:inwardId — fetch email linked to an inward entry
inboxQueueRouter.get('/by-inward/:inwardId', async (c) => {
    const inwardId = c.req.param('inwardId');
    const item = await c.env.DB.prepare(
        'SELECT * FROM inbox_queue WHERE inward_id = ?'
    ).bind(inwardId).first();
    return c.json({ success: true, item: item || null });
});

// GET /api/inbox-queue/count  — badge count only
inboxQueueRouter.get('/count', async (c) => {
    const row = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM inbox_queue WHERE status = 'pending' AND inward_id IS NULL"
    ).first();
    return c.json({ success: true, count: row?.count || 0 });
});

// PUT /api/inbox-queue/:id/accept
// Body: { particularsFromWhom, subject, means, signReceiptDateTime,
//         assignedTeam, assignedToEmail, assignmentInstructions, dueDate, remarks }
inboxQueueRouter.put('/:id/accept', async (c) => {
    const id   = c.req.param('id');
    const body = await c.req.json();

    const item = await c.env.DB.prepare(
        'SELECT * FROM inbox_queue WHERE id = ?'
    ).bind(id).first();
    if (!item) return c.json({ success: false, message: 'Queue item not found' }, 404);

    // Generate inward_no  (INW/DD/MM/YYYY-NNNN)
    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM inward').first();
    const nextCount   = (countResult?.count || 0) + 1;
    const date        = new Date(body.signReceiptDateTime || item.received_at);
    const dd          = date.getDate().toString().padStart(2, '0');
    const mm          = (date.getMonth() + 1).toString().padStart(2, '0');
    const yyyy        = date.getFullYear();
    const inwardNo    = `INW/${dd}/${mm}/${yyyy}-${nextCount.toString().padStart(4, '0')}`;

    const hasTeam         = !!(body.assignedTeam);
    const assignedStatus  = hasTeam ? 'Pending' : 'Unassigned';
    const assignmentDate  = hasTeam ? new Date().toISOString() : null;

    const result = await c.env.DB.prepare(`
        INSERT INTO inward
            (inward_no, means, particulars_from_whom, subject,
             sign_receipt_datetime, assigned_team, assigned_to_email,
             assignment_instructions, assignment_date, assignment_status,
             due_date, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        inwardNo,
        body.means               || 'Email',
        body.particularsFromWhom || item.ai_from || item.from_name || item.from_email,
        body.subject             || item.subject,
        body.signReceiptDateTime || item.received_at,
        body.assignedTeam        || '',
        body.assignedToEmail     || '',
        body.assignmentInstructions || '',
        assignmentDate,
        assignedStatus,
        body.dueDate             || item.ai_due_date || '',
        body.remarks             || item.ai_remarks  || ''
    ).run();

    const inwardId = result.meta.last_row_id;

    // Mark queue item accepted + link to created entry
    await c.env.DB.prepare(
        'UPDATE inbox_queue SET status = ?, inward_id = ? WHERE id = ?'
    ).bind('accepted', inwardId, id).run();

    return c.json({ success: true, inwardId, inwardNo });
});

// PUT /api/inbox-queue/:id/reject
inboxQueueRouter.put('/:id/reject', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare(
        'UPDATE inbox_queue SET status = ? WHERE id = ?'
    ).bind('rejected', id).run();
    return c.json({ success: true });
});
