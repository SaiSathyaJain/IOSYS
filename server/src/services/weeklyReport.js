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

function buildReportHtml({ generatedDate, inwardRows, outwardRows }) {
    // Determine the groups for outward
    const isRegistrar = (to) => (to || '').toLowerCase().includes('registrar');
    const isVC = (to) => {
        const t = (to || '').toLowerCase();
        return t.includes('vice-chancellor') || t.includes('vc');
    };

    const notesToRegistrar = outwardRows.filter(r => isRegistrar(r.to_whom));
    const notesToVC = outwardRows.filter(r => isVC(r.to_whom));
    // General outward ignores notes to Registrar and VC
    const generalOutward = outwardRows.filter(r => !isRegistrar(r.to_whom) && !isVC(r.to_whom));

    // Helper to generate a table
    const tableStyle = 'width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-bottom:24px"';
    const thStyle = 'background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e8edf5';
    const tdStyle = 'padding:10px 12px;border-bottom:1px solid #e8edf5';

    // 1. Inward Register
    let inwardHtml = `<table ${tableStyle}>
      <thead><tr>
        <th style="${thStyle}">Sl No</th>
        <th style="${thStyle}">Inward No.</th>
        <th style="${thStyle}">Date</th>
        <th style="${thStyle}">Description</th>
        <th style="${thStyle}">Issued to</th>
        <th style="${thStyle}">Remarks</th>
      </tr></thead>
      <tbody>`;
    if (inwardRows.length === 0) {
        inwardHtml += `<tr><td colspan="6" style="${tdStyle};text-align:center;color:#94a3b8">No pending inward entries</td></tr>`;
    } else {
        inwardRows.forEach((r, i) => {
            inwardHtml += `<tr>
              <td style="${tdStyle}">${i + 1}</td>
              <td style="${tdStyle};font-family:monospace;color:#5B7CFF;font-weight:600">${r.inward_no}</td>
              <td style="${tdStyle};white-space:nowrap">${formatDate(r.sign_receipt_datetime)}</td>
              <td style="${tdStyle}">${r.subject || '—'}</td>
              <td style="${tdStyle}">${r.assigned_team || '—'}</td>
              <td style="${tdStyle}"></td>
            </tr>`;
        });
    }
    inwardHtml += `</tbody></table>`;

    // 2. Outward Register
    let outwardHtml = `<table ${tableStyle}>
      <thead><tr>
        <th style="${thStyle}">Sl No</th>
        <th style="${thStyle}">Outward No.</th>
        <th style="${thStyle}">Date</th>
        <th style="${thStyle}">Description</th>
        <th style="${thStyle}">Due-Date</th>
        <th style="${thStyle}">Remarks</th>
      </tr></thead>
      <tbody>`;
    if (generalOutward.length === 0) {
        outwardHtml += `<tr><td colspan="6" style="${tdStyle};text-align:center;color:#94a3b8">No general outward entries</td></tr>`;
    } else {
        generalOutward.forEach((r, i) => {
            outwardHtml += `<tr>
              <td style="${tdStyle}">${i + 1}</td>
              <td style="${tdStyle};font-family:monospace;color:#10b981;font-weight:600">${r.outward_no}</td>
              <td style="${tdStyle};white-space:nowrap">${formatDate(r.sign_receipt_datetime)}</td>
              <td style="${tdStyle}">${r.subject || '—'}</td>
              <td style="${tdStyle};white-space:nowrap">${formatDate(r.due_date)}</td>
              <td style="${tdStyle}">${r.remarks || ''}</td>
            </tr>`;
        });
    }
    outwardHtml += `</tbody></table>`;

    // 3. Notes sent to Registrar
    let registrarHtml = `<table ${tableStyle}>
      <thead><tr>
        <th style="${thStyle}">Sl. No.</th>
        <th style="${thStyle}">Outward No.</th>
        <th style="${thStyle}">Date</th>
        <th style="${thStyle}">Description</th>
        <th style="${thStyle}">Remarks</th>
      </tr></thead>
      <tbody>`;
    if (notesToRegistrar.length === 0) {
        registrarHtml += `<tr><td colspan="5" style="${tdStyle};text-align:center;color:#94a3b8">No entries</td></tr>`;
    } else {
        notesToRegistrar.forEach((r, i) => {
            registrarHtml += `<tr>
              <td style="${tdStyle}">${i + 1}</td>
              <td style="${tdStyle};font-family:monospace;color:#f59e0b;font-weight:600">${r.outward_no}</td>
              <td style="${tdStyle};white-space:nowrap">${formatDate(r.sign_receipt_datetime)}</td>
              <td style="${tdStyle}">${r.subject || '—'}</td>
              <td style="${tdStyle}">${r.remarks || ''}</td>
            </tr>`;
        });
    }
    registrarHtml += `</tbody></table>`;

    // 4. Notes sent to Vice-Chancellor
    let vcHtml = `<table ${tableStyle}>
      <thead><tr>
        <th style="${thStyle}">Sl. No.</th>
        <th style="${thStyle}">Outward No.</th>
        <th style="${thStyle}">Date</th>
        <th style="${thStyle}">Description</th>
        <th style="${thStyle}">Remarks</th>
      </tr></thead>
      <tbody>`;
    if (notesToVC.length === 0) {
        vcHtml += `<tr><td colspan="5" style="${tdStyle};text-align:center;color:#94a3b8">No entries</td></tr>`;
    } else {
        notesToVC.forEach((r, i) => {
            vcHtml += `<tr>
              <td style="${tdStyle}">${i + 1}</td>
              <td style="${tdStyle};font-family:monospace;color:#8b5cf6;font-weight:600">${r.outward_no}</td>
              <td style="${tdStyle};white-space:nowrap">${formatDate(r.sign_receipt_datetime)}</td>
              <td style="${tdStyle}">${r.subject || '—'}</td>
              <td style="${tdStyle}">${r.remarks || ''}</td>
            </tr>`;
        });
    }
    vcHtml += `</tbody></table>`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
</head>
<body style="margin:0;padding:16px;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;color:#1e293b">
<div style="max-width:800px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1e293b;padding:28px 32px">
    <div style="font-size:22px;font-weight:700;color:#fff;margin:0;line-height:1.4">
      Review of Pending cases with reference to Inward register, Outward register, Notes sent to Registrar, Notes Sent to Vice-Chancellor
    </div>
    <div style="margin:16px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Generated: ${generatedDate}</div>
  </div>
  <div style="padding:28px 32px">
    
    <h3 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e8edf5;padding-bottom:8px;margin-bottom:16px">Inward Register</h3>
    ${inwardHtml}

    <h3 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e8edf5;padding-bottom:8px;margin-bottom:16px">Outward Register</h3>
    ${outwardHtml}

    <h3 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e8edf5;padding-bottom:8px;margin-bottom:16px">Notes sent to Registrar</h3>
    ${registrarHtml}

    <h3 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e8edf5;padding-bottom:8px;margin-bottom:16px">Notes to Vice-Chancellor</h3>
    ${vcHtml}

  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e8edf5;font-size:12px;color:#94a3b8;text-align:center">
    <strong style="color:#64748b">SSSIHL Inward/Outward System</strong> &nbsp;·&nbsp; This is an automated weekly report. Please do not reply.
  </div>
</div>
</body>
</html>`;
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
        `SELECT outward_no, subject, to_whom, sign_receipt_datetime, due_date, remarks
         FROM outward WHERE case_closed = 0 ORDER BY id ASC`
    ).all();

    const generatedDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    const html = buildReportHtml({ generatedDate, inwardRows, outwardRows });

    await sendEmail({
        to: bossEmail,
        subject: `Weekly Pending Entries Report — ${generatedDate}`,
        html,
        env
    });

    console.log(`Weekly report sent to ${bossEmail} — ${inwardRows.length} inward, ${outwardRows.length} outward entries`);
}
