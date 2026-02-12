/**
 * One-time script to get Gmail OAuth2 refresh token.
 *
 * Steps:
 * 1. Go to https://console.cloud.google.com
 * 2. Create a project (or select existing)
 * 3. Enable "Gmail API" under APIs & Services > Library
 * 4. Go to APIs & Services > Credentials > Create Credentials > OAuth client ID
 * 5. Application type: Web application — give it a name
 * 6. Under "Authorized redirect URIs" click Add URI and enter: http://localhost:3456
 * 7. Click Create, then copy the Client ID and Client Secret into this file below
 * 8. Run: node src/scripts/get-gmail-token.js
 * 9. Your browser will open automatically — sign in and allow access
 * 10. The refresh_token will be printed in the terminal — copy it to .dev.vars
 */

import http from 'http';

// ── FILL THESE IN ──────────────────────────────────────────────────────────────
const CLIENT_ID     = '4737331866-hvuevukis1oeppdra041k8as6notemsi.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
// ───────────────────────────────────────────────────────────────────────────────

const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

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

// Try to open the browser automatically
import('child_process').then(({ exec }) => {
    const cmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
    exec(cmd);
});

// Start a local server to catch the redirect
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');
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
    res.end(`<h2>✅ Authorised! You can close this tab.</h2><p>Check your terminal for the refresh token.</p>`);
    server.close();

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });

    const data = await tokenRes.json();

    if (data.error) {
        console.error('\n❌ Token error:', data.error_description || data.error);
        process.exit(1);
    }

    console.log('\n✅ Success! Copy these into your server/.dev.vars file:\n');
    console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`GMAIL_FROM=saisathyajain@sssihl.edu.in`);
    console.log('');
});

server.listen(PORT, () => {
    console.log(`⏳ Waiting for Google to redirect to http://localhost:${PORT} ...\n`);
});
