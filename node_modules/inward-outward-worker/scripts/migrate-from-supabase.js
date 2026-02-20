/**
 * Migration Script: Supabase to Cloudflare D1
 *
 * This script exports data from Supabase and generates SQL statements for D1.
 *
 * Usage:
 * 1. Set your Supabase credentials in .env file (in server folder)
 * 2. Run: node scripts/migrate-from-supabase.js
 * 3. This generates migrations/0002_data.sql
 * 4. Run: wrangler d1 execute inward-outward-db --file=./migrations/0002_data.sql
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from server folder
config({ path: join(__dirname, '../../server/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function escapeSQL(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Escape single quotes by doubling them
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function migrate() {
  console.log('Fetching data from Supabase...\n');

  // Fetch inward entries
  const { data: inwardData, error: inwardError } = await supabase
    .from('inward')
    .select('*')
    .order('id', { ascending: true });

  if (inwardError) {
    console.error('Error fetching inward:', inwardError);
    return;
  }

  // Fetch outward entries
  const { data: outwardData, error: outwardError } = await supabase
    .from('outward')
    .select('*')
    .order('id', { ascending: true });

  if (outwardError) {
    console.error('Error fetching outward:', outwardError);
    return;
  }

  console.log(`Found ${inwardData.length} inward entries`);
  console.log(`Found ${outwardData.length} outward entries\n`);

  // Generate SQL
  let sql = '-- Migration from Supabase to D1\n';
  sql += `-- Generated on ${new Date().toISOString()}\n\n`;

  // Inward inserts
  if (inwardData.length > 0) {
    sql += '-- Inward entries\n';
    for (const row of inwardData) {
      sql += `INSERT INTO inward (
  id, inward_no, means, particulars_from_whom, subject, assigned_to,
  sign_receipt_datetime, file_reference, assigned_team, assigned_to_email,
  assignment_instructions, assignment_date, assignment_status, due_date,
  completion_date, created_at, updated_at
) VALUES (
  ${row.id}, ${escapeSQL(row.inward_no)}, ${escapeSQL(row.means)}, ${escapeSQL(row.particulars_from_whom)},
  ${escapeSQL(row.subject)}, ${escapeSQL(row.assigned_to)}, ${escapeSQL(row.sign_receipt_datetime)},
  ${escapeSQL(row.file_reference)}, ${escapeSQL(row.assigned_team)}, ${escapeSQL(row.assigned_to_email)},
  ${escapeSQL(row.assignment_instructions)}, ${escapeSQL(row.assignment_date)}, ${escapeSQL(row.assignment_status)},
  ${escapeSQL(row.due_date)}, ${escapeSQL(row.completion_date)}, ${escapeSQL(row.created_at)}, ${escapeSQL(row.updated_at)}
);\n`;
    }
    sql += '\n';
  }

  // Outward inserts
  if (outwardData.length > 0) {
    sql += '-- Outward entries\n';
    for (const row of outwardData) {
      sql += `INSERT INTO outward (
  id, outward_no, means, to_whom, subject, sent_by, sign_receipt_datetime,
  case_closed, file_reference, postal_tariff, due_date, linked_inward_id,
  created_by_team, team_member_email, created_at, updated_at
) VALUES (
  ${row.id}, ${escapeSQL(row.outward_no)}, ${escapeSQL(row.means)}, ${escapeSQL(row.to_whom)},
  ${escapeSQL(row.subject)}, ${escapeSQL(row.sent_by)}, ${escapeSQL(row.sign_receipt_datetime)},
  ${row.case_closed ? 1 : 0}, ${escapeSQL(row.file_reference)}, ${row.postal_tariff || 0},
  ${escapeSQL(row.due_date)}, ${row.linked_inward_id || 'NULL'}, ${escapeSQL(row.created_by_team)},
  ${escapeSQL(row.team_member_email)}, ${escapeSQL(row.created_at)}, ${escapeSQL(row.updated_at)}
);\n`;
    }
    sql += '\n';
  }

  // Reset autoincrement sequences
  if (inwardData.length > 0) {
    const maxInwardId = Math.max(...inwardData.map(r => r.id));
    sql += `-- Reset inward sequence\n`;
    sql += `UPDATE sqlite_sequence SET seq = ${maxInwardId} WHERE name = 'inward';\n\n`;
  }
  if (outwardData.length > 0) {
    const maxOutwardId = Math.max(...outwardData.map(r => r.id));
    sql += `-- Reset outward sequence\n`;
    sql += `UPDATE sqlite_sequence SET seq = ${maxOutwardId} WHERE name = 'outward';\n`;
  }

  // Write to file
  const outputPath = join(__dirname, '../migrations/0002_data.sql');
  writeFileSync(outputPath, sql);
  console.log(`Migration SQL written to: ${outputPath}`);
  console.log('\nTo apply migration, run:');
  console.log('  wrangler d1 execute inward-outward-db --file=./migrations/0002_data.sql');
}

migrate().catch(console.error);
