const logger = require('../config/logger');

function mapPgError(err) {
  // Common PG error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  switch (err.code) {
    case '23505': // unique_violation
      return { status: 409, message: err.detail || 'Conflict: duplicate value' };
    case '23503': // foreign_key_violation
      return { status: 409, message: 'Conflict: foreign key violation' };
    case '23514': // check_violation
      return { status: 400, message: 'Bad Request: check constraint violated' };
    case '22P02': // invalid_text_representation (e.g., bad UUID/int)
      return { status: 400, message: 'Bad Request: invalid input format' };
    default:
      return null;
  }
}

// Express error-handling middleware
module.exports = (err, req, res, next) => {
  const statusFromPg = err && err.code ? mapPgError(err) : null;

  const status = err.status || err.statusCode || statusFromPg?.status || 500;
  const message = err.message || statusFromPg?.message || 'Internal Server Error';

  logger.error('Request error', {
    method: req.method,
    path: req.originalUrl,
    status,
    message,
    stack: err.stack,
  });

  res.status(status).json({
    error: message,
  });
};