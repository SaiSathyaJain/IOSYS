/**
 * One-time script to get Gmail OAuth2 refresh token.
 *
 * Steps:
 * 1. Go to https://console.cloud.google.com
 * 2. Enable "Gmail API" under APIs & Services > Library
 * 3. Go to APIs & Services > Credentials > Create Credentials > OAuth client ID
 * 4. Application type: Web application
 * 5. Under "Authorized redirect URIs" add: http://localhost:3456
 * 6. Copy the Client ID and Client Secret into server/.dev.vars as:
 *      GMAIL_CLIENT_ID=...
 *      GMAIL_CLIENT_SECRET=...
 * 7. Run: node src/scripts/get-gmail-token.js
 * 8. Sign in via the browser — the refresh token will be printed in the terminal
 * 9. Copy GMAIL_REFRESH_TOKEN into server/.dev.vars
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Read credentials from .dev.vars ──────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devVarsPath = path.resolve(__dirname, '../../.dev.vars');

if (!fs.existsSync(devVarsPath)) {
    console.error('❌ server/.dev.vars not found. Create it and add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.');
    process.exit(1);
}

const devVars = Object.fromEntries(
    fs.readFileSync(devVarsPath, 'utf8')
        .split('\n')
        .filter(line => line.includes('=') && !line.startsWith('#'))
        .map(line => {
            const idx = line.indexOf('=');
            return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
);

const CLIENT_ID     = devVars.GMAIL_CLIENT_ID;
const CLIENT_SECRET = devVars.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET missing in server/.dev.vars');
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────

const PORT         = 3456;
const REDIRECT_URI = `http://localhost:${PORT}`;
// gmail.modify = read + list + mark-as-read + send (superset of gmail.send)
const SCOPES       = 'https://www.googleapis.com/auth/gmail.modify';

const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent`;

console.log('\n🔗 Opening browser for Google sign-in...');
console.log('   If it does not open, paste this URL manually:\n');
console.log(authUrl + '\n');

import('child_process').then(({ exec }) => {
    const cmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
    exec(cmd);
});

const server = http.createServer(async (req, res) => {
    const url   = new URL(req.url, `http://localhost:${PORT}`);
    const code  = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h2>❌ Error: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        console.error('❌ Auth error:', error);
        process.exit(1);
    }

    if (!code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Waiting...</h2>');
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>✅ Authorised! You can close this tab.</h2><p>Check your terminal for the refresh token.</p>');
    server.close();

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id:     CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri:  REDIRECT_URI,
            grant_type:    'authorization_code',
        }),
    });

    const data = await tokenRes.json();

    if (data.error) {
        console.error('\n❌ Token error:', data.error_description || data.error);
        process.exit(1);
    }

    console.log('\n✅ Success! Add this line to your server/.dev.vars:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
    console.log('');
});

server.listen(PORT, () => {
    console.log(`⏳ Waiting for Google to redirect to http://localhost:${PORT} ...\n`);
});
