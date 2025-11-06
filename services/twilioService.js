const { sendSMS, sendWhatsApp, client } = require('../config/twilio');

async function sendSms({ to, body }) {
  return sendSMS({ to, body });
}

async function sendWhatsapp({ to, body }) {
  return sendWhatsApp({ to, body });
}

module.exports = {
  client,
  sendSms,
  sendWhatsapp,
};