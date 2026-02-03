import express from 'express';
import { sendAssignmentNotification } from '../services/notification.js';
import { toCamelCase } from '../utils/caseConverter.js';

const router = express.Router();

// Get all inward entries
router.get('/', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('inward')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        const entries = toCamelCase(data);
        res.json({ success: true, entries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single inward entry
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('inward')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows found
                return res.status(404).json({ success: false, message: 'Entry not found' });
            }
            throw error;
        }

        const entry = toCamelCase(data);
        res.json({ success: true, entry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create new inward entry
router.post('/', async (req, res) => {
    try {
        const {
            means, particularsFromWhom, subject,
            signReceiptDateTime, fileReference,
            assignedTeam, assignedToEmail, assignmentInstructions, dueDate
        } = req.body;

        // Generate inward number
        // Note: In high currency, this count method is not race-condition safe, but sufficient for this scale.
        const { count, error: countError } = await req.supabase
            .from('inward')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        const year = new Date().getFullYear();
        const nextCount = count + 1;
        const inwardNo = `INW/${year}/${nextCount.toString().padStart(3, '0')}`;

        const newEntry = {
            inward_no: inwardNo,
            means,
            particulars_from_whom: particularsFromWhom,
            subject,
            sign_receipt_datetime: signReceiptDateTime,
            file_reference: fileReference || '',
            assigned_team: assignedTeam || null,
            assigned_to_email: assignedToEmail || null,
            assignment_instructions: assignmentInstructions || '',
            assignment_date: assignedTeam ? new Date().toISOString() : null,
            assignment_status: assignedTeam ? 'Pending' : 'Unassigned',
            due_date: dueDate || null
        };

        const { data, error } = await req.supabase
            .from('inward')
            .insert(newEntry)
            .select()
            .single();

        if (error) throw error;

        const insertedEntry = toCamelCase(data);
        const id = insertedEntry.id;

        // Send notification if assigned
        if (assignedTeam && assignedToEmail) {
            try {
                await sendAssignmentNotification({
                    id, inwardNo, subject, particularsFromWhom,
                    assignedTeam, assignedToEmail, assignmentInstructions, dueDate
                });
            } catch (notifyError) {
                console.error('Notification error:', notifyError);
            }
        }

        res.json({
            success: true,
            message: 'Inward entry created successfully',
            id,
            inwardNo
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Assign entry to team leader
router.put('/:id/assign', async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTeam, assignedToEmail, assignmentInstructions, dueDate } = req.body;

        // Fetch existing first to check existence
        const { data: existing, error: fetchError } = await req.supabase
            .from('inward')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        const updates = {
            assigned_team: assignedTeam,
            assigned_to_email: assignedToEmail,
            assignment_instructions: assignmentInstructions,
            assignment_date: new Date().toISOString(),
            assignment_status: 'Pending',
            due_date: dueDate,
            updated_at: new Date().toISOString()
        };

        const { error: updateError } = await req.supabase
            .from('inward')
            .update(updates)
            .eq('id', id);

        if (updateError) throw updateError;

        // Send notification
        try {
            const entry = toCamelCase(existing);
            await sendAssignmentNotification({
                ...entry,
                assignedTeam, assignedToEmail, assignmentInstructions, dueDate
            });
        } catch (notifyError) {
            console.error('Notification error:', notifyError);
        }

        res.json({
            success: true,
            message: `Entry assigned to ${assignedTeam} team. Notification sent to ${assignedToEmail}`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update entry status
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { assignmentStatus } = req.body;

        const updates = {
            assignment_status: assignmentStatus,
            updated_at: new Date().toISOString()
        };

        if (assignmentStatus === 'Completed') {
            updates.completion_date = new Date().toISOString();
        }

        const { error } = await req.supabase
            .from('inward')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
