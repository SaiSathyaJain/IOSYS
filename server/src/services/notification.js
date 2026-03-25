// ── Gmail REST API email sender (CF Workers compatible — no SMTP/TCP) ──────────

/**
 * Exchange refresh token for a short-lived access token.
 */
async function getAccessToken(env) {
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
        throw new Error('Gmail OAuth: failed to get access token — ' + JSON.stringify(data));
    }
    return data.access_token;
}

/**
 * Encode a raw RFC-2822 email string as base64url (required by Gmail API).
 * Uses TextEncoder so it handles UTF-8 subjects/bodies correctly in CF Workers.
 */
function toBase64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * RFC 2047 encode a subject line so non-ASCII chars (em dash, etc.) survive email headers.
 */
function encodeSubject(text) {
    const encoded = btoa(unescape(encodeURIComponent(text)));
    return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Build a minimal RFC-2822 message and base64url-encode it.
 */
function buildRawMessage({ from, to, subject, html }) {
    const msg = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodeSubject(subject)}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
    ].join('\r\n');
    return toBase64Url(msg);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Low-level send. Called by weeklyReport.js as sendEmail({ to, subject, html, env }).
 */
export async function sendEmail({ to, subject, html, env }) {
    const accessToken = await getAccessToken(env);
    const raw = buildRawMessage({ from: env.GMAIL_FROM, to, subject, html });

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail API error ${res.status}: ${err}`);
    }
    return res.json();
}

/**
 * Build the HTML body for an assignment notification email.
 */
function buildAssignmentHtml({ inwardNo, subject, particularsFromWhom, assignedTeam, assignmentInstructions, dueDate }) {
    const formattedDue = dueDate
        ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Not specified';

    const instructionsBlock = assignmentInstructions
        ? `<div style="background:#fefce8;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400e;margin-bottom:8px">Instructions from Admin</div>
            <p style="font-size:13px;color:#78350f;line-height:1.6;margin:0">${assignmentInstructions}</p>
           </div>`
        : '';

    const teamColor = assignedTeam === 'UG' ? '#2563eb' : assignedTeam === 'PhD' ? '#7c3aed' : '#0891b2';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#eef2f7;color:#1e293b">
  <div style="max-width:600px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10)">

    <!-- Top accent bar -->
    <div style="height:4px;background:#1d4ed8"></div>

    <!-- Header -->
    <div style="background:#1d4ed8;padding:28px 32px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="vertical-align:middle">
            <table style="border-collapse:collapse;margin-bottom:14px">
              <tr>
                <td style="vertical-align:middle;padding-right:10px">
                  <img src="https://iosys.pages.dev/sssihl-icon.jpg" alt="SSSIHL" width="36" height="36" style="border-radius:8px;display:block;border:0"/>
                </td>
                <td style="vertical-align:middle">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.6)">SSSIHL &mdash; IOSYS</div>
                </td>
              </tr>
            </table>
            <div style="font-size:22px;font-weight:700;color:#fff;line-height:1.2">New Entry Assigned to You</div>
            <div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.65)">Action required before the due date</div>
          </td>
          <td style="vertical-align:top;text-align:right;padding-left:16px">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:5px 12px;border-radius:20px">Action Required</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px 32px">

      <!-- Entry ID pill -->
      <div style="margin-bottom:20px">
        <span style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-family:monospace;font-size:13px;font-weight:700;padding:6px 14px;border-radius:6px">${inwardNo}</span>
      </div>

      <!-- Entry details table -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px">
        <div style="padding:12px 20px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b">Entry Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr>
            <td style="padding:12px 20px;color:#64748b;width:38%;border-bottom:1px solid #f1f5f9">Subject</td>
            <td style="padding:12px 20px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9">${subject}</td>
          </tr>
          <tr>
            <td style="padding:12px 20px;color:#64748b;border-bottom:1px solid #f1f5f9">From / Sender</td>
            <td style="padding:12px 20px;color:#1e293b;border-bottom:1px solid #f1f5f9">${particularsFromWhom}</td>
          </tr>
          <tr>
            <td style="padding:12px 20px;color:#64748b;border-bottom:1px solid #f1f5f9">Assigned Team</td>
            <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9">
              <span style="background:${teamColor};color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">${assignedTeam}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px;color:#64748b">Due Date</td>
            <td style="padding:12px 20px;font-weight:700;color:#dc2626">${formattedDue}</td>
          </tr>
        </table>
      </div>

      ${instructionsBlock}

      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0 8px">
        <a href="https://iosys.pages.dev" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:13px 36px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.02em">Open IOSYS Portal &rarr;</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center">
      <div style="font-size:12px;color:#94a3b8">
        <strong style="color:#64748b">SSSIHL Inward / Outward System</strong><br/>
        <span style="margin-top:4px;display:inline-block">This is an automated notification &mdash; please do not reply to this email.</span>
      </div>
    </div>

    <!-- Bottom accent bar -->
    <div style="height:3px;background:#1d4ed8"></div>

  </div>
</body>
</html>`;
}

/**
 * Send an assignment notification email to the assigned team member.
 * Called by inward.js as sendAssignmentNotification(entryData, env).
 */
export async function sendAssignmentNotification(entry, env) {
    const { inwardNo, subject, particularsFromWhom, assignedTeam, assignedToEmail, assignmentInstructions, dueDate } = entry;

    if (!assignedToEmail) {
        console.warn('sendAssignmentNotification: no assignedToEmail — skipping');
        return;
    }

    const html = buildAssignmentHtml({ inwardNo, subject, particularsFromWhom, assignedTeam, assignmentInstructions, dueDate });

    await sendEmail({
        to:      assignedToEmail,
        subject: `[IOSYS] New Assignment — ${inwardNo}: ${subject}`,
        html,
        env,
    });

    console.log(`Assignment notification sent to ${assignedToEmail} for ${inwardNo}`);
}
