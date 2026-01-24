import express from 'express';
import { toCamelCase } from '../utils/caseConverter.js';

const router = express.Router();

// Get all outward entries
router.get('/', async (req, res) => {
    try {
        const { team } = req.query;
        let query = req.supabase
            .from('outward')
            .select('*, inward:inward!fk_inward_relation(*)')
            .order('id', { ascending: false });

        if (team) {
            query = query.eq('created_by_team', team);
        }

        const { data, error } = await query;

        if (error) throw error;

        const entries = toCamelCase(data);
        res.json({ success: true, entries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create new outward entry
router.post('/', async (req, res) => {
    try {
        const {
            means, toWhom, subject, sentBy,
            signReceiptDateTime, caseClosed, fileReference, postalTariff,
            dueDate, linkedInwardId, createdByTeam, teamMemberEmail
        } = req.body;

        // Generate outward number
        const { count, error: countError } = await req.supabase
            .from('outward')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        const year = new Date().getFullYear();
        const nextCount = count + 1;
        const outwardNo = `OTW/${year}/${nextCount.toString().padStart(3, '0')}`;

        const newEntry = {
            outward_no: outwardNo,
            means,
            to_whom: toWhom,
            subject,
            sent_by: sentBy,
            sign_receipt_datetime: signReceiptDateTime,
            case_closed: caseClosed ? 1 : 0,
            file_reference: fileReference || '',
            postal_tariff: postalTariff || 0,
            due_date: dueDate || null,
            linked_inward_id: linkedInwardId || null,
            created_by_team: createdByTeam,
            team_member_email: teamMemberEmail
        };

        const { data, error } = await req.supabase
            .from('outward')
            .insert(newEntry)
            .select()
            .single();

        if (error) throw error;

        const insertedEntry = toCamelCase(data);
        const id = insertedEntry.id;

        // If linked to inward, update the inward entry status
        if (linkedInwardId) {
            const { error: updateError } = await req.supabase
                .from('inward')
                .update({
                    assignment_status: 'Completed',
                    completion_date: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', linkedInwardId);

            if (updateError) {
                console.error('Failed to update linked inward entry:', updateError);
            }
        }

        res.json({
            success: true,
            message: 'Outward entry created successfully',
            id,
            outwardNo
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
