import nodemailer from 'nodemailer';

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // Use App Password, not regular password
  }
});

/**
 * Send assignment notification to Team Leader
 * @param {Object} entryData - The inward entry data with assignment info
 */
export async function sendAssignmentNotification(entryData) {
  const { assignedToEmail } = entryData;

  // Skip if no email configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 Email not configured - skipping notification');
    return { success: true, skipped: true, message: 'Email not configured' };
  }

  try {
    const emailResult = await sendEmail(entryData);
    console.log(`📧 Email sent to ${assignedToEmail}:`, emailResult.messageId);

    return {
      success: true,
      emailSent: true,
      message: `Notification sent to ${assignedToEmail}`
    };
  } catch (error) {
    console.error('❌ Notification error:', error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Send email to team leader
 */
async function sendEmail(entryData) {
  const {
    inward_no, inwardNo, subject, particulars_from_whom, particularsFromWhom,
    assigned_team, assignedTeam, assigned_to_email, assignedToEmail,
    assignment_instructions, assignmentInstructions, due_date, dueDate
  } = entryData;

  // Handle both snake_case (from DB) and camelCase (from request)
  const _inwardNo = inwardNo || inward_no;
  const _subject = subject;
  const _from = particularsFromWhom || particulars_from_whom;
  const _team = assignedTeam || assigned_team;
  const _email = assignedToEmail || assigned_to_email;
  const _instructions = assignmentInstructions || assignment_instructions;
  const _dueDate = dueDate || due_date;

  const formattedDueDate = _dueDate
    ? new Date(_dueDate).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    : 'Not specified';

  const emailHtml = `
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
          <h2>📋 New Assignment - ${_team} Team</h2>
          <p>Inward No: ${_inwardNo}</p>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Subject:</div>
            <div class="value">${_subject}</div>
          </div>
          <div class="field">
            <div class="label">From:</div>
            <div class="value">${_from}</div>
          </div>
          <div class="due-date">
            <strong>⏰ Due Date:</strong> ${formattedDueDate}
          </div>
          ${_instructions ? `
          <div class="instructions">
            <strong>📝 Instructions:</strong><br/>
            ${_instructions}
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

  const mailOptions = {
    from: `"Inward/Outward System" <${process.env.EMAIL_USER}>`,
    to: _email,
    subject: `🔔 New Assignment: ${_subject} [${_inwardNo}]`,
    html: emailHtml
  };

  return await transporter.sendMail(mailOptions);
}
