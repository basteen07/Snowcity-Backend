// Keep in sync with PostgreSQL enum definitions in migrations
const PaymentStatus = Object.freeze({
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
});

const PaymentMode = Object.freeze({
  ONLINE: 'Online',
  OFFLINE: 'Offline',
});

const BookingStatus = Object.freeze({
  BOOKED: 'Booked',
  REDEEMED: 'Redeemed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
});

const NotificationChannel = Object.freeze({
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
});

const NotificationStatus = Object.freeze({
  SENT: 'sent',
  FAILED: 'failed',
  PENDING: 'pending',
});

const OfferRuleType = Object.freeze({
  HOLIDAY: 'holiday',
  HAPPY_HOUR: 'happy_hour',
  WEEKDAY_SPECIAL: 'weekday_special',
});

const CouponType = Object.freeze({
  FLAT: 'flat',
  PERCENT: 'percent',
  BOGO: 'bogo',
  SPECIFIC: 'specific',
});

module.exports = {
  PaymentStatus,
  PaymentMode,
  BookingStatus,
  NotificationChannel,
  NotificationStatus,
  OfferRuleType,
  CouponType,
};