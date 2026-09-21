import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendAlertEmail({ device, alert, recipients }) {
  if (!recipients || recipients.length === 0) return;
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@gmail.com') {
    console.log('[Email] SMTP not configured, skipping email send');
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Street Light Alert</h2>
        <p style="margin: 5px 0 0; opacity: 0.7;">Techavo CCMS Notification</p>
      </div>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold; width: 35%;">Device UID</td><td style="padding: 8px;">${device.uid}</td></tr>
          <tr style="background: white;"><td style="padding: 8px; font-weight: bold;">Device Name</td><td style="padding: 8px;">${device.name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Alert Type</td><td style="padding: 8px; color: #dc3545;">${alert.alert_type}</td></tr>
          <tr style="background: white;"><td style="padding: 8px; font-weight: bold;">Severity</td><td style="padding: 8px;">${alert.severity?.toUpperCase()}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Message</td><td style="padding: 8px;">${alert.message}</td></tr>
          <tr style="background: white;"><td style="padding: 8px; font-weight: bold;">Voltage</td><td style="padding: 8px;">${alert.voltage_at_alert} V</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Current</td><td style="padding: 8px;">${alert.current_at_alert} A</td></tr>
          <tr style="background: white;"><td style="padding: 8px; font-weight: bold;">Detected At</td><td style="padding: 8px;">${new Date(alert.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
        </table>
        <div style="margin-top: 20px; text-align: center;">
          <a href="http://localhost:5173/devices/${device.id}" style="background: #0066ff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-right: 10px;">View Device</a>
          <a href="http://localhost:5173/alerts" style="background: #6c757d; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">View Alert</a>
        </div>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'noreply@techavo.com',
      to: recipients.join(', '),
      subject: `[TECHAVO ALERT] ${alert.severity?.toUpperCase()} - ${alert.alert_type} - ${device.uid}`,
      html,
    });
    console.log(`[Email] Alert sent to ${recipients.join(', ')}`);
  } catch (err) {
    console.error('[Email] Failed to send alert email:', err.message);
  }
}
