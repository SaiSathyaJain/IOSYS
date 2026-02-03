export async function sendAssignmentNotification(entryData) {
  const { assignedToEmail, subject, inwardNo } = entryData;

  if (!assignedToEmail) return;

  // Cloudflare Workers do not support 'nodemailer' with SMTP out of the box.
  // We log the email content. In a real deployment, integration with Resend/SendGrid/Gmail API is recommended.

  console.log(`📧 [MOCK EMAIL] To: ${assignedToEmail}`);
  console.log(`Subject: New Assignment: ${subject} [${inwardNo}]`);
  console.log(`Payload:`, JSON.stringify(entryData, null, 2));

  return { success: true, message: 'Notification logged (Email disabled in Worker)' };
}
