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
</head>
<body style="margin:0;padding:16px;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;color:#1e293b">
<div style="max-width:700px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1e293b;padding:28px 32px">
    <div style="font-size:22px;font-weight:700;color:#fff;margin:0">Weekly Pending Entries Report</div>
    <div style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Generated: ${generatedDate} &nbsp;|&nbsp; Total Pending: ${total}</div>
  </div>
  <div style="padding:28px 32px">
    <div style="background:#fff8e1;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <div style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 8px">Summary</div>
      <p style="margin:0 0 16px;font-size:13px;color:#78350f">The following entries require attention and are pending completion:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td width="20%" style="padding:4px">
            <div style="background:#fff;border:1px solid #e8edf5;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#1e293b">${unassigned}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Unassigned</div>
            </div>
          </td>
          <td width="20%" style="padding:4px">
            <div style="background:#fff;border:1px solid #e8edf5;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#1e293b">${pending}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Pending</div>
            </div>
          </td>
          <td width="20%" style="padding:4px">
            <div style="background:#fff;border:1px solid #e8edf5;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#1e293b">${inProgress}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">In Progress</div>
            </div>
          </td>
          <td width="20%" style="padding:4px">
            <div style="background:#fff;border:1px solid #e8edf5;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#1e293b">${openOutward}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Open Outward</div>
            </div>
          </td>
          <td width="20%" style="padding:4px">
            <div style="background:#fff;border:1px solid #5B7CFF;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#5B7CFF">${total}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Total Pending</div>
            </div>
          </td>
        </tr>
      </table>
    </div>
    ${total === 0 ? '<p style="text-align:center;color:#10b981;font-weight:600;padding:20px">All entries are up to date!</p>' : `
    <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5B7CFF;margin:0 0 14px">Detailed Report</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Type</th>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Entry Number</th>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Subject</th>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Person</th>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Date</th>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Team</th>
        <th style="background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5">Status</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`}
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e8edf5;font-size:12px;color:#94a3b8;text-align:center">
    <strong style="color:#64748b">SSSIHL Inward/Outward System</strong> &nbsp;·&nbsp; This is an automated weekly report. Please do not reply.
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
