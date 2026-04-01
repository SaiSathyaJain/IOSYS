import { Hono } from 'hono';

export const notesRouter = new Hono();

// GET /api/notes?type=REGISTRAR|VC
notesRouter.get('/', async (c) => {
    const type = c.req.query('type');
    let results;
    if (type) {
        ({ results } = await c.env.DB.prepare(
            'SELECT * FROM notes WHERE note_type = ? ORDER BY created_at DESC'
        ).bind(type).all());
    } else {
        ({ results } = await c.env.DB.prepare(
            'SELECT * FROM notes ORDER BY created_at DESC'
        ).all());
    }
    return c.json({ success: true, entries: results });
});

// POST /api/notes
notesRouter.post('/', async (c) => {
    const { noteType, slNo, outwardNo, date, description, remarks } = await c.req.json();
    if (!noteType || !slNo || !outwardNo || !date || !description) {
        return c.json({ success: false, message: 'Missing required fields' }, 400);
    }
    const result = await c.env.DB.prepare(
        'INSERT INTO notes (note_type, sl_no, outward_no, date, description, remarks) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(noteType, slNo, outwardNo, date, description, remarks || '').run();
    return c.json({ success: true, id: result.meta.last_row_id });
});

// DELETE /api/notes/:id
notesRouter.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});
