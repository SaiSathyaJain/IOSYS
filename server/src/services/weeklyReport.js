import { sendEmail } from './notification.js';

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

function buildReportHtml({ generatedDate, entries }) {
    const inwardPending = entries.filter(e => e.type === 'Inward' && e.status !== 'Completed');
    const outwardPending = entries.filter(e => e.type === 'Outward');

    const unassigned = inwardPending.filter(e => e.status === 'Unassigned').length;
    const pending = inwardPending.filter(e => e.status === 'Pending').length;
    const inProgress = inwardPending.filter(e => e.status === 'In Progress').length;
    const openOutward = outwardPending.length;
    const total = inwardPending.length + outwardPending.length;

    const rowsHtml = entries.map(e => `
        <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5;font-weight:600;color:${e.type === 'Inward' ? '#5B7CFF' : '#10b981'}">${e.type}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5;font-family:monospace;font-size:13px">${e.entryNo}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5">${e.subject || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5">${e.person || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5;white-space:nowrap">${formatDate(e.date)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5">${e.team || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e8edf5">
                <span style="background:${statusColor(e.status)};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">${e.status}</span>
            </td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;color:#1e293b}
  .wrapper{max-width:760px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:28px 32px}
  .header h1{margin:0;color:#fff;font-size:22px;font-weight:700}
  .header p{margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px}
  .body{padding:28px 32px}
  .summary-box{background:#fff8e1;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px}
  .summary-box h3{margin:0 0 10px;font-size:14px;color:#92400e}
  .summary-grid{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px}
  .stat-card{flex:1;min-width:120px;background:#fff;border:1px solid #e8edf5;border-radius:8px;padding:14px;text-align:center}
  .stat-num{font-size:28px;font-weight:700;color:#1e293b}
  .stat-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5}
  .footer{background:#f8fafc;padding:16px 32px;border-top:1px solid #e8edf5;font-size:12px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Weekly Pending Entries Report</h1>
    <p>Generated: ${generatedDate} &nbsp;|&nbsp; Total Pending: ${total}</p>
  </div>
  <div class="body">
    <div class="summary-box">
      <h3>Summary</h3>
      <p style="margin:0;font-size:13px;color:#78350f">The following entries require attention and are pending completion:</p>
      <div class="summary-grid">
        <div class="stat-card"><div class="stat-num">${unassigned}</div><div class="stat-label">Unassigned</div></div>
        <div class="stat-card"><div class="stat-num">${pending}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card"><div class="stat-num">${inProgress}</div><div class="stat-label">In Progress</div></div>
        <div class="stat-card"><div class="stat-num">${openOutward}</div><div class="stat-label">Open Outward</div></div>
        <div class="stat-card" style="border-color:#5B7CFF"><div class="stat-num" style="color:#5B7CFF">${total}</div><div class="stat-label">Total Pending</div></div>
      </div>
    </div>
    ${total === 0 ? '<p style="text-align:center;color:#10b981;font-weight:600;padding:20px">All entries are up to date!</p>' : `
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#5B7CFF;margin:0 0 14px">Detailed Report</h3>
    <table>
      <thead><tr>
        <th>Type</th><th>Entry Number</th><th>Subject</th><th>Person</th><th>Date</th><th>Team</th><th>Status</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`}
  </div>
  <div class="footer">
    <strong>SSSIHL Inward/Outward System</strong> &nbsp;·&nbsp; This is an automated weekly report. Please do not reply.
  </div>
</div>
</body>
</html>`;
}

function statusColor(status) {
    const map = {
        'Unassigned': '#94a3b8',
        'Pending': '#f59e0b',
        'In Progress': '#3b82f6',
        'Open': '#10b981',
    };
    return map[status] || '#64748b';
}

export async function sendWeeklyReport(env) {
    const db = env.DB;
    const bossEmail = env.BOSS_EMAIL;

    if (!bossEmail) {
        console.warn('BOSS_EMAIL not set — skipping weekly report');
        return;
    }

    // Fetch pending inward entries (not completed)
    const { results: inwardRows } = await db.prepare(
        `SELECT inward_no, subject, particulars_from_whom, sign_receipt_datetime, assigned_team, assignment_status
         FROM inward WHERE assignment_status != 'Completed' ORDER BY id ASC`
    ).all();

    // Fetch open outward entries
    const { results: outwardRows } = await db.prepare(
        `SELECT outward_no, subject, to_whom, sign_receipt_datetime, created_by_team
         FROM outward WHERE case_closed = 0 ORDER BY id ASC`
    ).all();

    const entries = [
        ...inwardRows.map(r => ({
            type: 'Inward',
            entryNo: r.inward_no,
            subject: r.subject,
            person: r.particulars_from_whom,
            date: r.sign_receipt_datetime,
            team: r.assigned_team,
            status: r.assignment_status
        })),
        ...outwardRows.map(r => ({
            type: 'Outward',
            entryNo: r.outward_no,
            subject: r.subject,
            person: r.to_whom,
            date: r.sign_receipt_datetime,
            team: r.created_by_team,
            status: 'Open'
        }))
    ];

    const generatedDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    const html = buildReportHtml({ generatedDate, entries });

    await sendEmail({
        to: bossEmail,
        subject: `Weekly Pending Entries Report — ${generatedDate}`,
        html,
        env
    });

    console.log(`Weekly report sent to ${bossEmail} — ${entries.length} pending entries`);
}
