const rateLimit = require('express-rate-limit');
// Use the built-in IPv6-safe key generator
const { ipKeyGenerator } = require('express-rate-limit');

const windowMsDefault = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000); // 1 min
const maxDefault = Number(process.env.RATE_LIMIT_MAX || 100);

function createLimiter({
  windowMs = windowMsDefault,
  max = maxDefault,
  message,
  keyGenerator, // optional override
} = {}) {
  return rateLimit({
    windowMs,
    max,
    legacyHeaders: false,
    standardHeaders: true,
    // IMPORTANT: Use ipKeyGenerator to avoid ERR_ERL_KEY_GEN_IPV6
    keyGenerator: keyGenerator || ipKeyGenerator,
    message:
      message ||
      {
        error: 'Too many requests, please try again later.',
      },
  });
}

const defaultLimiter = createLimiter({});

const authLimiter = createLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60_000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  message: { error: 'Too many auth attempts. Please try again later.' },
});

const otpLimiter = createLimiter({
  windowMs: Number(process.env.OTP_RATE_LIMIT_WINDOW_MS || 10 * 60_000),
  max: Number(process.env.OTP_RATE_LIMIT_MAX || 10),
  message: { error: 'Too many OTP requests. Please wait before retrying.' },
});

const paymentLimiter = createLimiter({
  windowMs: Number(process.env.PAYMENT_RATE_LIMIT_WINDOW_MS || 15 * 60_000),
  max: Number(process.env.PAYMENT_RATE_LIMIT_MAX || 60),
  message: { error: 'Too many payment attempts. Please try again later.' },
});

module.exports = {
  createLimiter,
  defaultLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
};