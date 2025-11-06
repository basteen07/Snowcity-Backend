const notificationsModel = require('../models/notifications.model');
const { sendMail } = require('../config/mailer');
const { sendWhatsApp } = require('../config/twilio');

async function list(params = {}) {
  return notificationsModel.listNotifications(params);
}

async function getById(id) {
  return notificationsModel.getNotificationById(id);
}

async function create({ user_id = null, booking_id = null, channel, message, sendNow = false, to = null, subject = null }) {
  const notif = await notificationsModel.createNotification({ user_id, booking_id, channel, message, status: 'pending' });

  if (!sendNow) return notif;

  try {
    if (channel === 'email') {
      if (!to) throw new Error('Missing recipient email');
      const text = message.replace(/<[^>]+>/g, '');
      await sendMail({ to, subject: subject || 'SnowCity Notification', html: message, text });
    } else if (channel === 'whatsapp') {
      if (!to) throw new Error('Missing recipient phone');
      await sendWhatsApp({ to, body: message });
    } else {
      throw new Error(`Unsupported channel: ${channel}`);
    }
    return notificationsModel.markSent(notif.notification_id);
  } catch (err) {
    await notificationsModel.setStatus(notif.notification_id, 'failed');
    const e = new Error(`Notification delivery failed: ${err.message}`);
    e.status = 502;
    throw e;
  }
}

async function resend(id, { to = null, subject = null }) {
  const notif = await notificationsModel.getNotificationById(id);
  if (!notif) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  return create({
    user_id: notif.user_id,
    booking_id: notif.booking_id,
    channel: notif.channel,
    message: notif.message,
    sendNow: true,
    to,
    subject,
  });
}

async function remove(id) {
  return notificationsModel.deleteNotification(id);
}

module.exports = {
  list,
  getById,
  create,
  resend,
  remove,
};