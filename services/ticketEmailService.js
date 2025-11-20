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

function formatMoney(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function buildItemsHtml(items = []) {
  if (!items.length) return '<em>No items found</em>';
  const rows = items.map((item) => {
    const title = item.item_title || (item.item_type === 'Combo' ? 'Combo Booking' : 'Attraction Ticket');
    const slot = item.slot_start_time && item.slot_end_time
      ? `${item.slot_start_time} - ${item.slot_end_time}`
      : item.booking_time || 'Open Slot';
    return `
      <tr>
        <td style="padding:6px 8px;border:1px solid #eee">${title}</td>
        <td style="padding:6px 8px;border:1px solid #eee">${item.booking_date || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #eee">${slot}</td>
        <td style="padding:6px 8px;border:1px solid #eee">${item.quantity || 1}</td>
        <td style="padding:6px 8px;border:1px solid #eee">${formatMoney(item.final_amount || item.total_amount)}</td>
      </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:10px">
      <thead>
        <tr style="background:#f4f4f4">
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left">Item</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left">Date</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left">Slot</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left">Qty</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
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

async function sendOrderEmail(order_id) {
  const order = await bookingsModel.getOrderWithDetails(order_id);
  if (!order) throw new Error('Order not found');

  const user = order.user_id ? await usersModel.getUserById(order.user_id) : null;
  const to = user?.email || null;
  if (!to) return { sent: false, skipped: true, reason: 'No user email' };

  const greetingName = user?.name ? ` ${user.name}` : '';
  const subject = `SnowCity Order ${order.order_ref || order.order_id}`;
  const plainItems = (order.items || []).map((item, idx) => {
    const title = item.item_title || `Item ${idx + 1}`;
    return `${idx + 1}. ${title} — Qty ${item.quantity || 1} — ${formatMoney(item.final_amount || item.total_amount)}`;
  }).join('\n');

  const text = `Hello${greetingName},\n\nThank you for your purchase at SnowCity.\nOrder Ref: ${order.order_ref || order.order_id}\nTotal Paid: ${formatMoney(order.final_amount || order.total_amount)}\n\nItems:\n${plainItems || '-'}\n\nYour ticket PDF is attached. Enjoy your visit!`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2 style="margin-bottom:0">Thank you for your order</h2>
      <p style="margin-top:4px;color:#555">Hello${greetingName},</p>
      <p>Your payment was successful. Order details are below:</p>
      <ul style="padding-left:18px;color:#333">
        <li><strong>Order Ref:</strong> ${order.order_ref || order.order_id}</li>
        <li><strong>Total Paid:</strong> ${formatMoney(order.final_amount || order.total_amount)}</li>
        <li><strong>Payment Status:</strong> ${order.payment_status || 'Completed'}</li>
      </ul>
      ${buildItemsHtml(order.items)}
      <p style="margin-top:18px">Your consolidated ticket PDF is attached. Please carry a valid ID and arrive 15 minutes early.</p>
      <p style="margin-top:12px">Warm regards,<br/>SnowCity Team</p>
    </div>`;

  const attachments = [];
  const pdfPaths = new Set();
  for (const item of order.items || []) {
    if (!item.ticket_pdf) continue;
    const abs = absoluteFromUrlPath(item.ticket_pdf);
    if (abs && !pdfPaths.has(abs)) {
      pdfPaths.add(abs);
      attachments.push({ filename: path.basename(abs), path: abs, contentType: 'application/pdf' });
    }
  }

  await email.send({ to, subject, text, html, attachments });
  return { sent: true, attachments: attachments.length };
}

module.exports = { sendTicketEmail, sendOrderEmail };
