const { COOKIE_NAME, verify } = require('../lib/tokens');
const User = require('../models/user');

// Populates req.user from the auth cookie. Rejects if missing or invalid.
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ msg: 'Not signed in' });

  let payload;
  try {
    payload = verify(token);
  } catch {
    return res.status(401).json({ msg: 'Session expired, please sign in again' });
  }

  try {
    const user = await User.findById(payload.sub).select('-password');
    if (!user) return res.status(401).json({ msg: 'Account no longer exists' });
    req.user = user;
    next();
  } catch (err) { next(err); }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.userType !== role) {
      return res.status(403).json({ msg: `Only a ${role} can do that` });
    }
    next();
  };
}

// Route param must match the signed-in user. Blocks the IDOR on /users/:id.
function requireSelf(param = 'id') {
  return (req, res, next) => {
    if (String(req.user?._id) !== req.params[param]) {
      return res.status(403).json({ msg: 'You can only modify your own account' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireSelf };
