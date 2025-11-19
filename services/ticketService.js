'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const dayjs = require('dayjs');

const { pool } = require('../config/db');

// ---------- Configuration ----------
const ASSET_DIR = path.resolve(__dirname, '../utils');
// Make sure you have these images, or the code falls back to colors
const TICKET_BG = path.join(ASSET_DIR, 'ticket/ticket-bg.png'); 
const LOGO_PATH = path.join(ASSET_DIR, 'logo.png'); 

// Wonderla-style vibrant colors
const COLORS = {
  primary: '#0056D2',    // Deep Blue
  secondary: '#00A8E8',  // Cyan
  accent: '#FFC107',     // Amber/Yellow
  text: '#333333',
  lightText: '#666666',
  white: '#FFFFFF',
  border: '#DDDDDD'
};

// Helpers
async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); }
const exists = (p) => { try { return p && fs.existsSync(p); } catch { return false; } };
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => dayjs(d).format('DD MMM, YYYY');

// Helper: Format time '14:30:00' -> '2:30 PM'
function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  if (!h || !m) return '';
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// Helper: Get Slot String
function getSlotDisplay(row) {
  const start = formatTime(row.slot_start_time || row.start_time);
  const end = formatTime(row.slot_end_time || row.end_time);
  if (start && end) return `${start} - ${end}`;
  if (row.slot_label) return row.slot_label;
  return formatTime(row.booking_time) || 'Open Entry';
}

// ---------- Data Fetching (Order-Centric) ----------

async function getFullOrderData(bookingId) {
  // 1. Find the Order ID for this booking
  const orderRes = await pool.query(
    `SELECT order_id, user_id FROM bookings WHERE booking_id = $1`, 
    [bookingId]
  );
  
  if (!orderRes.rows.length) return null;
  const orderId = orderRes.rows[0].order_id;

  // 2. Fetch Order Details
  const orderDetailsRes = await pool.query(
    `SELECT order_ref, final_amount, created_at FROM orders WHERE order_id = $1`,
    [orderId]
  );
  const orderData = orderDetailsRes.rows[0];

  // 3. Fetch ALL Items in this Order (Combos + Attractions)
  // We perform joins to get titles correctly regardless of item_type
  const itemsRes = await pool.query(
    `SELECT 
       b.booking_id, b.booking_ref, b.quantity, b.booking_date, b.final_amount,
       b.item_type,
       
       -- Title Logic: Prefer Combo Title if Combo, else Attraction Title
       COALESCE(
         c.title, c.name, 
         a.title, 
         'Entry Ticket'
       ) as item_title,

       -- Slot Logic
       s.start_time, s.end_time, s.label as slot_label,
       b.booking_time

     FROM bookings b
     LEFT JOIN attractions a ON b.attraction_id = a.attraction_id
     LEFT JOIN combos c ON b.combo_id = c.combo_id
     LEFT JOIN attraction_slots s ON b.slot_id = s.slot_id
     WHERE b.order_id = $1
     ORDER BY b.booking_id ASC`,
    [orderId]
  );

  return {
    orderId,
    orderRef: orderData.order_ref,
    totalAmount: orderData.final_amount,
    orderDate: orderData.created_at,
    items: itemsRes.rows
  };
}

// ---------- Drawing Logic ----------

async function drawConsolidatedTicket(doc, data) {
  const { orderRef, items, totalAmount } = data;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 20;

  // 1. Background / Branding
  if (exists(TICKET_BG)) {
    doc.image(TICKET_BG, 0, 0, { width: pageWidth, height: pageHeight });
  } else {
    // Header Strip
    doc.rect(0, 0, pageWidth, 90).fill(COLORS.primary);
    // Footer Strip
    doc.rect(0, pageHeight - 40, pageWidth, 40).fill(COLORS.secondary);
  }

  // Logo
  if (exists(LOGO_PATH)) {
    doc.image(LOGO_PATH, margin + 10, 15, { width: 80 });
  } else {
    doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white)
       .text('SNOW CITY', margin + 20, 35);
  }

  // Header Info
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white)
     .text('ORDER RECEIPT & E-TICKET', 0, 25, { align: 'right', width: pageWidth - margin });
  
  doc.font('Helvetica').fontSize(10).fillColor('#E0E0E0')
     .text(`Ref: ${orderRef}`, 0, 45, { align: 'right', width: pageWidth - margin });

  // 2. Item List Container
  let yPos = 110;
  
  doc.fillColor(COLORS.text);
  doc.font('Helvetica-Bold').fontSize(14).text('YOUR BOOKINGS', margin + 10, yPos);
  doc.rect(margin + 10, yPos + 18, pageWidth - (margin*2) - 20, 2).fill(COLORS.accent);
  
  yPos += 35;

  // 3. Iterate Items
  doc.font('Helvetica').fontSize(10);
  
  items.forEach((item, index) => {
    // Check for page overflow (simple check)
    if (yPos > pageHeight - 150) {
      doc.addPage(); // New page if list is huge
      yPos = 50;
    }

    const slotStr = getSlotDisplay(item);
    const dateStr = fmtDate(item.booking_date);
    const itemTitle = item.item_title.toUpperCase();
    const typeLabel = item.item_type === 'Combo' ? ' [COMBO PACKAGE]' : '';

    // Item Box Background
    doc.save();
    doc.roundedRect(margin + 10, yPos, pageWidth - (margin*2) - 150, 55, 5)
       .fillAndStroke('#F9F9F9', '#EEEEEE');
    doc.restore();

    // Item Text
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(12)
       .text(`${index + 1}. ${itemTitle}${typeLabel}`, margin + 20, yPos + 10);

    doc.fillColor(COLORS.lightText).font('Helvetica').fontSize(10)
       .text(`Date: ${dateStr}   |   Slot: ${slotStr}`, margin + 20, yPos + 30);
    
    // Qty Badge
    doc.save();
    doc.circle(pageWidth - 180, yPos + 27, 18).fill(COLORS.accent);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
       .text(item.quantity, pageWidth - 195, yPos + 22, { width: 30, align: 'center' });
    doc.fontSize(7).text('PAX', pageWidth - 195, yPos + 33, { width: 30, align: 'center' });
    doc.restore();

    yPos += 65; // Move down for next item
  });

  // 4. QR Code Area (Right Side)
  const qrSize = 110;
  const qrX = pageWidth - margin - qrSize - 10;
  const qrY = 110;

  // Border
  doc.save();
  doc.roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 30, 5).strokeColor(COLORS.border).stroke();
  doc.restore();

  // QR Generation (Encodes Order Ref)
  try {
    const qrString = JSON.stringify({ type: 'ORDER', ref: orderRef, count: items.length });
    const qrBuf = Buffer.from(
      (await QRCode.toDataURL(qrString, { margin: 0, width: qrSize, color: { dark: COLORS.primary } })).split(',')[1],
      'base64'
    );
    doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
  } catch (e) {}

  doc.fontSize(8).fillColor(COLORS.lightText)
     .text('Scan for Entry', qrX, qrY + qrSize + 5, { width: qrSize, align: 'center' });

  // 5. Totals & Footer
  const bottomY = pageHeight - 80;
  
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.primary)
     .text(`TOTAL PAID: ${money(totalAmount)}`, margin + 20, bottomY - 20);

  doc.fontSize(8).fillColor('#888')
     .text('Non-refundable. Valid only for the date/slot specified.', margin + 20, bottomY + 10);
  doc.text('www.snowcity.com | +91-9876543210', margin + 20, bottomY + 22);
}

// ---------- MAIN FUNCTION ----------

async function generateTicket(booking_id) {
  // 1. Get Complete Order Data (Consolidated)
  const data = await getFullOrderData(booking_id);
  if (!data) throw new Error('Order/Booking not found');

  // 2. Prepare Storage Path
  // We use the Order Date for folder structure
  const date = dayjs(data.orderDate);
  const relativeDir = `/uploads/tickets/${date.format('YYYY')}/${date.format('MM')}/${date.format('DD')}`;
  const storageDir = path.join(__dirname, '..', relativeDir);
  
  await ensureDir(storageDir);

  // Filename based on Order Ref
  const filename = `ORDER_${data.orderRef}.pdf`;
  const absPath = path.join(storageDir, filename);
  const webPath = path.posix.join(relativeDir, filename);

  // 3. Generate PDF
  const doc = new PDFDocument({ 
    size: [650, 400], // Custom Wide Ticket Size
    margin: 0,
    autoFirstPage: true
  });

  const stream = fs.createWriteStream(absPath);
  doc.pipe(stream);

  await drawConsolidatedTicket(doc, data);

  doc.end();
  
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // 4. Update DB: Link this PDF to ALL bookings in the order
  // This ensures whether the user clicks "Download" on Item A or Item B, they get the same full receipt.
  await pool.query(
    `UPDATE bookings SET ticket_pdf = $1, updated_at = NOW() WHERE order_id = $2`,
    [webPath, data.orderId]
  );

  return webPath;
}

module.exports = { generateTicket };