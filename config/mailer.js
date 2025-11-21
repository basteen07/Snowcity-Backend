const nodemailer = require('nodemailer');
const logger = require('./logger');

const port = Number(process.env.SMTP_PORT || 587);
const secure = (() => {
  const raw = process.env.SMTP_SECURE;
  if (raw == null) {
    // Implicitly treat port 465 as SMTPS
    return port === 465;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
})();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,

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