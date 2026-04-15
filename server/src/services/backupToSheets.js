/**
 * Weekly Google Sheets Backup
 * Triggered by cron every Saturday at 16:30 IST (11:00 UTC).
 * Creates a new spreadsheet in the configured Drive folder with
 * two sheets — Inward and Outward — containing all DB rows.
 */

async function getAccessToken(env) {
    if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
        throw new Error('OAuth secrets not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN missing)');
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id:     env.GMAIL_CLIENT_ID,
            client_secret: env.GMAIL_CLIENT_SECRET,
            refresh_token: env.GMAIL_REFRESH_TOKEN,
            grant_type:    'refresh_token',
        }),
    });
    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`OAuth token exchange failed: ${data.error || 'unknown'} — ${data.error_description || ''}`);
    }
    return data.access_token;
}

/** Format today's date as "19 Apr 2026" */
function formatDate(date) {
    return date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).replace(/(\d{2}) (\w{3}) (\d{4})/, '$1 $2 $3');
}

/** Convert a D1 result set into a 2D array with headers as the first row.
 *  Column names are derived from the result keys — no hardcoded list needed. */
function rowsTo2D(results) {
    if (results.length === 0) return [['(no data)']];
    const headers = Object.keys(results[0]);
    const rows = results.map(row => headers.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        return String(val);
    }));
    return [headers, ...rows];
}

export async function backupToSheets(env) {
    if (!env.BACKUP_FOLDER_ID) {
        throw new Error('BACKUP_FOLDER_ID secret not configured');
    }

    console.log('[Backup] Starting Google Sheets backup...');

    const token = await getAccessToken(env);
    const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // ── 1. Query tables ───────────────────────────────────────────────────────
    const [inwardRes, outwardRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM inward ORDER BY created_at ASC').all(),
        env.DB.prepare('SELECT * FROM outward ORDER BY created_at ASC').all(),
    ]);

    const inwardRows  = inwardRes.results  || [];
    const outwardRows = outwardRes.results || [];
    console.log(`[Backup] Fetched ${inwardRows.length} inward, ${outwardRows.length} outward rows`);

    // ── 2. Create spreadsheet in Drive folder ─────────────────────────────────
    const title = `IOSYS Backup — ${formatDate(new Date())}`;
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
            name:     title,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents:  [env.BACKUP_FOLDER_ID],
        }),
    });
    const createData = await createRes.json();
    if (!createData.id) {
        throw new Error(`Drive file creation failed: ${JSON.stringify(createData)}`);
    }
    const spreadsheetId = createData.id;
    console.log(`[Backup] Created spreadsheet: ${title} (id=${spreadsheetId})`);

    // ── 3. Rename Sheet1 → "Inward" and add "Outward" sheet ──────────────────
    const batchRes  = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
            requests: [
                {
                    updateSheetProperties: {
                        properties: { sheetId: 0, title: 'Inward' },
                        fields: 'title',
                    },
                },
                {
                    addSheet: {
                        properties: { title: 'Outward' },
                    },
                },
            ],
        }),
    });
    if (!batchRes.ok) {
        const e = await batchRes.json();
        throw new Error(`Sheet setup failed: ${e?.error?.message || batchRes.status}`);
    }

    // ── 4. Write Inward data ──────────────────────────────────────────────────
    const inward2D   = rowsTo2D(inwardRows);
    const inwardWrite = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inward!A1?valueInputOption=RAW`,
        {
            method: 'PUT',
            headers: authHeader,
            body: JSON.stringify({ values: inward2D }),
        }
    );
    if (!inwardWrite.ok) {
        const e = await inwardWrite.json();
        throw new Error(`Inward write failed: ${e?.error?.message || inwardWrite.status}`);
    }

    // ── 5. Write Outward data ─────────────────────────────────────────────────
    const outward2D   = rowsTo2D(outwardRows);
    const outwardWrite = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Outward!A1?valueInputOption=RAW`,
        {
            method: 'PUT',
            headers: authHeader,
            body: JSON.stringify({ values: outward2D }),
        }
    );
    if (!outwardWrite.ok) {
        const e = await outwardWrite.json();
        throw new Error(`Outward write failed: ${e?.error?.message || outwardWrite.status}`);
    }

    console.log(`[Backup] Done — ${inwardRows.length} inward + ${outwardRows.length} outward rows written to "${title}"`);
    return { spreadsheetId, title, inwardCount: inwardRows.length, outwardCount: outwardRows.length };
}
