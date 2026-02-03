import { Hono } from 'hono';
import { toCamelCase } from '../utils/caseConverter.js';

const app = new Hono();

// Get all outward entries
app.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const team = c.req.query('team');

    let query = 'SELECT * FROM outward';
    let params = [];

    if (team) {
      query += ' WHERE created_by_team = ?';
      params.push(team);
    }

    query += ' ORDER BY id DESC';

    const stmt = params.length > 0
      ? db.prepare(query).bind(...params)
      : db.prepare(query);

    const { results } = await stmt.all();

    const entries = toCamelCase(results);
    return c.json({ success: true, entries });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Create new outward entry
app.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const {
      means, toWhom, subject, sentBy,
      signReceiptDateTime, caseClosed, fileReference, postalTariff,
      dueDate, linkedInwardId, createdByTeam, teamMemberEmail
    } = body;

    // Get count for generating outward number
    const countResult = await db.prepare(
      'SELECT COUNT(*) as count FROM outward'
    ).first();
    const count = countResult?.count || 0;

    const year = new Date().getFullYear();
    const nextCount = count + 1;
    const outwardNo = `OTW/${year}/${nextCount.toString().padStart(3, '0')}`;

    const now = new Date().toISOString();

    const result = await db.prepare(`
      INSERT INTO outward (
        outward_no, means, to_whom, subject, sent_by,
        sign_receipt_datetime, case_closed, file_reference, postal_tariff,
        due_date, linked_inward_id, created_by_team, team_member_email,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      outwardNo, means, toWhom, subject, sentBy,
      signReceiptDateTime, caseClosed ? 1 : 0, fileReference || '', postalTariff || 0,
      dueDate || null, linkedInwardId || null, createdByTeam, teamMemberEmail || null,
      now, now
    ).first();

    const id = result.id;

    // If linked to inward, update the inward entry status
    if (linkedInwardId) {
      await db.prepare(`
        UPDATE inward SET
          assignment_status = 'Completed',
          completion_date = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(now, now, linkedInwardId).run();
    }

    return c.json({
      success: true,
      message: 'Outward entry created successfully',
      id,
      outwardNo
    });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
