const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const dayjs = require('dayjs');

const bookingsModel = require('../models/bookings.model');
const attractionsModel = require('../models/attractions.model');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function generateTicket(booking_id) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) throw new Error('Booking not found');
  const attraction = await attractionsModel.getAttractionById(booking.attraction_id);

  const date = dayjs(booking.booking_date || new Date());
  const dirParts = [
    'uploads',
    'tickets',
    date.utc ? date.utc().format('YYYY') : date.format('YYYY'),
    date.utc ? date.utc().format('MM') : date.format('MM'),
    date.utc ? date.utc().format('DD') : date.format('DD'),
  ];
  const baseDir = path.resolve(__dirname, '..', ...dirParts);
  await ensureDir(baseDir);

  const filename = `TICKET_${booking.booking_ref}.pdf`;
  const absPath = path.join(baseDir, filename);
  const urlPath = path.posix.join('/', ...dirParts, filename).replace(/\\/g, '/');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const writeStream = fs.createWriteStream(absPath);

  const done = new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  doc.pipe(writeStream);

  // Header
  doc.fontSize(22).text('SnowCity Entry Ticket', { align: 'center' });
  doc.moveDown();

  // Booking details
  doc.fontSize(12);
  doc.text(`Booking Ref: ${booking.booking_ref}`);
  doc.text(`Attraction: ${attraction?.title || booking.attraction_id}`);
  doc.text(`Date: ${date.format('YYYY-MM-DD')}`);
  if (booking.booking_time) doc.text(`Time: ${String(booking.booking_time).slice(0,5)}`);
  doc.text(`Quantity: ${booking.quantity || 1}`);
  doc.text(`Amount Paid: ${Number(booking.final_amount || 0).toFixed(2)}`);
  doc.text(`Status: ${booking.payment_status}`);
  doc.moveDown();

  // QR Code
  const qrText = `SC|${booking.booking_ref}|${booking.booking_id}`;
  const dataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 200 });
  const base64 = dataUrl.split(',')[1];
  const buf = Buffer.from(base64, 'base64');
  try {
    doc.image(buf, { fit: [150, 150], align: 'left' });
  } catch (e) {
    // ignore image error
  }

  doc.moveDown(2);
  doc.fontSize(10).text('Show this ticket at entry. QR must be scannable. Valid government ID may be required.', {
    align: 'left',
  });

  doc.end();
  await done;

  return urlPath;
}

module.exports = {
  generateTicket,
};
