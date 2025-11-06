const express = require('express');
const logger = require('../config/logger');
const { createApiLog } = require('../models/apiLogs.model');

// Twilio sends application/x-www-form-urlencoded by default
module.exports = [
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      // Example fields: From, To, Body, SmsStatus, etc.
      const payload = req.body || {};
      await createApiLog({
        endpoint: 'webhook:twilio',
        payload,
        response_code: 200,
        status: 'success',
      });

      logger.info('Twilio webhook received', { from: payload.From, to: payload.To, status: payload.SmsStatus });

      // Respond with simple TwiML to acknowledge
      res.set('Content-Type', 'text/xml');
      return res.send(`
        <Response>
          <Message>Thanks! We got your message.</Message>
        </Response>
      `.trim());
    } catch (err) {
      logger.error('Twilio webhook error', { err: err.message });
      res.set('Content-Type', 'text/xml');
      return res.send('<Response></Response>');
    }
  },
];