import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking inward table structure...');

    // valid way to check structure is attempting an insert or selecting and looking at the error or data
    // Or normally we query information_schema but that might not be accessible easily with just the JS client unless we have permissions
    // Let's try to select one row

    const { data, error } = await supabase
        .from('inward')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]).sort();
        console.log('Columns found:', columns);
        console.log('Total columns:', columns.length);
    } else {
        console.log('No data found, cannot infer columns from result. Trying generic insert to see error...');

        // Try to insert a dummy record with only known fields to see if it complains about missing columns
        const { error: insertError } = await supabase
            .from('inward')
            .insert({
                inward_no: 'TEST-CHECK',
                means: 'Test',
                particulars_from_whom: 'Test',
                subject: 'Test check columns',
                sign_receipt_datetime: new Date().toISOString()
            });

        if (insertError) {
            console.error('Insert error (likely missing columns or constraints):', insertError);
        } else {
            console.log('Insert successful (columns match or defaults exist).');
            // Clean up
            await supabase.from('inward').delete().eq('inward_no', 'TEST-CHECK');
        }
    }
}

checkTable();
