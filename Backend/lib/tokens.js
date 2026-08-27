const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'vv_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ JWT_SECRET is not set. Refusing to start — see Backend/.env.example');
  process.exit(1);
}

function sign(user) {
  return jwt.sign(
    { sub: String(user._id), userType: user.userType },
    SECRET,
    { expiresIn: '7d' },
  );
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

// httpOnly so XSS cannot read it. Lax blocks cross-site POST/PATCH/DELETE, which
// is the CSRF surface that matters here.
function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, sign(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = { COOKIE_NAME, sign, verify, setAuthCookie, clearAuthCookie };
