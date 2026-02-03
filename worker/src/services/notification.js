/**
 * Send assignment notification using Resend API
 * Get your API key at https://resend.com
 */
export async function sendAssignmentNotification(env, entryData) {
  const { assignedToEmail } = entryData;

  if (!env.EMAIL_API_KEY) {
    console.log('Email not configured - skipping notification');
    return { success: true, skipped: true, message: 'Email not configured' };
  }

  try {
    const emailHtml = buildEmailHtml(entryData);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Inward/Outward System <noreply@resend.dev>',
        to: [assignedToEmail],
        subject: `New Assignment: ${entryData.subject} [${entryData.inwardNo}]`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Email API error: ${error}`);
    }

    const result = await response.json();
    console.log(`Email sent to ${assignedToEmail}:`, result.id);

    return {
      success: true,
      emailSent: true,
      message: `Notification sent to ${assignedToEmail}`
    };
  } catch (error) {
    console.error('Notification error:', error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

function buildEmailHtml(entryData) {
  const {
    inwardNo, subject, particularsFromWhom,
    assignedTeam, assignmentInstructions, dueDate
  } = entryData;

  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'Not specified';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #4b5563; }
        .value { color: #1f2937; margin-top: 5px; }
        .due-date { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 15px 0; }
        .instructions { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 10px; margin: 15px 0; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Assignment - ${assignedTeam} Team</h2>
          <p>Inward No: ${inwardNo}</p>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Subject:</div>
            <div class="value">${subject}</div>
          </div>
          <div class="field">
            <div class="label">From:</div>
            <div class="value">${particularsFromWhom}</div>
          </div>
          <div class="due-date">
            <strong>Due Date:</strong> ${formattedDueDate}
          </div>
          ${assignmentInstructions ? `
          <div class="instructions">
            <strong>Instructions:</strong><br/>
            ${assignmentInstructions}
          </div>
          ` : ''}
          <p>Please coordinate with your team members to complete this task.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from the Inward/Outward Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
