function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(' ');
    return res.status(400).json({ message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That email is already registered.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid id format.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request payload is too large.' });
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  const production = process.env.NODE_ENV === 'production';
  const message = production && status >= 500
    ? 'Something went wrong on the server.'
    : (err.message || 'Something went wrong on the server.');
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
