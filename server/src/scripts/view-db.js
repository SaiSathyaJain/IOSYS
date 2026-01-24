import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbPath = join(__dirname, '..', '..', 'database.sqlite');

async function viewDatabase() {
    if (!existsSync(dbPath)) {
        console.error('❌ Database file not found at:', dbPath);
        return;
    }

    try {
        const SQL = await initSqlJs();
        const buffer = readFileSync(dbPath);
        const db = new SQL.Database(buffer);

        console.log('\n📊 === INWARD ENTRIES ===');
        const inward = db.exec("SELECT id, inward_no, subject, assigned_team, assignment_status FROM inward");
        if (inward.length > 0) {
            console.table(rowsToObjects(inward[0]));
        } else {
            console.log('No inward entries found.');
        }

        console.log('\n📊 === OUTWARD ENTRIES ===');
        const outward = db.exec("SELECT id, outward_no, subject, created_by_team FROM outward");
        if (outward.length > 0) {
            console.table(rowsToObjects(outward[0]));
        } else {
            console.log('No outward entries found.');
        }

    } catch (error) {
        console.error('Error reading database:', error.message);
    }
}

function rowsToObjects(result) {
    const { columns, values } = result;
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

viewDatabase();
