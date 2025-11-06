const createHttpClient = require('../config/axios');

// A ready-to-use generic HTTP client (override baseURL per call if needed)
const http = createHttpClient({
  timeout: 15000,
});

module.exports = {
  http,
  createHttpClient,
};