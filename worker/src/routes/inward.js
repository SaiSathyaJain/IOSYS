import { Hono } from 'hono';
import { toCamelCase } from '../utils/caseConverter.js';
import { sendAssignmentNotification } from '../services/notification.js';

const app = new Hono();

// Get all inward entries
app.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { results } = await db.prepare(
      'SELECT * FROM inward ORDER BY id DESC'
    ).all();

    const entries = toCamelCase(results);
    return c.json({ success: true, entries });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Get single inward entry
app.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');

    const result = await db.prepare(
      'SELECT * FROM inward WHERE id = ?'
    ).bind(id).first();

    if (!result) {
      return c.json({ success: false, message: 'Entry not found' }, 404);
    }

    const entry = toCamelCase(result);
    return c.json({ success: true, entry });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Create new inward entry
app.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const {
      means, particularsFromWhom, subject, assignedTo,
      signReceiptDateTime, fileReference,
      assignedTeam, assignedToEmail, assignmentInstructions, dueDate
    } = body;

    // Get count for generating inward number
    const countResult = await db.prepare(
      'SELECT COUNT(*) as count FROM inward'
    ).first();
    const count = countResult?.count || 0;

    const year = new Date().getFullYear();
    const nextCount = count + 1;
    const inwardNo = `INW/${year}/${nextCount.toString().padStart(3, '0')}`;

    const now = new Date().toISOString();
    const assignmentDate = assignedTeam ? now : null;
    const assignmentStatus = assignedTeam ? 'Pending' : 'Unassigned';

    const result = await db.prepare(`
      INSERT INTO inward (
        inward_no, means, particulars_from_whom, subject, assigned_to,
        sign_receipt_datetime, file_reference, assigned_team, assigned_to_email,
        assignment_instructions, assignment_date, assignment_status, due_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      inwardNo, means, particularsFromWhom, subject, assignedTo || null,
      signReceiptDateTime, fileReference || '', assignedTeam || null, assignedToEmail || null,
      assignmentInstructions || '', assignmentDate, assignmentStatus, dueDate || null,
      now, now
    ).first();

    const id = result.id;

    // Send notification if assigned
    // Send notification if assigned
    let notificationResult = { skipped: true, reason: 'Not assigned to team/email' };

    // DEBUG LOGGING
    console.log('Checking email trigger:', {
      assignedTeam,
      assignedToEmail,
      hasApiKey: !!c.env.EMAIL_API_KEY
    });

    if (assignedTeam && assignedToEmail) {
      // Use waitUntil to avoid blocking the response
      c.executionCtx.waitUntil(
        sendAssignmentNotification(c.env, {
          id, inwardNo, subject, particularsFromWhom,
          assignedTeam, assignedToEmail, assignmentInstructions, dueDate
        }).then(res => {
          console.log('Background email result:', res);
        }).catch(err => {
          console.error('Background email failed:', err);
        })
      );
      notificationResult = { sent: 'in_background' };
    }

    return c.json({
      success: true,
      message: 'Inward entry created successfully',
      id,
      inwardNo,
      notification: notificationResult
    });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Assign entry to team leader
app.put('/:id/assign', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    const { assignedTeam, assignedToEmail, assignmentInstructions, dueDate } = body;

    // Check if entry exists
    const existing = await db.prepare(
      'SELECT * FROM inward WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ success: false, message: 'Entry not found' }, 404);
    }

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE inward SET
        assigned_team = ?,
        assigned_to_email = ?,
        assignment_instructions = ?,
        assignment_date = ?,
        assignment_status = 'Pending',
        due_date = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      assignedTeam, assignedToEmail, assignmentInstructions || '',
      now, dueDate || null, now, id
    ).run();

    // Send notification
    let notificationResult = { skipped: true, reason: 'No email assigned' };

    if (assignedToEmail) {
      // Use waitUntil to avoid blocking the response
      const entry = toCamelCase(existing);
      c.executionCtx.waitUntil(
        sendAssignmentNotification(c.env, {
          ...entry,
          assignedTeam, assignedToEmail, assignmentInstructions, dueDate
        }).then(res => {
          console.log('Background reassignment email result:', res);
        }).catch(err => {
          console.error('Background reassignment email failed:', err);
        })
      );
      notificationResult = { sent: 'in_background' };
    }

    return c.json({
      success: true,
      message: `Entry assigned to ${assignedTeam} team.`,
      notification: notificationResult
    });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Update entry status
app.put('/:id/status', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    const { assignmentStatus } = body;

    const now = new Date().toISOString();
    const completionDate = assignmentStatus === 'Completed' ? now : null;

    await db.prepare(`
      UPDATE inward SET
        assignment_status = ?,
        completion_date = COALESCE(?, completion_date),
        updated_at = ?
      WHERE id = ?
    `).bind(assignmentStatus, completionDate, now, id).run();

    return c.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
