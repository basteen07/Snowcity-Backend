const bookingsModel = require('../../models/bookings.model');
const bookingService = require('../../services/bookingService');

const me = (req) => req.user?.id || null;

exports.listMyBookings = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await bookingsModel.listBookings({ user_id: userId, limit: 50, offset: 0 });
    res.json({ data, meta: { count: data.length } });
  } catch (err) { next(err); }
};

exports.getMyBookingById = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = Number(req.params.id);
    const row = await bookingsModel.getBookingById(id);
    if (!row || row.user_id !== userId) return res.status(404).json({ error: 'Booking not found' });
    res.json(row);
  } catch (err) { next(err); }
};

exports.createBooking = async (req, res, next) => {
  try {
    const userId = me(req);
    const { attraction_id, slot_id = null, booking_date = null, addons = [], coupon_code = null, payment_mode = 'Online' } = req.body || {};
    if (!attraction_id) return res.status(400).json({ error: 'attraction_id is required' });
    const booking = await bookingService.createBooking({
      user_id: userId, attraction_id, slot_id, addons, coupon_code, payment_mode, booking_date,
    });
    res.status(201).json(booking);
  } catch (err) { next(err); }
};

exports.initiatePayPhiPayment = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = Number(req.params.id);
    const b = await bookingsModel.getBookingById(id);
    if (!b || b.user_id !== userId) return res.status(404).json({ error: 'Booking not found' });

    const { email, mobile } = (req.body && typeof req.body === 'object') ? req.body : {};
    if (!email || !mobile) return res.status(400).json({ error: 'email and mobile are required' });

    const out = await bookingService.initiatePayPhiPayment(id, {
      email,
      mobile,
      addlParam1: String(id),
      addlParam2: 'SnowCity',
    });
    res.json(out);
  } catch (err) { next(err); }
};

exports.checkPayPhiStatus = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = Number(req.params.id);
    const b = await bookingsModel.getBookingById(id);
    if (!b || b.user_id !== userId) return res.status(404).json({ error: 'Booking not found' });

    const out = await bookingService.checkPayPhiStatus(id);
    res.json(out);
  } catch (err) { next(err); }
};