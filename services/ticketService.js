'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const dayjs = require('dayjs');

const { pool } = require('../config/db');
const bookingsModel = require('../models/bookings.model');
const attractionsModel = require('../models/attractions.model');
let combosModel = null;
try { combosModel = require('../models/combos.model'); } catch (_) {}
const addonsModel = require('../models/addons.model');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

// Extract HH:mm from time-like strings (handles "09:37:45.119" etc.)
function hhmm(s) {
  if (!s) return null;
  const str = String(s);
  const m = str.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = String(m[1]).padStart(2, '0');
  const mm = m[2];
  return `${hh}:${mm}`;
}

function slotTextFromBooking(b) {
  // Prefer normalized fields from bookings.model joins
  const start = hhmm(b?.slot_start_time || b?.attr_slot_start_time || b?.combo_slot_start_time);
  const end = hhmm(b?.slot_end_time || b?.attr_slot_end_time || b?.combo_slot_end_time);
  const label = b?.slot_label || b?.attr_slot_label || b?.combo_slot_label || null;

  if (start || end) return `${start || ''}${start && end ? ' - ' : ''}${end || ''}`.trim();
  if (label) return String(label);
  const fallback = hhmm(b?.booking_time);
  return fallback || '—';
}

async function fetchBookingAddons(booking_id) {
  // Snapshot table (unit price stored)
  const { rows } = await pool.query(
    `SELECT addon_id, quantity, price
     FROM booking_addons
     WHERE booking_id = $1
     ORDER BY addon_id ASC`,
    [booking_id]
  );

  const out = [];
  for (const r of rows) {
    let name = `Addon #${r.addon_id}`;
    try {
      const a = await addonsModel.getAddonById(r.addon_id);
      if (a) name = a.title || a.name || a.label || name;
    } catch (_) {}
    const qty = Number(r.quantity || 0);
    const unit = Number(r.price || 0);
    out.push({
      addon_id: r.addon_id,
      name,
      quantity: qty,
      unit_price: unit,
      line_total: unit * qty
    });
  }
  return out;
}

async function resolveItemTitle(booking) {
  if (booking?.item_title) return booking.item_title;

  // Legacy fallback
  if (booking?.attraction_id) {
    try {
      const a = await attractionsModel.getAttractionById(booking.attraction_id);
      if (a) return a.title || a.name || `Attraction #${booking.attraction_id}`;
    } catch (_) {}
  }
  if (booking?.combo_id && combosModel) {
    try {
      const c = await combosModel.getComboById(booking.combo_id);
      if (c) {
        return (
          c.title ||
          c.name ||
          c.combo_name ||
          (Array.isArray(c.attractions) && c.attractions.map(x => x?.name || x?.title).filter(Boolean).join(' + ')) ||
          `Combo #${booking.combo_id}`
        );
      }
    } catch (_) {}
  }
  return 'Attraction';
}

async function generateTicket(booking_id) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) throw new Error('Booking not found');

  // Compute display fields
  const title = await resolveItemTitle(booking);
  const slotText = slotTextFromBooking(booking);
  const qty = Number(booking.quantity || 1);

  // Add-ons and amounts
  const addons = await fetchBookingAddons(booking.booking_id);
  const addonsSubtotal = addons.reduce((sum, a) => sum + a.line_total, 0);
  const totalAmount = Number(booking.total_amount || 0);   // tickets + addons before discount
  const discount = Number(booking.discount_amount || 0);
  const ticketsSubtotal = Math.max(0, totalAmount - addonsSubtotal);
  const finalAmount = Number(booking.final_amount || 0);

  // FS paths
  const date = dayjs(booking.booking_date || new Date());
  const dirParts = ['uploads', 'tickets', date.format('YYYY'), date.format('MM'), date.format('DD')];
  const baseDir = path.resolve(__dirname, '..', ...dirParts);
  await ensureDir(baseDir);

  const filename = `TICKET_${booking.booking_ref}.pdf`;
  const absPath = path.join(baseDir, filename);
  const urlPath = path.posix.join('/', ...dirParts, filename).replace(/\\/g, '/');

  // PDF generation
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const writeStream = fs.createWriteStream(absPath);
  const done = new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  doc.pipe(writeStream);

  // Header
  doc.fontSize(22).text('SnowCity Entry Ticket', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#666').text('Please carry a valid ID. QR must be scannable.', { align: 'center' });
  doc.moveDown(1.0);
  doc.fillColor('#000');

  // Booking summary
  doc.fontSize(12);
  doc.text(`Booking Ref: ${booking.booking_ref}`);
  doc.text(`Item: ${title} (${booking.item_type || (booking.combo_id ? 'Combo' : 'Attraction')})`);
  doc.text(`Date: ${date.format('YYYY-MM-DD')}`);
  doc.text(`Slot: ${slotText}`);
  doc.text(`Quantity: ${qty}`);
  doc.text(`Payment Status: ${booking.payment_status}`);
  if (booking.booking_status) doc.text(`Booking Status: ${booking.booking_status}`);
  doc.moveDown();

  // Amount summary
  doc.fontSize(13).text('Amount Summary', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(12);
  doc.text(`Tickets: ${money(ticketsSubtotal)}`);
  doc.text(`Add-ons: ${money(addonsSubtotal)}`);
  doc.text(`Discount: - ${money(discount)}`);
  doc.text(`Total: ${money(finalAmount)}`);
  doc.moveDown();

  // Add-ons detail
  if (addons.length) {
    doc.fontSize(13).text('Add-ons', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(12);
    addons.forEach((a) => {
      doc.text(`${a.name} × ${a.quantity} — ${money(a.line_total)} (₹${a.unit_price.toFixed(2)} each)`);
    });
    doc.moveDown();
  }

  // QR Code
  doc.moveDown(0.5);
  const qrText = `SC|${booking.booking_ref}|${booking.booking_id}`;
  try {
    const dataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 200 });
    const base64 = dataUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    doc.image(buf, { fit: [150, 150], align: 'left' });
  } catch (_) {
    // ignore QR rendering errors
  }

  doc.moveDown(2);
  doc.fontSize(10).fillColor('#666').text(
    'Valid only for the selected date and slot. Late arrivals may not be accommodated. Terms and conditions apply.',
    { align: 'left' }
  );

  doc.end();
  await done;

  return urlPath;
}

module.exports = {
  generateTicket,
};