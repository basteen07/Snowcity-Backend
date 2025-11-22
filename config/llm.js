const DEFAULT_TEMPERATURE = 0.4;

function parseTemperature(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(Math.max(num, 0), 1) : DEFAULT_TEMPERATURE;
}

const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

function resolveDefaultModel() {
  switch (provider) {
    case 'gemini':
      return 'gemini-1.5-pro';
    case 'perplexity':
      return 'llama-3.1-sonar-small-128k-chat';
    default:
      return 'gpt-4o-mini';
  }
}

function resolveDefaultBaseUrl() {
  switch (provider) {
    case 'gemini':
      return '';
    case 'perplexity':
      return 'https://api.perplexity.ai';
    default:
      return 'https://api.openai.com/v1';
  }
}

const defaultModel = resolveDefaultModel();
const defaultBaseUrl = resolveDefaultBaseUrl();

function normalizeModel(model) {
  const input = (model || '').trim();
  if (!input) return defaultModel;
  if (provider !== 'perplexity') return input;

  const alias = input.toLowerCase();
  const map = {
    'sonar-small-128k-chat': 'llama-3.1-sonar-small-128k-chat',
    'sonar-medium-128k-chat': 'llama-3.1-sonar-medium-128k-chat',
    'sonar-large-128k-chat': 'llama-3.1-sonar-large-128k-chat',
  };
  return map[alias] || input;
}

const resolvedModel = normalizeModel(process.env.LLM_MODEL || defaultModel);

module.exports = {
  provider,
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: process.env.LLM_BASE_URL || defaultBaseUrl,
  model: resolvedModel,
  temperature: parseTemperature(process.env.LLM_TEMPERATURE),
  chatSystemPrompt:
    process.env.LLM_SYSTEM_PROMPT ||
    "You are SnowCity Bengaluru's virtual concierge. Help visitors with attraction info, combos, safety, timings, and booking guidance. Never invent prices or unavailable offers. If asked to complete a booking, collect preferences and guide them to the official booking flow at /booking.",
};
