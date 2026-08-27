const { ZodError } = require('zod');

// Express 5 exposes req.query through a getter on the prototype, so a plain
// `req.query = parsed` is a silent no-op — defaults and coercions from the
// schema would never reach the handler. Defining an own property shadows it.
function replace(req, key, value) {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body)   replace(req, 'body',   schemas.body.parse(req.body));
      if (schemas.query)  replace(req, 'query',  schemas.query.parse(req.query));
      if (schemas.params) replace(req, 'params', schemas.params.parse(req.params));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          msg: 'Invalid request',
          errors: err.issues.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      next(err);
    }
  };
}

module.exports = validate;
