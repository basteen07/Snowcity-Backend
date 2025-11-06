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
app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '12mb' }));
app.use(express.urlencoded({ limit: process.env.MAX_URLENCODED_SIZE || '12mb', extended: true }));

const apiRoutes = require('./routes');
// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(hpp());
app.use('/api', apiRoutes);
// Body parsers
app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '2mb' }));
app.use(express.urlencoded({ limit: process.env.MAX_URLENCODED_SIZE || '2mb', extended: true }));





app.post('/_echo', express.json(), (req, res) => {
  res.json({ body: req.body, headers: req.headers });
});
// CORS
app.use(cors(corsOptions));

// HTTP logging via morgan -> winston
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);

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

// TODO: mount routes when ready
// const apiRoutes = require('./routes');
// app.use('/api', apiRoutes);

// 404
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

// Error handler
// Note: keep signature (err, req, res, next)
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