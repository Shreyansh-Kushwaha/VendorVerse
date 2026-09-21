const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');

let mongod, vendor;

// The service reads global fetch at call time, so the tests swap it for a
// stub — no request here may ever reach data.gov.in.
const realFetch = global.fetch;
let fetchCalls;
let respondWith;

function record(r) {
  return {
    market: 'Azadpur', district: 'Delhi', state: 'Delhi', variety: 'Red',
    arrival_date: '28/08/2026', min_price: '2000', max_price: '3000', modal_price: '2400',
    ...r,
  };
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  vendor = request.agent(app);
  await vendor.post('/api/register').send({
    name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi',
  }).expect(201);
  await vendor.post('/api/login').send({ email: 'v@t.co', password: 'secret123' }).expect(200);

  fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return respondWith(String(url));
  };
});

test.after(async () => {
  global.fetch = realFetch;
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('mandi rates arrive per kg, cheapest first, with a median headline', async () => {
  respondWith = () => ({
    ok: true, status: 200,
    json: async () => ({
      records: [
        record({ market: 'Ghazipur', modal_price: '3000' }),
        record({ market: 'Azadpur', modal_price: '2400' }),
        record({ market: 'Closed Today', modal_price: '0' }), // no arrivals
      ],
    }),
  });

  const res = await vendor.get('/api/mandi').query({ commodity: 'Onion' }).expect(200);
  assert.strictEqual(res.body.count, 2, 'the zero-price market is not a record');
  assert.strictEqual(res.body.records[0].market, 'Azadpur', 'cheapest mandi leads');
  assert.strictEqual(res.body.records[0].modalPerKg, 24, '₹2400/quintal is ₹24/kg');
  assert.strictEqual(res.body.medianPerKg, 27, 'median of 24 and 30');

  const upstream = fetchCalls.find(u => u.includes('data.gov.in'));
  assert.ok(upstream.includes('Onion'), 'commodity filter forwarded');
});

test('a repeat request is served from the cache, not the upstream', async () => {
  const before = fetchCalls.length;
  const res = await vendor.get('/api/mandi').query({ commodity: 'Onion' }).expect(200);
  assert.strictEqual(res.body.count, 2);
  assert.strictEqual(fetchCalls.length, before, 'no second upstream call');
});

test('mandi requires a session and a sane commodity', async () => {
  await request(app).get('/api/mandi').query({ commodity: 'Onion' }).expect(401);
  await vendor.get('/api/mandi').expect(400);
  await vendor.get('/api/mandi').query({ commodity: 'x' }).expect(400);
  await vendor.get('/api/mandi').query({ commodity: 'Onion; drop 1=1' }).expect(400);
});

test('an upstream failure is a 503, never a crash', async () => {
  respondWith = () => ({ ok: false, status: 500, json: async () => ({}) });
  const res = await vendor.get('/api/mandi').query({ commodity: 'Potato' }).expect(503);
  assert.match(res.body.msg, /unavailable/i);
});
