const otpGenerator = require('otp-generator');
const { OTP_LENGTH, OTP_TTL_MINUTES } = require('./constants');

function generate(length = OTP_LENGTH) {
  return otpGenerator.generate(length, {
    digits: true,
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
}

function expiryDate(ttlMinutes = OTP_TTL_MINUTES) {
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

module.exports = {
  generate,
  expiryDate,
};