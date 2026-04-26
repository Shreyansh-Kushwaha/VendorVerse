function notFound(req, res, next) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ msg: 'Route not found' });
  }
  next();
}

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const exposed = status < 500 ? err.message : 'Something went wrong';
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ msg: exposed });
}

module.exports = { notFound, errorHandler };
