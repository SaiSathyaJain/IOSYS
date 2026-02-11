import { Hono } from 'hono';
import { toCamelCase } from '../utils/caseConverter.js';
import { sendAssignmentNotification } from '../services/notification.js';

export const inwardRouter = new Hono();

// Get all inward entries
inwardRouter.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM inward ORDER BY id DESC').all();
        const entries = toCamelCase(results);
        return c.json({ success: true, entries });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Get single inward entry
inwardRouter.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const entry = await c.env.DB.prepare('SELECT * FROM inward WHERE id = ?').bind(id).first();

        if (!entry) {
            return c.json({ success: false, message: 'Entry not found' }, 404);
        }

        return c.json({ success: true, entry: toCamelCase(entry) });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Create new inward entry
inwardRouter.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const {
            means, particularsFromWhom, subject,
            signReceiptDateTime, fileReference,
            assignedTeam, assignedToEmail, assignmentInstructions, dueDate
        } = body;

        // Generate inward number
        // Check count of entries for current year to generate ID
        // Note: D1 doesn't support 'count' utility in same way, use SQL
        const year = new Date().getFullYear();
        const countResult = await c.env.DB.prepare("SELECT count(*) as count FROM inward WHERE inward_no LIKE ?").bind(`INW/${year}/%`).first();
        const count = countResult.count;
        const nextCount = count + 1;
        const inwardNo = `INW/${year}/${nextCount.toString().padStart(3, '0')}`;

        const assignmentStatus = assignedTeam ? 'Pending' : 'Unassigned';
        const assignmentDate = assignedTeam ? new Date().toISOString() : null;

        const result = await c.env.DB.prepare(`
            INSERT INTO inward (
                inward_no, means, particulars_from_whom, subject,
                sign_receipt_datetime, file_reference, assigned_team,
                assigned_to_email, assignment_instructions, assignment_date,
                assignment_status, due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
        `).bind(
            inwardNo, means, particularsFromWhom, subject,
            signReceiptDateTime, fileReference || '', assignedTeam || null,
            assignedToEmail || null, assignmentInstructions || '', assignmentDate,
            assignmentStatus, dueDate || null
        ).first();

        const insertedEntry = toCamelCase(result);
        const id = insertedEntry.id;

        // Send notification if assigned
        if (assignedTeam && assignedToEmail) {
            c.executionCtx.waitUntil(
                sendAssignmentNotification({
                    id, inwardNo, subject, particularsFromWhom,
                    assignedTeam, assignedToEmail, assignmentInstructions, dueDate
                }, c.env).catch(err => console.error('Notification error:', err))
            );
        }

        return c.json({
            success: true,
            message: 'Inward entry created successfully',
            id,
            inwardNo
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Assign entry
inwardRouter.put('/:id/assign', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { assignedTeam, assignedToEmail, assignmentInstructions, dueDate } = body;

        const existing = await c.env.DB.prepare('SELECT * FROM inward WHERE id = ?').bind(id).first();
        if (!existing) {
            return c.json({ success: false, message: 'Entry not found' }, 404);
        }

        const assignmentDate = new Date().toISOString();
        const updatedAt = new Date().toISOString();

        await c.env.DB.prepare(`
            UPDATE inward SET
                assigned_team = ?, assigned_to_email = ?,
                assignment_instructions = ?, assignment_date = ?,
                assignment_status = 'Pending', due_date = ?, updated_at = ?
            WHERE id = ?
        `).bind(
            assignedTeam, assignedToEmail, assignmentInstructions,
            assignmentDate, dueDate, updatedAt, id
        ).run();

        // Send notification
        c.executionCtx.waitUntil(
            sendAssignmentNotification({
                ...toCamelCase(existing),
                assignedTeam, assignedToEmail, assignmentInstructions, dueDate
            }, c.env).catch(err => console.error('Notification error:', err))
        );

        return c.json({
            success: true,
            message: `Entry assigned to ${assignedTeam} team. Notification sent to ${assignedToEmail}`
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Update status
inwardRouter.put('/:id/status', async (c) => {
    try {
        const id = c.req.param('id');
        const { assignmentStatus } = await c.req.json();
        const updatedAt = new Date().toISOString();
        let completionDate = null;

        if (assignmentStatus === 'Completed') {
            completionDate = new Date().toISOString();
            await c.env.DB.prepare('UPDATE inward SET assignment_status = ?, completion_date = ?, updated_at = ? WHERE id = ?')
                .bind(assignmentStatus, completionDate, updatedAt, id).run();
        } else {
            await c.env.DB.prepare('UPDATE inward SET assignment_status = ?, updated_at = ? WHERE id = ?')
                .bind(assignmentStatus, updatedAt, id).run();
        }

        return c.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
