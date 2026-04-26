const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Per-IP rate limit on the API surface (uploads/orders/auth)
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many requests, please slow down.' },
}));

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
if (!fs.existsSync(path.join(reactDist, 'index.html'))) {
  console.warn(`⚠️  Frontend build not found. Run \`npm run build\` in Frontend/ — for dev, use \`npm run dev\` (Vite proxies /api here).`);
} else {
  console.log(`🎨 Serving React build from ${reactDist}`);
}

app.use(express.static(reactDist));

// SPA fallback for client-side routing
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(reactDist, 'index.html'));
});

// 404 + central error handler (API-only)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
