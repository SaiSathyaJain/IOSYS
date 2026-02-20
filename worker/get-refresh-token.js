// Simple script to get Google OAuth Refresh Token
// Works with BOTH "Web application" and "Desktop" client types
// Run: node get-refresh-token.js

import http from 'http';
import { exec } from 'child_process';
import readline from 'readline';

const CLIENT_ID = process.env.G_CLIENT_ID;
const CLIENT_SECRET = process.env.G_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing credentials. Run:');
    console.error('  $env:G_CLIENT_ID="your-id"; $env:G_CLIENT_SECRET="your-secret"; node get-refresh-token.js');
    process.exit(1);
}

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

// Try localhost server first, fall back to manual code entry
const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}`;

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPE)}&` +
    `access_type=offline&` +
    `prompt=consent`;

console.log('\n========================================');
console.log('Google OAuth Refresh Token Generator');
console.log('========================================\n');
console.log('Opening browser...');
console.log('Sign in with the account you want to send emails FROM.\n');

const start = process.platform === 'win32' ? 'start' : 'open';
exec(`${start} "" "${authUrl}"`);

async function exchangeCode(code) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        }),
    });
    const data = await response.json();
    if (data.refresh_token) {
        console.log('\n✅ SUCCESS! Your Refresh Token:\n');
        console.log('========================================');
        console.log(data.refresh_token);
        console.log('========================================\n');
        console.log('Run: npx wrangler secret put GOOGLE_REFRESH_TOKEN --name inward-outward-api');
        console.log('Paste the token above when prompted.\n');
    } else {
        console.error('Error:', JSON.stringify(data, null, 2));
    }
    process.exit(0);
}

// Start a local server to catch the redirect
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');
    if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Success! Check your terminal for the refresh token. You can close this tab.</h1>');
        await exchangeCode(code);
    }
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
    console.log('\nIf the browser shows an error, copy the FULL URL from the');
    console.log('browser address bar (even if it says "cannot connect") and');
    console.log('paste it below:\n');
});

// Also listen for manual paste of the redirect URL
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (trimmed.includes('code=')) {
        try {
            const url = new URL(trimmed);
            const code = url.searchParams.get('code');
            if (code) {
                server.close();
                await exchangeCode(code);
            }
        } catch {
            console.log('Could not parse URL. Make sure you paste the full URL.');
        }
    }
});
