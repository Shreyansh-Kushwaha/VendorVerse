const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind Render/Heroku there is one proxy hop. Without this every request looks
// like it comes from the proxy IP and all users share a single rate-limit bucket.
app.set('trust proxy', 1);

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

  app.use(['/api/login', '/api/register'], rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many attempts, please try again later.' },
  }));
}

// Health (no DB call — fast and cacheable)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() });
});

// API routes
app.use('/api', require('./routes/requestRoutes'));
app.use('/api', require('./routes/supplierRoutes'));
app.use('/api', require('./routes/authRoutes'));

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
