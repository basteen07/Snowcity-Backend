const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

async function verifyConnection() {
  try {
    await transporter.verify();
    logger.info('SMTP server is ready to send emails');
  } catch (err) {
    logger.warn('SMTP verify failed', { err: err.message });
  }
}

verifyConnection().catch(() => {});

async function sendMail({ to, subject, html, text, attachments = [] }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({ from, to, subject, html, text, attachments });
  logger.info('Email sent', { messageId: info.messageId, to });
  return info;
}

module.exports = {
  transporter,
  sendMail,
};