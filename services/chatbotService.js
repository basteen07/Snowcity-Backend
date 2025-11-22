const llm = require('../config/llm');
const logger = require('../config/logger');

async function callChatCompletion({ history = [], message, temperature }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.LLM_TIMEOUT_MS || 25000));
  try {
    const resp = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: Number.isFinite(temperature) ? temperature : llm.temperature,
        messages: history,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      logger.error('LLM error', { status: resp.status, body: text });
      throw new Error('Chatbot is busy, try again later');
    }
    return resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  callChatCompletion,
};
