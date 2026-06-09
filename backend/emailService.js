/**
 * emailService.js
 * 
 * Handles sending email notifications to employees and managers.
 * If SMTP credentials are provided in .env, it uses Nodemailer to send actual emails.
 * Otherwise, it logs emails to the console and inserts them into the 'simulated_emails' database table,
 * which can be read by the frontend's Simulated Inbox drawer for testing.
 */

const nodemailer = require('nodemailer');
const db = require('./database'); // Import database module to save logs
require('dotenv').config();

// Create transporter only if email configurations are set
let transporter = null;

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (emailUser && emailPass) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
  console.log('Nodemailer SMTP transporter initialized.');
} else {
  console.log('SMTP credentials not found in .env. Falling back to Database Email Simulator.');
}

/**
 * Sends an email notification.
 * 
 * @param {Object} mailOptions
 * @param {string} mailOptions.to - Recipient email address
 * @param {string} mailOptions.subject - Email subject line
 * @param {string} mailOptions.html - HTML content of the email
 */
async function sendEmail({ to, subject, html }) {
  // Always log to the console for easy debugging
  console.log('\n=================== SIMULATED EMAIL ===================');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:    ${html.replace(/<[^>]*>/g, ' ')}`); // Strip HTML tags for clean console display
  console.log('=======================================================\n');

  try {
    // 1. Save email to database so it can be viewed in the app's Simulated Inbox
    await db.query(
      'INSERT INTO simulated_emails (to_email, subject, body) VALUES (?, ?, ?)',
      [to, subject, html]
    );

    // 2. Try to send the real email if Nodemailer transporter is configured
    if (transporter) {
      await transporter.sendMail({
        from: `"Offboardly Notifications" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
      });
      console.log(`Real email successfully sent to ${to} via SMTP.`);
    } else {
      console.log(`Email simulated and saved to database for ${to}.`);
    }
  } catch (error) {
    console.error('Error in sendEmail service:', error.message);
  }
}

/**
 * Email Templates helper
 */
const templates = {
  // When an employee submits a leave request
  leaveSubmitted: (employeeName, leaveType, startDate, endDate, reason) => ({
    subject: `New Leave Request Submitted - ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0c1f38; background-color: #f8f9fa; border-radius: 8px;">
        <h2 style="color: #0c1f38; border-bottom: 2px solid #a7e0d7; padding-bottom: 10px;">New Leave Application</h2>
        <p>Hello Manager,</p>
        <p><strong>${employeeName}</strong> has submitted a new leave request:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Leave Type</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Start Date</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${startDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">End Date</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Reason</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${reason}</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">Please log in to the <strong>Offboardly Manager Dashboard</strong> to approve or reject this request.</p>
        <footer style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
          This is an automated message from Offboardly HR.
        </footer>
      </div>
    `
  }),

  // When a manager approves a leave request
  leaveApproved: (employeeName, leaveType, startDate, endDate) => ({
    subject: `Leave Request Approved! - Offboardly`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0c1f38; background-color: #f8f9fa; border-radius: 8px;">
        <h2 style="color: #2ea44f; border-bottom: 2px solid #a7e0d7; padding-bottom: 10px;">Leave Request Approved</h2>
        <p>Hello ${employeeName},</p>
        <p>We are pleased to inform you that your leave request has been <strong>Approved</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Leave Type</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Duration</td>
            <td style="padding: 8px; border: 1px solid #ddd;">From ${startDate} to ${endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Status</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #2ea44f; font-weight: bold;">APPROVED</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">Your leave balance has been updated. Have a restful time off!</p>
        <footer style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
          This is an automated message from Offboardly HR.
        </footer>
      </div>
    `
  }),

  // When a manager rejects a leave request
  leaveRejected: (employeeName, leaveType, startDate, endDate) => ({
    subject: `Leave Request Declined - Offboardly`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0c1f38; background-color: #f8f9fa; border-radius: 8px;">
        <h2 style="color: #e65401; border-bottom: 2px solid #a7e0d7; padding-bottom: 10px;">Leave Request Declined</h2>
        <p>Hello ${employeeName},</p>
        <p>We regret to inform you that your leave request has been <strong>Declined</strong> by your manager at this time.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Leave Type</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Duration</td>
            <td style="padding: 8px; border: 1px solid #ddd;">From ${startDate} to ${endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #eef1f6;">Status</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #e65401; font-weight: bold;">DECLINED</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">If you have any questions, please reach out to your manager directly.</p>
        <footer style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
          This is an automated message from Offboardly HR.
        </footer>
      </div>
    `
  })
};

module.exports = {
  sendEmail,
  templates,
};
