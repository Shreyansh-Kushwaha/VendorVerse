const test = require('node:test');
const assert = require('node:assert');

const express = require('express');
const request = require('supertest');
const { z } = require('zod');
const validate = require('../middleware/validate');

function appWith(schemas, handler) {
  const app = express();
  app.use(express.json());
  app.get('/t', validate(schemas), handler);
  app.post('/t', validate(schemas), handler);
  app.use((err, req, res, _next) => res.status(500).json({ msg: 'Something went wrong' }));
  return app;
}

test('a schema default reaches the handler', async () => {
  const app = appWith(
    { query: z.object({ page: z.coerce.number().int().min(1).default(1) }) },
    (req, res) => res.json({ page: req.query.page, type: typeof req.query.page }),
  );
  const res = await request(app).get('/t').expect(200);
  assert.strictEqual(res.body.page, 1, 'the default must survive the middleware');
  assert.strictEqual(res.body.type, 'number');
});

test('a coerced query value reaches the handler as a number', async () => {
  const app = appWith(
    { query: z.object({ limit: z.coerce.number().int() }) },
    (req, res) => res.json({ limit: req.query.limit, type: typeof req.query.limit }),
  );
  const res = await request(app).get('/t?limit=25').expect(200);
  assert.strictEqual(res.body.limit, 25);
  assert.strictEqual(res.body.type, 'number', 'must not still be the string "25"');
});

test('unknown query keys are stripped', async () => {
  const app = appWith(
    { query: z.object({ q: z.string().optional() }) },
    (req, res) => res.json(req.query),
  );
  const res = await request(app).get('/t?q=onion&sneaky=1').expect(200);
  assert.deepStrictEqual(res.body, { q: 'onion' });
});

test('body defaults reach the handler too', async () => {
  const app = appWith(
    { body: z.object({ unit: z.string().default('kg') }) },
    (req, res) => res.json(req.body),
  );
  const res = await request(app).post('/t').send({}).expect(200);
  assert.strictEqual(res.body.unit, 'kg');
});

test('a bad value is a 400 with the field path, not a 500', async () => {
  const app = appWith(
    { query: z.object({ page: z.coerce.number().int().min(1) }) },
    (req, res) => res.json(req.query),
  );
  const res = await request(app).get('/t?page=0').expect(400);
  assert.strictEqual(res.body.msg, 'Invalid request');
  assert.strictEqual(res.body.errors[0].path, 'page');
});
