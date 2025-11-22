const llm = require('../config/llm');
const logger = require('../config/logger');

let geminiClient = null;
if (llm.provider === 'gemini') {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    if (llm.apiKey) {
      geminiClient = new GoogleGenerativeAI(llm.apiKey);
    }
  } catch (err) {
    logger.error('Failed to initialize Gemini client', { message: err.message, stack: err.stack });
  }
}

async function callGeminiChat({ history = [], message, temperature, systemPrompt }) {
  if (!geminiClient) {
    throw new Error('Gemini client is not configured. Set LLM_API_KEY.');
  }
  const modelName = llm.model || 'gemini-1.5-pro';
  const contents = [];
  const allMessages = [...history];
  if (message) {
    allMessages.push({ role: 'user', content: message });
  }
  allMessages.forEach((msg) => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    contents.push({
      role,
      parts: [{ text: msg.content }],
    });
  });

  const model = geminiClient.getGenerativeModel(
    systemPrompt
      ? { model: modelName, systemInstruction: { parts: [{ text: systemPrompt }] } }
      : { model: modelName }
  );

  const result = await model.generateContent({
    contents,
    generationConfig: {
      temperature: Number.isFinite(temperature) ? temperature : llm.temperature,
    },
  });

  const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini did not return any text.');
  }
  return { reply: text };
}

async function callOpenAIChat(fetchCompat, payload) {
  const resp = await fetchCompat(`${llm.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error('OpenAI call failed');
    err.status = resp.status;
    err.body = text;
    throw err;
  }
  return resp.json();
}

async function callPerplexityChat(fetchCompat, payload) {
  const resp = await fetchCompat(`${llm.baseUrl || 'https://api.perplexity.ai'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error('Perplexity call failed');
    err.status = resp.status;
    err.body = text;
    throw err;
  }
  return resp.json();
}

module.exports = {
  callGeminiChat,
  callOpenAIChat,
  callPerplexityChat,
};
