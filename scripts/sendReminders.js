#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('../config/db');
const logger = require('../config/logger');
const { sendMail } = require('../config/mailer');
const { sendWhatsApp } = require('../config/twilio');

function getArg(name, def = null) {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const val = process.argv[idx].includes('=')
    ? process.argv[idx].split('=').slice(1).join('=')
    : process.argv[idx + 1];
  return val ?? def;
}

function fmtTime(t) {
  return String(t).slice(0, 5); // HH:MM
}

function buildEmailTemplate({ name, title, date, start, end, bookingRef }) {
  return {
    subject: `Reminder: ${title} at ${start} on ${date}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5;">
        <p>Hi ${name || 'Guest'},</p>
        <p>This is a friendly reminder for your upcoming SnowCity booking.</p>
        <ul>
          <li><strong>Attraction:</strong> ${title}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${start} - ${end}</li>
          <li><strong>Booking Ref:</strong> ${bookingRef}</li>
        </ul>
        <p>Please arrive at least 10 minutes before your slot time with a valid ID.</p>
        <p>See you soon! ❄️</p>
      </div>
    `,
  };
}

function buildWhatsAppMessage({ name, title, date, start, end, bookingRef }) {
  return `Hi ${name || 'Guest'}, your SnowCity booking reminder:
- Attraction: ${title}
- Date: ${date}
- Time: ${start} - ${end}
- Ref: ${bookingRef}
Please arrive 10 mins early. Enjoy! ❄️`;
}

async function fetchUpcomingBookings(aheadMins = 120, limit = 200) {
  const sql = `
    SELECT
      b.booking_id, b.booking_ref, b.user_id, b.booking_date,
      u.name, u.email, u.phone,
      a.title,
      s.start_time, s.end_time
    FROM bookings b
    JOIN users u ON u.user_id = b.user_id
    JOIN attractions a ON a.attraction_id = b.attraction_id
    JOIN attraction_slots s ON s.slot_id = b.slot_id
    WHERE b.booking_status = 'Booked'
      AND b.slot_id IS NOT NULL
      AND (b.booking_date + s.start_time)
          BETWEEN NOW() AND NOW() + make_interval(mins => $1::int)
    ORDER BY (b.booking_date + s.start_time) ASC
    LIMIT $2
  `;
  const { rows } = await pool.query(sql, [aheadMins, limit]);
  return rows;
}

async function markNotification(booking_id, user_id, channel, status, message) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (booking_id, user_id, channel, status, message, sent_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END)
     RETURNING *`,
    [booking_id, user_id, channel, status, message]
  );
  return rows[0];
}

async function main() {
  let sentEmail = 0;
  let sentWa = 0;
  let failed = 0;

  try {
    const ahead = parseInt(getArg('ahead', '120'), 10); // minutes
    const limit = parseInt(getArg('limit', '200'), 10);

    const bookings = await fetchUpcomingBookings(Number.isFinite(ahead) ? ahead : 120, limit);
    if (!bookings.length) {
      logger.info(`sendReminders: No upcoming bookings in next ${ahead} minutes.`);
      return;
    }

    logger.info(`sendReminders: Processing ${bookings.length} upcoming booking(s)...`);

    for (const b of bookings) {
      const date = String(b.booking_date);
      const start = fmtTime(b.start_time);
      const end = fmtTime(b.end_time);

      // Email
      if (b.email) {
        try {
          const { subject, html } = buildEmailTemplate({
            name: b.name,
            title: b.title,
            date,
            start,
            end,
            bookingRef: b.booking_ref,
          });
          await sendMail({ to: b.email, subject, html, text: html.replace(/<[^>]+>/g, '') });
          await markNotification(b.booking_id, b.user_id, 'email', 'sent', `Reminder: ${b.title} ${date} ${start}-${end}`);
          sentEmail += 1;
        } catch (e) {
          await markNotification(
            b.booking_id,
            b.user_id,
            'email',
            'failed',
            `Reminder failed: ${e.message || 'unknown error'}`
          );
          failed += 1;
          logger.warn('Reminder email failed', { booking_id: b.booking_id, to: b.email, err: e.message });
        }
      }

      // WhatsApp
      if (b.phone) {
        const body = buildWhatsAppMessage({
          name: b.name,
          title: b.title,
          date,
          start,
          end,
          bookingRef: b.booking_ref,
        });
        try {
          await sendWhatsApp({ to: b.phone, body });
          await markNotification(b.booking_id, b.user_id, 'whatsapp', 'sent', body);
          sentWa += 1;
        } catch (e) {
          await markNotification(b.booking_id, b.user_id, 'whatsapp', 'failed', `Reminder failed: ${e.message || 'unknown'}`);
          failed += 1;
          logger.warn('Reminder WhatsApp failed', { booking_id: b.booking_id, to: b.phone, err: e.message });
        }
      }
    }

    logger.info(`sendReminders: done. email=${sentEmail}, whatsapp=${sentWa}, failed=${failed}`);
  } catch (err) {
    logger.error('sendReminders crashed', { err: err.message, stack: err.stack });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}