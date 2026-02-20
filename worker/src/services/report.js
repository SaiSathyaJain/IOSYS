import { sendGmailMessage } from './gmail.js';
import { toCamelCase } from '../utils/caseConverter.js';

export async function sendWeeklyReport(env) {
    console.log('Starting Weekly Report generation...');

    // 1. Fetch Data
    const pendingEntries = await getPendingEntries(env);
    const overdueEntries = pendingEntries.filter(entry => isOverdue(entry.dueDate));

    // 2. Generate HTML
    const htmlContent = generateWeeklyReportHtml(pendingEntries, overdueEntries);

    // 3. Send Email via Gmail API
    if (!env.BOSS_EMAIL) {
        console.error('BOSS_EMAIL environment variable not set.');
        return { success: false, error: 'BOSS_EMAIL not set' };
    }

    try {
        const result = await sendGmailMessage(env, {
            to: env.BOSS_EMAIL,
            subject: `Weekly Pending Entries Report - ${new Date().toLocaleDateString('en-IN')}`,
            htmlBody: htmlContent,
        });

        console.log(`Weekly Report sent successfully:`, result);
        return result;

    } catch (error) {
        console.error('Error sending Weekly Report:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}



async function getPendingEntries(env) {
    try {
        const { results } = await env.DB.prepare(
            "SELECT * FROM inward WHERE assignment_status = 'Pending' OR assignment_status = 'Unassigned' ORDER BY due_date ASC, id DESC"
        ).all();
        return toCamelCase(results);
    } catch (error) {
        console.error('Error fetching pending entries:', error);
        return [];
    }
}

function isOverdue(dueDate) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
}

function generateWeeklyReportHtml(pendingEntries, overdueEntries) {
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const totalPending = pendingEntries.length;
    const totalOverdue = overdueEntries.length;

    const rows = pendingEntries.map((entry, index) => {
        const isOverdueItem = isOverdue(entry.dueDate);
        const rowStyle = index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;';
        const statusStyle = isOverdueItem ? 'color: #dc2626; font-weight: bold;' : 'color: #d97706; font-weight: bold;';
        const formattedDate = new Date(entry.signReceiptDatetime || entry.inwardDate || Date.now()).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
            <tr style="${rowStyle} border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px; text-align: left;">Inward</td>
                <td style="padding: 12px; text-align: left;">${entry.inwardNo}</td>
                <td style="padding: 12px; text-align: left;">${entry.subject}</td>
                <td style="padding: 12px; text-align: left;">${entry.particularsFromWhom}</td>
                <td style="padding: 12px; text-align: left;">${formattedDate}</td>
                <td style="padding: 12px; text-align: left;">${entry.assignedTeam || 'Unassigned'}</td>
                <td style="padding: 12px; text-align: left; ${statusStyle}">
                    ${isOverdueItem ? 'Overdue' : (entry.assignmentStatus || 'Pending')}
                </td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; color: #1f2937; }
            .container { max-width: 900px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { padding: 24px; border-bottom: 1px solid #e5e7eb; }
            .header h1 { margin: 0; font-size: 24px; color: #111827; display: flex; align-items: center; gap: 8px; }
            .highlight { background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; border-bottom: 2px solid #f59e0b; }
            .meta { margin-top: 8px; color: #6b7280; font-size: 14px; }
            .summary-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 24px; border-radius: 4px; }
            .summary-title { font-weight: bold; font-size: 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; color: #92400e; }
            .summary-list { margin: 0; padding-left: 20px; color: #1f2937; }
            .summary-list li { margin-bottom: 4px; }
            .table-section { padding: 0 24px 24px; }
            .table-title { font-size: 18px; font-weight: bold; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th { text-align: left; padding: 12px; font-weight: 600; color: #374151; background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; }
            .footer { background-color: #f9fafb; padding: 16px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1> Weekly <span class="highlight">Pending</span> Entries Report</h1>
                <div class="meta">Generated: ${today}</div>
                <div class="meta">Total <span class="highlight">Pending</span> Entries: <strong>${totalPending}</strong></div>
            </div>

            <div class="summary-box">
                <div class="summary-title">⚠️ Summary</div>
                <p style="margin: 0 0 10px 0;">The following entries require attention and are <span class="highlight">pending</span> completion:</p>
                <ul class="summary-list">
                    <li><strong>Total Pending:</strong> ${totalPending} entries</li>
                    <li><strong>Overdue Entries:</strong> ${totalOverdue} entries</li>
                </ul>
            </div>

            <div class="table-section">
                <div class="table-title"> Detailed Report</div>
                <table>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Entry Number</th>
                            <th>Subject</th>
                            <th>Person</th>
                            <th>Date</th>
                            <th>User/Team</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <div class="footer">
                <p>This is an automated weekly report from the Inward/Outward Management System.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}
