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
 * Build a minimal RFC-2822 message and base64url-encode it.
 */
function buildRawMessage({ from, to, subject, html }) {
    const msg = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
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
        : '—';

    const instructionsBlock = assignmentInstructions
        ? `<div style="background:#fefce8;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400e;margin-bottom:8px">Assignment Instructions</div>
            <p style="font-size:13px;color:#78350f;line-height:1.6;margin:0">${assignmentInstructions}</p>
           </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;color:#1e293b">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%);padding:28px 32px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">📋</div>
        <div style="color:rgba(255,255,255,0.65);font-size:11px;letter-spacing:0.1em;text-transform:uppercase">SSSIHL — Inward/Outward System</div>
      </div>
      <h1 style="margin:0 0 6px;color:#fff;font-size:21px;font-weight:700">New Entry Assigned to You</h1>
      <p style="margin:0;color:rgba(255,255,255,0.65);font-size:13px">Please review the details below and take action before the due date.</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">

      <!-- Entry details -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">Entry Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr>
            <td style="padding:7px 0;color:#64748b;width:42%">Entry Number</td>
            <td style="padding:7px 0;font-weight:700;color:#1e293b;font-family:monospace">${inwardNo}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#64748b;border-top:1px solid #f1f5f9">Subject</td>
            <td style="padding:7px 0;font-weight:600;color:#1e293b;border-top:1px solid #f1f5f9">${subject}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#64748b;border-top:1px solid #f1f5f9">From / Sender</td>
            <td style="padding:7px 0;color:#1e293b;border-top:1px solid #f1f5f9">${particularsFromWhom}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#64748b;border-top:1px solid #f1f5f9">Assigned Team</td>
            <td style="padding:7px 0;border-top:1px solid #f1f5f9">
              <span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">${assignedTeam}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#64748b;border-top:1px solid #f1f5f9">Due Date</td>
            <td style="padding:7px 0;font-weight:600;color:#dc2626;border-top:1px solid #f1f5f9">${formattedDue}</td>
          </tr>
        </table>
      </div>

      ${instructionsBlock}

      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
        Log in to IOSYS to update the status and respond to this entry.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
      <strong>SSSIHL Inward/Outward System</strong> &nbsp;·&nbsp; This is an automated notification. Please do not reply.
    </div>
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
