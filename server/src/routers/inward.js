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
            assignedTeam, assignedToEmail, assignmentInstructions, dueDate, remarks
        } = body;

        // Generate inward number: INW/DD/MM/YYYY-0000 (global sequential counter)
        const entryDate = new Date(signReceiptDateTime);
        const dd   = entryDate.getDate().toString().padStart(2, '0');
        const mm   = (entryDate.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = entryDate.getFullYear();
        const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM inward').first();
        const nextCount = (countResult.count || 0) + 1;
        const inwardNo = `INW/${dd}/${mm}/${yyyy}-${nextCount.toString().padStart(4, '0')}`;

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
