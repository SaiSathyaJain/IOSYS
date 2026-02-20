// Clean Gmail API implementation - rebuilt from scratch
// Uses OAuth 2.0 with refresh token to send emails via Gmail API

export async function getAccessToken(env) {
    console.log('[Gmail API] Requesting access token...');

    // Validate credentials exist
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
        throw new Error('Missing Google OAuth credentials. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    }

    console.log('[Gmail API] Client ID:', env.GOOGLE_CLIENT_ID.substring(0, 30) + '...');
    console.log('[Gmail API] Refresh token length:', env.GOOGLE_REFRESH_TOKEN.length);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: env.GOOGLE_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error('[Gmail API] Token error:', tokenData);
        throw new Error(`Failed to get access token: ${tokenData.error} - ${tokenData.error_description || ''}`);
    }

    console.log('[Gmail API] Access token obtained successfully');
    return tokenData.access_token;
}

export async function sendGmailMessage(env, { to, subject, htmlBody }) {
    console.log('[Gmail API] Preparing to send email to:', to);

    // Get access token
    const accessToken = await getAccessToken(env);

    // Build email message in RFC 2822 format
    const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody,
    ];

    const email = emailLines.join('\r\n');

    // Encode to base64url format (Gmail API requirement)
    const base64Email = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    console.log('[Gmail API] Sending email via Gmail API...');

    const sendResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                raw: base64Email,
            }),
        }
    );

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
        console.error('[Gmail API] Send error:', sendData);
        throw new Error(`Failed to send email: ${sendData.error?.message || JSON.stringify(sendData)}`);
    }

    console.log('[Gmail API] Email sent successfully! Message ID:', sendData.id);
    return {
        success: true,
        messageId: sendData.id,
    };
}
