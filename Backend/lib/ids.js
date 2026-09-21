const { z } = require('zod');

// A MongoDB ObjectId as it appears in a path or body. Every route file used to
// carry its own copy of this regex.
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

module.exports = { objectId };
