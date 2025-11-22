const nodemailer = require('nodemailer');
const logger = require('./logger');

const bool = (val, fallback = false) => {
  if (val == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(val).trim().toLowerCase());
};

const port = Number(process.env.SMTP_PORT || 587);
const secure = (() => {
  const raw = process.env.SMTP_SECURE;
  if (raw == null) {
    // Implicitly treat port 465 as SMTPS
    return port === 465;
  }
  return bool(raw, port === 465);
})();

const hasCredentials = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

let transporter = null;

if (hasCredentials) {
  transporter = nodemailer.createTransport({
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
    tls: {
      rejectUnauthorized: bool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
    },
  });

  const shouldVerify = bool(process.env.SMTP_VERIFY_ON_START, false);

  if (shouldVerify) {
    (async function verifyConnection() {
      try {
        await transporter.verify();
        logger.info('SMTP server is ready to send emails');
      } catch (err) {
        logger.warn('SMTP verify failed', { err: err.message });
      }
    })().catch(() => {});
  }
} else {
  logger.warn('SMTP disabled: missing SMTP_HOST/SMTP_USER/SMTP_PASS environment variables');
}

async function sendMail({ to, subject, html, text, attachments = [] }) {
  if (!transporter) {
    const err = new Error('SMTP transporter is not configured');
    logger.warn('Attempted to send email without SMTP configuration', { to, subject });
    throw err;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({ from, to, subject, html, text, attachments });
  logger.info('Email sent', { messageId: info.messageId, to });
  return info;
}

module.exports = {
  transporter,
  sendMail,
};