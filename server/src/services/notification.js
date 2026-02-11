import nodemailer from 'nodemailer';

// Support both lowercase (env.example) and uppercase env var names
const EMAIL_USER = process.env.email_user || process.env.EMAIL_USER;
const EMAIL_PASS = process.env.email_pass || process.env.EMAIL_PASS;


function formatDate(val) {
    if (!val) return '—';
    try {
        return new Date(val).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    } catch {
        return val;
    }
}

function buildHtml({ inwardNo, subject, particularsFromWhom, assignedTeam, dueDate, assignmentInstructions, signReceiptDateTime }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; background:#f4f6fb; color:#1e293b; }
    .wrapper { max-width:580px; margin:32px auto; background:#ffffff; border-radius:10px; overflow:hidden;
               box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#5B7CFF 0%,#7c9eff 100%); padding:28px 32px; }
    .header h1 { margin:0; color:#fff; font-size:20px; font-weight:700; letter-spacing:0.3px; }
    .header p  { margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:13px; }
    .badge { display:inline-block; background:rgba(255,255,255,0.2); color:#fff;
             border-radius:20px; padding:3px 12px; font-size:12px; font-weight:600;
             margin-top:10px; letter-spacing:0.5px; }
    .body { padding:28px 32px; }
    .label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em;
             color:#64748b; margin-bottom:4px; }
    .value { font-size:14px; color:#1e293b; margin-bottom:18px; line-height:1.5; }
    .highlight { font-size:15px; font-weight:700; color:#5B7CFF; }
    .divider { border:none; border-top:1px solid #e8edf5; margin:8px 0 20px; }
    .section-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;
                     color:#5B7CFF; margin:0 0 14px; }
    .row { display:flex; gap:24px; }
    .col { flex:1; }
    .instructions-box { background:#f4f7ff; border:1px solid #c7d2fe; border-radius:6px;
                        padding:12px 14px; font-size:13px; color:#334155; line-height:1.6; }
    .footer { background:#f8fafc; padding:18px 32px; border-top:1px solid #e8edf5;
              font-size:12px; color:#94a3b8; text-align:center; }
    .footer strong { color:#64748b; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>📋 New Assignment</h1>
    <p>You have been assigned an inward entry from the Inward/Outward Management System.</p>
    <span class="badge">${inwardNo}</span>
  </div>
  <div class="body">
    <p class="label">Subject</p>
    <p class="value highlight">${subject}</p>

    <div class="row">
      <div class="col">
        <p class="label">From</p>
        <p class="value">${particularsFromWhom || '—'}</p>
      </div>
      <div class="col">
        <p class="label">Received On</p>
        <p class="value">${formatDate(signReceiptDateTime)}</p>
      </div>
    </div>

    <hr class="divider"/>
    <p class="section-title">Assignment Details</p>

    <div class="row">
      <div class="col">
        <p class="label">Assigned Team</p>
        <p class="value"><strong>${assignedTeam}</strong></p>
      </div>
      <div class="col">
        <p class="label">Due Date</p>
        <p class="value">${formatDate(dueDate)}</p>
      </div>
    </div>

    ${assignmentInstructions ? `
    <p class="label">Instructions</p>
    <div class="instructions-box">${assignmentInstructions}</div>
    ` : ''}
  </div>
  <div class="footer">
    <strong>SSSIHL Inward/Outward System</strong> &nbsp;·&nbsp;
    This is an automated notification. Please do not reply to this email.
  </div>
</div>
</body>
</html>`;
}

export async function sendAssignmentNotification(entryData, env = {}) {
    const { assignedToEmail, subject, inwardNo } = entryData;

    // Resolve credentials: CF Worker env bindings take priority, then process.env fallback
    const emailUser = env.email_user || env.EMAIL_USER || EMAIL_USER;
    const emailPass = env.email_pass || env.EMAIL_PASS || EMAIL_PASS;

    if (!assignedToEmail) return;

    if (!emailUser || !emailPass) {
        console.warn('⚠️  Email credentials missing — skipping notification for', inwardNo);
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass }
        });
        await transporter.sendMail({
            from: `"SSSIHL Inward/Outward System" <${emailUser}>`,
            to: assignedToEmail,
            subject: `[${inwardNo}] New Assignment: ${subject}`,
            html: buildHtml(entryData),
            text: `New assignment: ${inwardNo} — ${subject}\nFrom: ${entryData.particularsFromWhom || ''}\nDue: ${formatDate(entryData.dueDate)}\nInstructions: ${entryData.assignmentInstructions || 'None'}`
        });
        console.log(`✅ Email sent to ${assignedToEmail} for ${inwardNo}`);
    } catch (err) {
        console.error(`❌ Email failed for ${inwardNo}:`, err.message);
        throw err;
    }
}
