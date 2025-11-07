const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const hpp = require('hpp');
const morgan = require('morgan');

const logger = require('./config/logger');
const corsOptions = require('./config/cors');

const app = express();

// Trust proxy (for rate limiting, IP, secure cookies if behind proxy)
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// Body parsers — ONCE, EARLY!
app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '2mb' }));
app.use(express.urlencoded({ limit: process.env.MAX_URLENCODED_SIZE || '2mb', extended: true }));

// Security & CORS — EARLY (BEFORE ROUTES!)
app.use(helmet());
app.use(compression());
app.use(hpp());
app.use(cors(corsOptions)); // ← FIXED: BEFORE ROUTES!

// HTTP logging via morgan -> winston
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);

// Routes — AFTER CORS!
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// Echo endpoint
app.post('/_echo', (req, res) => {
  res.json({ body: req.body, headers: req.headers });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Placeholder root
app.get('/', (req, res) => {
  res.json({ name: 'SnowCity API', version: '1.0.0' });
});

// 404
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
  });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;