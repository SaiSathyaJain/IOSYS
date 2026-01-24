import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from server root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

console.log('📧 Testing Email Configuration...');
console.log('User:', process.env.EMAIL_USER);
console.log('Pass Length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

async function testEmail() {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        // 1. Verify connection
        await transporter.verify();
        console.log('✅ SMTP Connection Verified');

        // 2. Send test email
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Test Email from Inward/Outward System',
            text: 'If you receive this, the email configuration is working!'
        });

        console.log('✅ Test Email Sent!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Email Failed:', error);

        if (error.code === 'EAUTH') {
            console.log('\n💡 Tip: Gmail requires an "App Password".');
            console.log('1. Go to Google Account > Security > 2-Step Verification > App passwords');
            console.log('2. Create one for "Mail" and use that 16-character code.');
        }
    }
}

testEmail();
