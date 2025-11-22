const llm = require('../config/llm');
const logger = require('../config/logger');
const { callGeminiChat, callOpenAIChat, callPerplexityChat } = require('../services/llmClient');

const fetchCompat = (...args) => {
  if (typeof fetch === 'function') {
    return fetch(...args);
  }
  return import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
};

function sanitizeMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((msg) => {
      const role = (msg?.role || '').toLowerCase();
      const content = (msg?.content || '').toString().trim();
      if (!content) return null;
      if (!['user', 'assistant', 'system'].includes(role)) return null;
      return { role, content };
    })
    .filter(Boolean)
    .slice(-12); // keep recent context only
}

exports.handleChat = async (req, res, next) => {
  try {
    if (!llm.apiKey) {
      return res.status(503).json({ error: 'Chatbot is not configured yet. Please try again later.' });
    }

    const inputMessage = (req.body?.message || '').toString().trim();
    const history = sanitizeMessages(req.body?.history);
    if (!inputMessage && history.length === 0) {
      return res.status(400).json({ error: 'message is required' });
    }

    const messages = [
      { role: 'system', content: llm.chatSystemPrompt },
      ...history,
    ];

    if (inputMessage) {
      messages.push({ role: 'user', content: inputMessage });
    }

    const temperature = Number.isFinite(req.body?.temperature) ? req.body.temperature : llm.temperature;

    if (llm.provider === 'gemini') {
      try {
        const { reply } = await callGeminiChat({
          history,
          message: inputMessage,
          temperature,
          systemPrompt: llm.chatSystemPrompt,
        });

        return res.json({ reply, model: llm.model, provider: 'gemini' });
      } catch (err) {
        logger.error('Gemini chat error', { message: err.message, stack: err.stack });
        return res.status(502).json({ error: err.message || 'Chatbot service is temporarily unavailable.' });
      }
    }

    if (llm.provider === 'perplexity') {
      const payload = {
        model: llm.model,
        temperature,
        messages,
      };
      try {
        const data = await callPerplexityChat(fetchCompat, payload);
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (!reply) {
          return res.status(502).json({ error: 'Chatbot did not return a response. Please try again.' });
        }
        return res.json({ reply, usage: data?.usage || null, model: data?.model || llm.model, provider: 'perplexity' });
      } catch (err) {
        logger.error('Perplexity chat error', { status: err.status, body: err.body });
        let message = err.body || 'Chatbot service is temporarily unavailable.';
        try {
          const parsed = typeof err.body === 'string' ? JSON.parse(err.body) : {};
          message = parsed?.error?.message || parsed?.message || message;
        } catch (_) {}
        return res.status(err.status || 502).json({ error: message });
      }
    }

    const payload = {
      model: llm.model,
      temperature,
      messages,
    };

    let data;
    try {
      data = await callOpenAIChat(fetchCompat, payload);
    } catch (err) {
      logger.error('Chatbot LLM error', { status: err.status, body: err.body });
      let message = err.body || 'Chatbot service is temporarily unavailable.';
      try {
        const parsed = typeof err.body === 'string' ? JSON.parse(err.body) : {};
        message = parsed?.error?.message || parsed?.message || message;
      } catch (_) {
        // ignore parse errors
      }
      return res.status(err.status || 502).json({ error: message });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Chatbot did not return a response. Please try again.' });
    }

    res.json({
      reply,
      usage: data?.usage || null,
      model: data?.model || llm.model,
      provider: llm.provider,
    });
  } catch (err) {
    logger.error('Chatbot handler failed', { message: err.message, stack: err.stack });
    next(err);
  }
};
