'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js'); // barcode
const dayjs = require('dayjs');

const { pool } = require('../config/db');
const bookingsModel = require('../models/bookings.model');
const attractionsModel = require('../models/attractions.model');
let combosModel = null;
try { combosModel = require('../models/combos.model'); } catch (_) {}
const addonsModel = require('../models/addons.model');

// ---------- Configurable assets ----------
const ASSET_DIR = path.resolve(__dirname, '../assets');
const TICKET_ASSETS = {
  frontBg: path.join(ASSET_DIR, 'ticket/front-bg.jpg'),
  backBg: path.join(ASSET_DIR, 'ticket/back-bg.jpg'),
  fonts: {
    regular: path.join(ASSET_DIR, 'fonts/Montserrat-Regular.ttf'),
    bold: path.join(ASSET_DIR, 'fonts/Montserrat-ExtraBold.ttf'),
  },
};

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }
const exists = (p) => { try { return p && fs.existsSync(p); } catch { return false; } };

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

// ---------- Small drawing helpers ----------
function registerFonts(doc) {
  const hasRegular = exists(TICKET_ASSETS.fonts.regular);
  const hasBold = exists(TICKET_ASSETS.fonts.bold);
  if (hasRegular) doc.registerFont('Regular', TICKET_ASSETS.fonts.regular);
  if (hasBold) doc.registerFont('Bold', TICKET_ASSETS.fonts.bold);

  // Fallbacks
  if (!hasRegular) doc.registerFont('Regular', 'Helvetica');
  if (!hasBold) doc.registerFont('Bold', 'Helvetica-Bold');
}

function roundedCardArea(doc, margin = 16, radius = 18) {
  const card = {
    x: margin,
    y: margin,
    w: doc.page.width - margin * 2,
    h: doc.page.height - margin * 2,
    r: radius,
  };
  return card;
}

function drawRoundedImage(doc, imgPath, x, y, w, h, r) {
  doc.save();
  doc.roundedRect(x, y, w, h, r).clip();
  if (exists(imgPath)) {
    // Will stretch to the card; looks fine for wallpapers
    doc.image(imgPath, x, y, { width: w, height: h });
  } else {
    // Soft gradient-ish background
    doc.rect(x, y, w, h).fill('#e8f3ff');
    doc.fillColor('#d7e8ff').circle(x + w - 120, y + 60, 120).fill();
    doc.fillColor('#f2f7ff').circle(x + 100, y + h - 80, 160).fill();
  }
  doc.restore();
}

function perforationLine(doc, x, y1, y2) {
  doc.save();
  doc.lineWidth(1).dash(4, { space: 4 }).strokeColor('#ffffffaa');
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
  doc.restore();
}

function textShadow(doc, drawFn) {
  // simple soft shadow
  doc.save();
  doc.fillColor('#00000055');
  doc.translate(1, 1);
  drawFn();
  doc.restore();
  drawFn();
}

async function drawBarcodePng(text, scale = 3, height = 20) {
  // returns PNG buffer
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: String(text || ''),
    scale,           // 2-4 looks good
    height,          // barcode bar height in mm-ish units (bwip-js' own)
    includetext: false,
    backgroundcolor: 'FFFFFF00', // transparent
  });
}

// ---------- Page rendering ----------
async function drawFrontPage(doc, ctx) {
  const { booking, title, slotText, qty, finalAmount, date, qrText } = ctx;

  registerFonts(doc);

  const card = roundedCardArea(doc, 16, 18);
  drawRoundedImage(doc, TICKET_ASSETS.frontBg, card.x, card.y, card.w, card.h, card.r);

  // Perforation guide near the right
  const perfX = card.x + card.w - 120;
  perforationLine(doc, perfX, card.y + 18, card.y + card.h - 18);

  // Overlay top-line text
  const pad = 24;
  const left = card.x + pad;
  const top = card.y + pad;

  // Header "Welcome to SnowCity"
  doc.font('Bold').fontSize(28).fillColor('#ffffff');
  textShadow(doc, () => doc.text('Welcome to SnowCity', left, top, { width: perfX - left - 12, align: 'left' }));

  // Item title
  doc.font('Bold').fontSize(20).fillColor('#ffffff');
  textShadow(doc, () => doc.text(title, left, top + 40, { width: perfX - left - 12 }));

  // Primary price banner (final amount)
  const priceY = top + 88;
  const priceText = money(finalAmount);
  doc.save();
  doc.roundedRect(left, priceY - 8, 240, 46, 8).fill('#ffffffcc');
  doc.restore();
  doc.fillColor('#d60000').font('Bold').fontSize(28).text(priceText, left + 12, priceY);

  // Bullet perks (optional)
  const infoY = priceY + 54;
  doc.font('Regular').fontSize(12).fillColor('#fff');
  const infoLines = [
    `Booking Ref: ${booking.booking_ref}`,
    `Date: ${date.format('YYYY-MM-DD')}`,
    `Slot: ${slotText}`,
    `Quantity: ${qty}`,
    `Payment: ${booking.payment_status}`,
  ];
  textShadow(doc, () => doc.text(infoLines.join('\n'), left, infoY, { width: perfX - left - 12, lineGap: 4 }));

  // Barcode area on the right (vertical like your mock)
  try {
    const barcode = await drawBarcodePng(booking.booking_ref, 3, 14);
    // Rotate -90 so it becomes vertical
    const bx = perfX + 18;
    const by = card.y + 40;
    doc.save();
    doc.rotate(-90, { origin: [bx + 70, by + 120] });
    doc.image(barcode, bx, by, { width: 140, height: 240 });
    doc.restore();
  } catch (_) {}

  // QR code under barcode
  try {
    const qrBuf = Buffer.from((await QRCode.toDataURL(qrText, { margin: 0, width: 180 })).split(',')[1], 'base64');
    doc.image(qrBuf, perfX + 16, card.y + card.h - 16 - 120, { width: 120, height: 120 });
  } catch (_) {}

  // Small footer
  doc.font('Regular').fontSize(10).fillColor('#ffffff');
  const foot = '* Offer valid on online purchases only • Please carry a valid photo ID';
  textShadow(doc, () => doc.text(foot, left, card.y + card.h - 26, { width: perfX - left - 12 }));
}

function bullets(doc, x, y, lines, opts = {}) {
  const lh = opts.lineHeight || 16;
  doc.font('Regular').fontSize(opts.fontSize || 12).fillColor(opts.color || '#222');
  let cy = y;
  for (const line of lines) {
    doc.circle(x, cy + 4, 2).fillColor(opts.bulletColor || '#111').fill();
    doc.fillColor(opts.color || '#222').text(line, x + 10, cy - 2, { width: 420 });
    cy += lh;
  }
  return cy;
}

async function drawBackPage(doc, ctx) {
  const { booking, title, slotText, qty, date, ticketsSubtotal, addons, addonsSubtotal, discount, finalAmount, supportPhone = '+91 12345 67890' } = ctx;

  registerFonts(doc);

  const card = roundedCardArea(doc, 16, 18);
  drawRoundedImage(doc, TICKET_ASSETS.backBg, card.x, card.y, card.w, card.h, card.r);

  const pad = 22;
  const left = card.x + pad;
  const right = card.x + card.w - pad;
  let y = card.y + pad;

  // Header
  doc.font('Bold').fontSize(26).fillColor('#ffffff');
  doc.save();
  doc.rect(left - 6, y - 4, 260, 36).fill('#00000055');
  doc.restore();
  doc.text('TERMS & CONDITIONS', left, y, { width: 260 });

  // Terms list
  y += 44;
  const terms = [
    'Non-refundable & non-transferable.',
    'Valid for one-time entry only.',
    'ID required at entry verification.',
    'Children must be accompanied by an adult.',
    'Management reserves the right to refuse admission.',
    'No outside food or drinks allowed.',
    `Valid only on ${date.format('YYYY-MM-DD')} for the selected slot.`,
  ];
  y = bullets(doc, left, y, terms, { fontSize: 12, lineHeight: 18, color: '#111', bulletColor: '#111' });

  // A small divider
  y += 12;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor('#ffffffaa').stroke();
  y += 14;

  // Booking summary (title/date/slot/qty)
  doc.font('Bold').fontSize(14).fillColor('#111').text('Booking Summary', left, y);
  y += 18;
  doc.font('Regular').fontSize(12).fillColor('#111');
  doc.text(`Item: ${title}`, left, y, { width: 420 });
  y += 16;
  doc.text(`Date: ${date.format('YYYY-MM-DD')}  •  Slot: ${slotText}  •  Qty: ${qty}`, left, y);
  y += 18;
  doc.text(`Booking Ref: ${booking.booking_ref}`, left, y);
  y += 24;

  // Billing box
  const boxW = 330;
  const boxH = 130 + Math.max(0, (addons?.length || 0) * 16);
  const boxX = right - boxW;
  const boxY = card.y + pad + 6;

  // box background
  doc.save();
  doc.roundedRect(boxX, boxY, boxW, boxH, 10).fill('#ffffffcc');
  doc.restore();

  let by = boxY + 12;
  const bx = boxX + 12;

  // Amount Summary
  doc.font('Bold').fontSize(14).fillColor('#0b3d91').text('Amount Summary', bx, by);
  by += 20;
  doc.font('Regular').fontSize(12).fillColor('#111');
  const line = (label, val, bold = false) => {
    doc.font(bold ? 'Bold' : 'Regular')
      .text(label, bx, by, { width: boxW - 140 })
      .text(val, boxX + boxW - 12 - 100, by, { width: 100, align: 'right' });
    by += 16;
  };
  line('Tickets', money(ticketsSubtotal));
  line('Add-ons', money(addonsSubtotal));
  line('Discount', `- ${money(discount)}`);
  doc.moveTo(bx, by + 4).lineTo(boxX + boxW - 12, by + 4).strokeColor('#999').lineWidth(0.6).stroke();
  by += 12;
  line('Total', money(finalAmount), true);
  by += 6;

  // Add-ons detail
  if (addons?.length) {
    doc.font('Bold').fontSize(12).fillColor('#0b3d91').text('Add-ons', bx, by);
    by += 16;
    doc.font('Regular').fontSize(11).fillColor('#111');
    for (const a of addons) {
      doc.text(`${a.name} × ${a.quantity}`, bx, by, { width: boxW - 140 })
        .text(money(a.line_total), boxX + boxW - 12 - 100, by, { width: 100, align: 'right' });
      by += 14;
    }
  }

  // Footer: support/contact
  const foot = `www. Customer Service: ${supportPhone}`;
  doc.font('Regular').fontSize(11).fillColor('#111')
    .text(foot, left, card.y + card.h - pad - 16, { width: card.w - pad * 2, align: 'right' });
}

// ---------- Main ----------
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

  // PDF generation — 2 pages (front/back)
  const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 0 });
  const writeStream = fs.createWriteStream(absPath);
  const done = new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  doc.pipe(writeStream);

  const qrText = `SC|${booking.booking_ref}|${booking.booking_id}`;

  // FRONT
  await drawFrontPage(doc, {
    booking,
    title,
    slotText,
    qty,
    finalAmount,
    date,
    qrText,
  });

  // BACK
  doc.addPage({ size: 'A5', layout: 'landscape', margin: 0 });
  await drawBackPage(doc, {
    booking,
    title,
    slotText,
    qty,
    date,
    ticketsSubtotal,
    addons,
    addonsSubtotal,
    discount,
    finalAmount,
    supportPhone: '+91 12345 67890',
  });

  doc.end();
  await done;

  return urlPath;
}

module.exports = {
  generateTicket,
};