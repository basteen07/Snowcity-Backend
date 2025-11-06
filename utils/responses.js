const HTTP = require('./httpStatus');

function success(res, data, status = HTTP.OK) {
  return res.status(status).json({ data });
}

function created(res, data) {
  return res.status(HTTP.CREATED).json({ data });
}

function noContent(res) {
  return res.status(HTTP.NO_CONTENT).send();
}

function error(res, status = HTTP.INTERNAL_SERVER_ERROR, message = 'Internal Server Error', details = null) {
  const payload = { error: message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

module.exports = {
  success,
  created,
  noContent,
  error,
};