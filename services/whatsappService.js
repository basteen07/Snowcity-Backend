const { sendMail, transporter } = require('../config/mailer');

async function send({ to, subject, html, text, attachments = [] }) {
  return sendMail({ to, subject, html, text, attachments });
}

module.exports = {
  send,
  transporter,
};