import { Hono } from 'hono';
import { toCamelCase } from '../utils/caseConverter.js';

export const outwardRouter = new Hono();

// Get all outward entries
outwardRouter.get('/', async (c) => {
    try {
        const { team, startDate, endDate } = c.req.query();
        let query = 'SELECT * FROM outward WHERE 1=1';
        const params = [];

        if (team) {
            query += ' AND created_by_team = ?';
            params.push(team);
        }
        if (startDate) {
            query += ' AND sign_receipt_datetime >= ?';
            params.push(startDate);
        }
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            query += ' AND sign_receipt_datetime <= ?';
            params.push(endDateTime.toISOString());
        }

        query += ' ORDER BY id DESC';

        const { results } = await c.env.DB.prepare(query).bind(...params).all();
        let entries = toCamelCase(results);

        // Fetch linked inward details manually
        const linkedInwardIds = entries
            .map(e => e.linkedInwardId)
            .filter(id => id);

        if (linkedInwardIds.length > 0) {
            // D1 doesn't support convenient IN clause with array binding directly in one placeholder usually on prepared statements cleanly without expanding
            // Expanding placeholders (?,?,?)
            const placeholders = linkedInwardIds.map(() => '?').join(',');
            const inwardQuery = `SELECT id, inward_no FROM inward WHERE id IN (${placeholders})`;
            const { results: inwardResults } = await c.env.DB.prepare(inwardQuery).bind(...linkedInwardIds).all();

            const inwardMap = {};
            inwardResults.forEach(item => {
                inwardMap[item.id] = toCamelCase(item);
            });

            entries = entries.map(entry => {
                if (entry.linkedInwardId && inwardMap[entry.linkedInwardId]) {
                    return { ...entry, inward: inwardMap[entry.linkedInwardId] };
                }
                return entry;
            });
        }

        return c.json({ success: true, entries });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Get next outward number (preview before creation)
outwardRouter.get('/next-no', async (c) => {
    try {
        const now = new Date();
        const dd = now.getDate().toString().padStart(2, '0');
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        const countResult = await c.env.DB.prepare("SELECT count(*) as count FROM outward WHERE outward_no LIKE 'OTW/%'").first();
        const nextCount = (countResult.count || 0) + 1;
        const nextNo = `OTW/${dd}/${mm}/${yyyy}-${nextCount.toString().padStart(3, '0')}`;
        return c.json({ success: true, nextNo });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Create new outward entry
outwardRouter.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const {
            means, toWhom, subject, sentBy,
            signReceiptDateTime, caseClosed, fileReference, postalTariff,
            dueDate, linkedInwardId, createdByTeam, teamMemberEmail, remarks, cc, outwardNo: providedOutwardNo
        } = body;

        const now = new Date();
        const dd = now.getDate().toString().padStart(2, '0');
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        let outwardNo = providedOutwardNo?.trim();
        if (!outwardNo) {
            const countResult = await c.env.DB.prepare("SELECT count(*) as count FROM outward WHERE outward_no LIKE 'OTW/%'").first();
            const nextCount = (countResult.count || 0) + 1;
            outwardNo = `OTW/${dd}/${mm}/${yyyy}-${nextCount.toString().padStart(3, '0')}`;
        }

        const isCaseClosed = caseClosed ? 1 : 0;
        const tariff = postalTariff || 0;
        const dateTime = signReceiptDateTime || new Date().toISOString();

        const result = await c.env.DB.prepare(`
            INSERT INTO outward (
                outward_no, means, to_whom, subject, sent_by,
                sign_receipt_datetime, case_closed, file_reference,
                postal_tariff, due_date, linked_inward_id,
                created_by_team, team_member_email, remarks, cc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
        `).bind(
            outwardNo, means, toWhom, subject, sentBy,
            dateTime, isCaseClosed, fileReference || '',
            tariff, dueDate || null, linkedInwardId || null,
            createdByTeam, teamMemberEmail, remarks || '', cc || null
        ).first();

        const insertedEntry = toCamelCase(result);
        const id = insertedEntry.id;

        // Update linked inward entry if exists
        if (linkedInwardId) {
            const completionDate = new Date().toISOString();
            const updatedAt = new Date().toISOString();
            c.executionCtx.waitUntil(
                c.env.DB.prepare(`
                    UPDATE inward SET 
                        assignment_status = 'Completed',
                        completion_date = ?,
                        updated_at = ?
                    WHERE id = ?
                `).bind(completionDate, updatedAt, linkedInwardId).run()
                    .catch(err => console.error('Failed to update linked inward:', err))
            );
        }

        // Audit log
        const auditActor = createdByTeam ? `${createdByTeam} Team` : 'Team';
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('OUTWARD_CREATED', auditActor, `${auditActor} created outward entry ${outwardNo}`, null).run();

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

// Close an outward case
outwardRouter.put('/:id/close', async (c) => {
    try {
        const id = Number(c.req.param('id'));

        const entry = await c.env.DB.prepare('SELECT outward_no, created_by_team FROM outward WHERE id = ?').bind(id).first();
        if (!entry) {
            return c.json({ success: false, message: 'Outward entry not found' }, 404);
        }

        await c.env.DB.prepare(
            'UPDATE outward SET case_closed = 1, updated_at = ? WHERE id = ?'
        ).bind(new Date().toISOString(), id).run();

        const auditActor = entry.created_by_team ? `${entry.created_by_team} Team` : 'Team';
        await c.env.DB.prepare(
            'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
        ).bind('OUTWARD_CLOSED', auditActor, `${auditActor} closed outward entry ${entry.outward_no}`, null).run();

        return c.json({ success: true, message: 'Case closed successfully' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Field labels for audit diff output
const OUTWARD_FIELD_LABELS = {
    means: 'Means',
    to_whom: 'To Whom',
    subject: 'Subject',
    sent_by: 'Sent By',
    file_reference: 'File Reference',
    postal_tariff: 'Postal Tariff',
    due_date: 'Due Date',
    linked_inward_id: 'Linked Inward',
    created_by_team: 'Team',
    team_member_email: 'Team Email',
    remarks: 'Remarks',
    cc: 'CC',
    case_closed: 'Case Closed'
};

function formatFieldValue(field, value) {
    if (field === 'case_closed') return value ? 'Yes' : 'No';
    if (value === null || value === undefined || value === '') return '(empty)';
    return String(value);
}

// Update an outward entry
outwardRouter.put('/:id', async (c) => {
    try {
        const id = Number(c.req.param('id'));
        const {
            means, toWhom, subject, sentBy, fileReference,
            postalTariff, dueDate, linkedInwardId, createdByTeam,
            teamMemberEmail, remarks, cc, caseClosed
        } = await c.req.json();

        const existing = await c.env.DB.prepare('SELECT * FROM outward WHERE id = ?').bind(id).first();
        if (!existing) {
            return c.json({ success: false, message: 'Outward entry not found' }, 404);
        }

        const isCaseClosed = caseClosed ? 1 : 0;
        const tariff = postalTariff || 0;

        const newValues = {
            means, to_whom: toWhom, subject, sent_by: sentBy,
            file_reference: fileReference || '', postal_tariff: tariff, due_date: dueDate || null,
            linked_inward_id: linkedInwardId || null, created_by_team: createdByTeam, team_member_email: teamMemberEmail,
            remarks: remarks || '', cc: cc || null, case_closed: isCaseClosed
        };

        const changes = [];
        for (const [field, newVal] of Object.entries(newValues)) {
            const oldVal = existing[field];
            const normalizedOld = field === 'case_closed' ? Number(oldVal) : (oldVal ?? '');
            const normalizedNew = field === 'case_closed' ? Number(newVal) : (newVal ?? '');
            if (String(normalizedOld) !== String(normalizedNew)) {
                changes.push(`${OUTWARD_FIELD_LABELS[field]}: "${formatFieldValue(field, oldVal)}" → "${formatFieldValue(field, newVal)}"`);
            }
        }

        await c.env.DB.prepare(`
            UPDATE outward SET
                means = ?, to_whom = ?, subject = ?, sent_by = ?,
                file_reference = ?, postal_tariff = ?, due_date = ?,
                linked_inward_id = ?, created_by_team = ?, team_member_email = ?,
                remarks = ?, cc = ?, case_closed = ?, updated_at = ?
            WHERE id = ?
        `).bind(
            means, toWhom, subject, sentBy,
            fileReference || '', tariff, dueDate || null,
            linkedInwardId || null, createdByTeam, teamMemberEmail,
            remarks || '', cc || null, isCaseClosed,
            new Date().toISOString(), id
        ).run();

        if (changes.length > 0) {
            const auditActor = createdByTeam ? `${createdByTeam} Team` : 'Team';
            const description = `${auditActor} edited outward entry ${existing.outward_no} — ${changes.join('; ')}`;
            await c.env.DB.prepare(
                'INSERT INTO audit_log (action, actor, description, inward_no) VALUES (?, ?, ?, ?)'
            ).bind('OUTWARD_UPDATED', auditActor, description, null).run();
        }

        return c.json({ success: true, message: 'Outward entry updated successfully' });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
