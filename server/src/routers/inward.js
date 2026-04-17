import { Hono } from 'hono';
import { toCamelCase } from '../utils/caseConverter.js';
import { sendAssignmentNotification } from '../services/notification.js';
import { sendTeamPushNotifications } from '../services/webPush.js';

const TEAM_SLUG = { 'UG': 'ug', 'PG/PRO': 'pg-pro', 'PhD': 'phd' };

export const inwardRouter = new Hono();

// Get all inward entries
inwardRouter.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM inward ORDER BY id ASC').all();
        const entries = toCamelCase(results);
        return c.json({ success: true, entries });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Get all recycle bin entries — must be before /:id to avoid route conflict
inwardRouter.get('/deleted/all', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            'SELECT * FROM inward_deleted ORDER BY deleted_at DESC'
        ).all();
        return c.json({ success: true, entries: toCamelCase(results) });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Restore entry from recycle bin — must be before /:id
inwardRouter.post('/deleted/:id/restore', async (c) => {
    try {
        const id = c.req.param('id');
        const deleted = await c.env.DB.prepare(
            'SELECT * FROM inward_deleted WHERE id = ?'
        ).bind(id).first();

        if (!deleted) {
            return c.json({ success: false, message: 'Entry not found in recycle bin' }, 404);
        }

        // Check for inward_no conflict
        const conflict = await c.env.DB.prepare(
            'SELECT id FROM inward WHERE inward_no = ?'
        ).bind(deleted.inward_no).first();
        if (conflict) {
            return c.json({ success: false, message: `Cannot restore: inward number ${deleted.inward_no} already exists in the register` }, 409);
        }

        await c.env.DB.prepare(`
            INSERT INTO inward (
                inward_no, means, particulars_from_whom, subject,
                sign_receipt_datetime, file_reference, assigned_team, assigned_to_email,
                assignment_instructions, assignment_date, assignment_status, due_date,
                completion_date, remarks, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            deleted.inward_no, deleted.means, deleted.particulars_from_whom, deleted.subject,
            deleted.sign_receipt_datetime, deleted.file_reference, deleted.assigned_team, deleted.assigned_to_email,
            deleted.assignment_instructions, deleted.assignment_date, deleted.assignment_status, deleted.due_date,
            deleted.completion_date, deleted.remarks, deleted.created_at, deleted.updated_at
        ).run();

        await c.env.DB.prepare('DELETE FROM inward_deleted WHERE id = ?').bind(id).run();

        // Audit log
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('ENTRY_RESTORED', 'Admin', `Admin restored ${deleted.inward_no} from recycle bin`, deleted.inward_no).run();

        return c.json({ success: true, message: 'Entry restored successfully' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Permanently delete from recycle bin — must be before /:id
inwardRouter.delete('/deleted/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const deleted = await c.env.DB.prepare(
            'SELECT inward_no FROM inward_deleted WHERE id = ?'
        ).bind(id).first();

        if (!deleted) {
            return c.json({ success: false, message: 'Entry not found in recycle bin' }, 404);
        }

        await c.env.DB.prepare('DELETE FROM inward_deleted WHERE id = ?').bind(id).run();

        // Audit log
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('ENTRY_PERM_DELETED', 'Admin', `Admin permanently deleted ${deleted.inward_no}`, deleted.inward_no).run();

        return c.json({ success: true, message: 'Entry permanently deleted' });
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
            means, inwardNo: manualInwardNo, particularsFromWhom, subject,
            signReceiptDateTime, fileReference,
            assignedTeam, assignedToEmail, assignmentInstructions, dueDate, remarks
        } = body;

        const MANUAL_MEANS = ['Post', 'Hand Delivery', 'Courier'];

        let inwardNo;
        if (MANUAL_MEANS.includes(means) && manualInwardNo?.trim()) {
            // Use the admin-supplied inward number for physical mail
            inwardNo = manualInwardNo.trim();
        } else {
            // Auto-generate: INW/DD/MM/YYYY-0000
            // Use MAX of numeric suffix across live + deleted entries to avoid conflicts after deletion
            const entryDate = new Date(signReceiptDateTime);
            const dd   = entryDate.getDate().toString().padStart(2, '0');
            const mm   = (entryDate.getMonth() + 1).toString().padStart(2, '0');
            const yyyy = entryDate.getFullYear();
            const maxResult = await c.env.DB.prepare(`
                SELECT MAX(CAST(SUBSTR(inward_no, -4) AS INTEGER)) as max_seq
                FROM inward WHERE inward_no LIKE 'INW/%'
            `).first();
            const nextCount = (maxResult.max_seq || 0) + 1;
            inwardNo = `INW/${dd}/${mm}/${yyyy}-${nextCount.toString().padStart(4, '0')}`;
        }

        const assignmentStatus = assignedTeam ? 'Pending' : 'Unassigned';
        const assignmentDate = assignedTeam ? new Date().toISOString() : null;

        const result = await c.env.DB.prepare(`
            INSERT INTO inward (
                inward_no, means, particulars_from_whom, subject,
                sign_receipt_datetime, file_reference, assigned_team,
                assigned_to_email, assignment_instructions, assignment_date,
                assignment_status, due_date, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
        `).bind(
            inwardNo, means, particularsFromWhom, subject,
            signReceiptDateTime, fileReference || '', assignedTeam || null,
            assignedToEmail || null, assignmentInstructions || '', assignmentDate,
            assignmentStatus, dueDate || null, remarks || ''
        ).first();

        const insertedEntry = toCamelCase(result);
        const id = insertedEntry.id;

        // Audit log
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('ENTRY_CREATED', 'Admin', `Admin created inward entry ${inwardNo}`, inwardNo).run();

        // Auto-clear any pending inbox_queue item with matching subject
        if (subject) {
            await c.env.DB.prepare(
                "UPDATE inbox_queue SET status = 'accepted', inward_id = ? WHERE status = 'pending' AND LOWER(subject) = LOWER(?)"
            ).bind(id, subject).run();
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

        // Audit log
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('ENTRY_ASSIGNED', 'Admin', `Admin assigned ${existing.inward_no} to ${assignedTeam} Team`, existing.inward_no).run();

        // Send email + push notifications (non-blocking)
        c.executionCtx.waitUntil((async () => {
            await Promise.allSettled([
                sendAssignmentNotification({
                    inwardNo: existing.inward_no,
                    subject: existing.subject,
                    particularsFromWhom: existing.particulars_from_whom,
                    assignedTeam,
                    assignedToEmail,
                    assignmentInstructions,
                    dueDate
                }, c.env).catch(err => console.error('Email notification failed:', err)),

                sendTeamPushNotifications(c.env, c.env.DB, assignedTeam, {
                    title: `New Assignment — ${assignedTeam} Team`,
                    body: `${existing.inward_no}: ${(existing.subject || '').slice(0, 60)}`,
                    url: `https://iosys.pages.dev/team/${TEAM_SLUG[assignedTeam] || 'ug'}`
                }).catch(err => console.error('Push notification failed:', err))
            ]);
        })());

        return c.json({
            success: true,
            message: `Entry assigned to ${assignedTeam} team.`
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Update remarks
inwardRouter.put('/:id/remarks', async (c) => {
    try {
        const id = c.req.param('id');
        const { remarks, actor } = await c.req.json();
        const updatedAt = new Date().toISOString();

        const entry = await c.env.DB.prepare('SELECT inward_no FROM inward WHERE id = ?').bind(id).first();

        await c.env.DB.prepare('UPDATE inward SET remarks = ?, updated_at = ? WHERE id = ?')
            .bind(remarks, updatedAt, id).run();

        // Audit log
        const auditActor = actor || 'System';
        if (entry) {
            await c.env.DB.prepare(
                'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
            ).bind('REMARKS_UPDATED', auditActor, `${auditActor} updated remarks on ${entry.inward_no}`, entry.inward_no).run();
        }

        return c.json({ success: true, message: 'Remarks updated successfully' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Update status
inwardRouter.put('/:id/status', async (c) => {
    try {
        const id = c.req.param('id');
        const { assignmentStatus, fileReference, actor } = await c.req.json();
        const updatedAt = new Date().toISOString();

        const entry = await c.env.DB.prepare('SELECT inward_no FROM inward WHERE id = ?').bind(id).first();

        if (assignmentStatus === 'Completed') {
            const completionDate = new Date().toISOString();
            if (fileReference) {
                await c.env.DB.prepare('UPDATE inward SET assignment_status = ?, completion_date = ?, file_reference = ?, updated_at = ? WHERE id = ?')
                    .bind(assignmentStatus, completionDate, fileReference, updatedAt, id).run();
            } else {
                await c.env.DB.prepare('UPDATE inward SET assignment_status = ?, completion_date = ?, updated_at = ? WHERE id = ?')
                    .bind(assignmentStatus, completionDate, updatedAt, id).run();
            }
        } else {
            await c.env.DB.prepare('UPDATE inward SET assignment_status = ?, updated_at = ? WHERE id = ?')
                .bind(assignmentStatus, updatedAt, id).run();
        }

        // Audit log
        const auditActor = actor || 'System';
        if (entry) {
            await c.env.DB.prepare(
                'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
            ).bind('STATUS_CHANGED', auditActor, `${auditActor} marked ${entry.inward_no} as ${assignmentStatus}`, entry.inward_no).run();
        }

        return c.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Delete inward entry (moves to recycle bin)
inwardRouter.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const entry = await c.env.DB.prepare('SELECT * FROM inward WHERE id = ?').bind(id).first();

        if (!entry) {
            return c.json({ success: false, message: 'Entry not found' }, 404);
        }

        // Copy to recycle bin first
        await c.env.DB.prepare(`
            INSERT INTO inward_deleted (
                original_id, inward_no, means, particulars_from_whom, subject,
                sign_receipt_datetime, file_reference, assigned_team, assigned_to_email,
                assignment_instructions, assignment_date, assignment_status, due_date,
                completion_date, remarks, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            entry.id, entry.inward_no, entry.means, entry.particulars_from_whom, entry.subject,
            entry.sign_receipt_datetime, entry.file_reference, entry.assigned_team, entry.assigned_to_email,
            entry.assignment_instructions, entry.assignment_date, entry.assignment_status, entry.due_date,
            entry.completion_date, entry.remarks, entry.created_at, entry.updated_at
        ).run();

        await c.env.DB.prepare('DELETE FROM inward WHERE id = ?').bind(id).run();

        // Audit log
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('ENTRY_DELETED', 'Admin', `Admin moved ${entry.inward_no} to recycle bin`, entry.inward_no).run();

        return c.json({ success: true, message: 'Entry moved to recycle bin' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
