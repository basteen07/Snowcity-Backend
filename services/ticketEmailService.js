const path = require('path');
const email = require('./emailService');
const bookingsModel = require('../models/bookings.model');
const usersModel = require('../models/users.model');

function absoluteFromUrlPath(urlPath) {
  // urlPath like /uploads/tickets/YYYY/MM/DD/FILENAME.pdf
  // files are stored at backend/uploads/... relative to __dirname/.. per ticketService
  if (!urlPath) return null;
  const rel = urlPath.replace(/^\/*/, '');
  return path.resolve(__dirname, '..', rel);
}

async function sendTicketEmail(booking_id) {
  const b = await bookingsModel.getBookingById(booking_id);
  if (!b) throw new Error('Booking not found');
  if (b.email_sent) return { sent: true, skipped: true };

  const user = b.user_id ? await usersModel.getUserById(b.user_id) : null;
  const to = user?.email || null;
  if (!to) return { sent: false, skipped: true, reason: 'No user email' };

  const subject = `Your SnowCity Ticket — ${b.booking_ref}`;
  const text = `Hello${user?.name ? ' ' + user.name : ''},\n\nAttached is your SnowCity ticket.\nBooking Ref: ${b.booking_ref}\nAttraction ID: ${b.attraction_id}\nQuantity: ${b.quantity}\nAmount Paid: ${Number(b.final_amount || 0).toFixed(2)}\n\nEnjoy your visit!`;
  const html = `
    <div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;line-height:1.5">
      <h2>SnowCity Ticket</h2>
      <p>Hello${user?.name ? ' ' + user.name : ''},</p>
      <p>Attached is your SnowCity ticket.</p>
      <ul>
        <li><strong>Booking Ref:</strong> ${b.booking_ref}</li>
        <li><strong>Attraction ID:</strong> ${b.attraction_id}</li>
        <li><strong>Quantity:</strong> ${b.quantity}</li>
        <li><strong>Amount Paid:</strong> ₹${Number(b.final_amount || 0).toFixed(2)}</li>
      </ul>
      <p>Enjoy your visit!</p>
    </div>
  `;

  const attachments = [];
  if (b.ticket_pdf) {
    const abs = absoluteFromUrlPath(b.ticket_pdf);
    attachments.push({ filename: path.basename(abs), path: abs, contentType: 'application/pdf' });
  }

  await email.send({ to, subject, text, html, attachments });
  await bookingsModel.updateBooking(booking_id, { email_sent: true });
  return { sent: true };
}

module.exports = { sendTicketEmail };
