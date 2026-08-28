const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const mongoose = require('mongoose');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind Render/Heroku there is one proxy hop. Without this every request looks
// like it comes from the proxy IP and all users share a single rate-limit bucket.
app.set('trust proxy', 1);

// The policy below is tailored to what the app actually loads: Google Fonts,
// Cloudinary images, and its own bundle. The theme bootstrap lives in
// /theme-init.js rather than inline so script-src does not need unsafe-inline.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  // Google Fonts are cross origin, so the isolation headers would block them.
  crossOriginEmbedderPolicy: false,
}));

// Users are on mobile data. Never compress the notification stream — buffering
// it would stop events arriving until the connection closed.
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/api/notifications/stream') return false;
    if (String(res.getHeader('Content-Type') || '').includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

// Same-origin in prod (Express serves the SPA) and via the Vite proxy in dev, so
// the only cross-origin caller would be an attacker. Reflect an explicit allowlist.
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  // Per-IP rate limit on the API surface (uploads/orders/auth)
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many requests, please slow down.' },
  }));

  app.use(['/api/login', '/api/register', '/api/forgot-password', '/api/reset-password'], rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many attempts, please try again later.' },
  }));
}

// Health. Reports the driver's own connection state, so it stays a cheap
// in-process check but stops claiming ok while the database is unreachable.
app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  const up = state === 1;
  res.status(up ? 200 : 503).json({
    status: up ? 'ok' : 'degraded',
    db: mongoose.STATES[state],
    uptime: process.uptime(),
    ts: Date.now(),
  });
});

// API routes
app.use('/api', require('./routes/requestRoutes'));
app.use('/api', require('./routes/supplierRoutes'));
app.use('/api', require('./routes/authRoutes'));
app.use('/api', require('./routes/notificationRoutes'));
app.use('/api', require('./routes/reviewRoutes'));
app.use('/api', require('./routes/stockAlertRoutes'));

// Serve the React build
const reactDist = path.join(__dirname, '..', 'Frontend', 'dist');
const hasBuild = fs.existsSync(path.join(reactDist, 'index.html'));

if (process.env.NODE_ENV !== 'test') {
  if (!hasBuild) {
    console.warn(`⚠️  Frontend build not found. Run \`npm run build\` in Frontend/ — for dev, use \`npm run dev\` (Vite proxies /api here).`);
  } else {
    console.log(`🎨 Serving React build from ${reactDist}`);
  }
}

app.use(express.static(reactDist));

// SPA fallback for client-side routing
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  if (path.extname(req.path)) return next();
  if (!fs.existsSync(path.join(reactDist, 'index.html'))) return next();
  res.sendFile(path.join(reactDist, 'index.html'));
});

// 404 + central error handler (API-only)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
