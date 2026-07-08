const nodemailer = require('nodemailer');

// Load environment variables for mailer
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@zynkarashift.local';

let transporter = null;

// Initialize transporter only if credentials are set
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Send a verification email containing a 6-digit OTP code.
 * Falls back to logging the code to the console for local development.
 * @param {string} email
 * @param {string} code
 */
async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: `"ZynkaraShift" <${SMTP_FROM}>`,
    to: email,
    subject: 'Verify Your Email - ZynkaraShift',
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center;">Verify Your ZynkaraShift Account</h2>
        <p style="font-size: 16px; color: #374151; line-height: 1.5;">Thank you for registering on ZynkaraShift PaaS Platform. Please use the verification code below to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: 700; color: #1e1b4b; background-color: #f3f4f6; padding: 12px 24px; border-radius: 8px; letter-spacing: 4px;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; text-align: center; margin-top: 30px;">This code is valid for 15 minutes. If you did not request this code, please ignore this email.</p>
      </div>
    `,
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`[MAILER] Sent verification email to ${email}`);
      return;
    } catch (err) {
      console.error('[MAILER] Failed to send verification email, falling back to console:', err);
    }
  }

  // Developer Fallback Console Output
  console.log(`
========================================================================
[DEV MAILER FALLBACK]
TO: ${email}
SUBJECT: Verify Your Email - ZynkaraShift
VERIFICATION CODE: ${code}
(Please configure SMTP env variables in backend/.env for real emails)
========================================================================
  `);
}

module.exports = {
  sendVerificationEmail
};
