const express = require('express');
const router = express.Router();
const { createLimiter } = require('../middlewares/rateLimiter');
const chatbotController = require('../controllers/chatbot.controller');

const chatbotLimiter = createLimiter({
  windowMs: Number(process.env.CHATBOT_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.CHATBOT_RATE_LIMIT_MAX || 25),
  message: { error: 'Chatbot is busy, please retry in a moment.' },
});

router.post('/', chatbotLimiter, chatbotController.handleChat);

module.exports = router;
