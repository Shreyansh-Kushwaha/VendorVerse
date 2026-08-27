const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const request = require('supertest');
const app = require('../app');

test('security headers are set on API responses', async () => {
  const res = await request(app).get('/api/health');

  const csp = res.headers['content-security-policy'];
  assert.ok(csp, 'a content security policy must be sent');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/, 'clickjacking protection');
  assert.match(csp, /object-src 'none'/);

  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.headers['referrer-policy'], 'a referrer policy must be sent');
  assert.strictEqual(res.headers['x-powered-by'], undefined, 'do not advertise Express');
});

test('the policy allows exactly what the app loads and nothing more', async () => {
  const csp = (await request(app).get('/api/health')).headers['content-security-policy'];

  // Google Fonts, Cloudinary images, same origin XHR and SSE.
  assert.match(csp, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /img-src[^;]*https:/);
  assert.match(csp, /connect-src 'self'/);

  // The theme bootstrap was moved to its own file so this can stay locked down.
  assert.match(csp, /script-src 'self'/);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'scripts must not allow inline');
  assert.ok(!/script-src[^;]*unsafe-eval/.test(csp), 'scripts must not allow eval');
});

test('the built page carries no inline script for the policy to block', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const built = path.join(__dirname, '..', '..', 'Frontend', 'dist', 'index.html');
  if (!fs.existsSync(built)) return; // build not present in this environment

  const html = fs.readFileSync(built, 'utf8');
  const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(m => m[1].trim().length > 0);
  assert.strictEqual(inline.length, 0, `found inline script(s): ${inline.map(m => m[1].slice(0, 60))}`);
});
