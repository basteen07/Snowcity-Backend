module.exports = {
  APP_NAME: 'SnowCity',
  DEFAULT_TIMEZONE: 'UTC',

  // Pagination
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,

  // OTP and security
  OTP_LENGTH: 6,
  OTP_TTL_MINUTES: 10,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Uploads
  MAX_UPLOAD_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  IMAGE_MIME_TYPES: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),

  // Bookings
  BOOKING_REF_PREFIX: 'SC',

  // Roles
  ROLES: {
    ADMIN: 'admin',
    SUBADMIN: 'subadmin',
    USER: 'user',
  },

  // Currencies
  DEFAULT_CURRENCY: 'INR',
};