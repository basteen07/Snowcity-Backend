const express = require('express');
const logger = require('../config/logger');
const { createApiLog } = require('../models/apiLogs.model');

// Generic WhatsApp webhook (provider-agnostic).
// If you're using Twilio WhatsApp, prefer the twilio.webhook instead.
// This handler accepts either JSON or x-www-form-urlencoded.
module.exports = [
  (req, res, next) => {
    // Try JSON first; if no body, fall back to urlencoded
    if (req.is('application/json')) {
      return express.json()(req, res, next);
    }
    return express.urlencoded({ extended: false })(req, res, next);
  },
  async (req, res) => {
    try {
      const payload = req.body || {};
      await createApiLog({
        endpoint: 'webhook:whatsapp',
        payload,
        response_code: 200,
        status: 'success',
      });

      logger.info('WhatsApp webhook received', {
        from: payload.From || payload.from,
        to: payload.To || payload.to,
        body: (payload.Body || payload.body || '').slice(0, 120),
      });

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error('WhatsApp webhook error', { err: err.message });
      return res.status(200).json({ received: true });
    }
  },
];