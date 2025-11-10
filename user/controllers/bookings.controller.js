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
    // Check if user is logged in (has token)
    const userId = me(req);
    
    // If user is logged in, create booking directly
    // If not logged in, booking will be created with user_id = null (guest booking)
    // User must verify OTP first, then booking will be assigned to user
    const { 
      attraction_id, 
      slot_id = null, 
      booking_date = null, 
      addons = [], 
      coupon_code = null, 
      payment_mode = 'Online'
    } = req.body || {};
    
    if (!attraction_id) return res.status(400).json({ error: 'attraction_id is required' });
    
    const booking = await bookingService.createBooking({
      user_id: userId, // null if guest, will be set after OTP verification
      attraction_id, 
      slot_id, 
      addons, 
      coupon_code, 
      payment_mode, 
      booking_date,
    });
    res.status(201).json(booking);
  } catch (err) { next(err); }
};

/**
 * Send OTP for booking (for guest users)
 * Creates user if not exists, sends OTP
 */
exports.sendBookingOtp = async (req, res, next) => {
  try {
    const { name, email, phone, channel = 'sms' } = req.body || {};
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'name, email, and phone are required' });
    }
    
    const authService = require('../../services/authService');
    // Create user if not exists, send OTP
    const out = await authService.sendOtp({ 
      email, 
      phone, 
      name, 
      channel, 
      createIfNotExists: true 
    });
    res.json(out);
  } catch (err) { next(err); }
};

/**
 * Verify OTP for booking and assign booking to user
 * Returns token and updates booking with user_id
 */
exports.verifyBookingOtp = async (req, res, next) => {
  try {
    const { booking_id, otp, email, phone } = req.body || {};
    if (!otp) return res.status(400).json({ error: 'otp is required' });
    if (!email && !phone) {
      return res.status(400).json({ error: 'email or phone is required' });
    }
    
    const authService = require('../../services/authService');
    // Verify OTP and get token (creates user if not exists via sendOtp flow)
    const verifyResult = await authService.verifyOtp({ otp, email, phone });
    
    // If booking_id provided, assign booking to user
    if (booking_id) {
      await bookingService.assignBookingToUser(booking_id, verifyResult.user.user_id);
    }
    
    res.json({
      verified: true,
      user: verifyResult.user,
      token: verifyResult.token,
      expires_at: verifyResult.expires_at,
      booking_assigned: !!booking_id
    });
  } catch (err) { next(err); }
};

exports.initiatePayPhiPayment = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized. Please verify OTP first.' });

    const id = Number(req.params.id);
    const b = await bookingsModel.getBookingById(id);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    
    // Ensure booking belongs to logged-in user (after OTP verification)
    if (b.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: This booking does not belong to you' });
    }

    // Get user info for payment
    const usersModel = require('../../models/users.model');
    const user = await usersModel.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Use user's email and phone, or allow override from body
    const { email, mobile } = (req.body && typeof req.body === 'object') ? req.body : {};
    const paymentEmail = email || user.email;
    const paymentMobile = mobile || user.phone;

    if (!paymentEmail || !paymentMobile) {
      return res.status(400).json({ 
        error: 'email and mobile are required for payment',
        hint: 'Please provide email and phone, or ensure your account has them set'
      });
    }

    const out = await bookingService.initiatePayPhiPayment(id, {
      email: paymentEmail,
      mobile: paymentMobile,
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