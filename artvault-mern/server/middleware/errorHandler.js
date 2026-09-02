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

  res.status(err.status || 500).json({ message: err.message || 'Something went wrong on the server.' });
}

module.exports = { notFound, errorHandler };
