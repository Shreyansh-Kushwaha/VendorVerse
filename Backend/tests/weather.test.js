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

const realFetch = global.fetch;
let fetchCalls;

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
    return {
      ok: true, status: 200,
      json: async () => ({
        daily: {
          time: ['2026-08-28', '2026-08-29'],
          weather_code: [3, 80],
          temperature_2m_max: [31.4, 28.9],
          temperature_2m_min: [24.2, 23.6],
          precipitation_probability_max: [20, 85],
        },
      }),
    };
  };
});

test.after(async () => {
  global.fetch = realFetch;
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('the forecast is two normalised days', async () => {
  const res = await vendor.get('/api/weather')
    .query({ lat: 28.6315, lng: 77.2167 }).expect(200);
  assert.strictEqual(res.body.days.length, 2);
  const [today, tomorrow] = res.body.days;
  assert.deepStrictEqual(today, { date: '2026-08-28', code: 3, tMax: 31, tMin: 24, rainChance: 20 });
  assert.strictEqual(tomorrow.rainChance, 85);
});

test('vendors on the same street share one cached forecast', async () => {
  const before = fetchCalls.length;
  // ~400 m away — same 0.01° bucket once rounded.
  await vendor.get('/api/weather').query({ lat: 28.6318, lng: 77.2151 }).expect(200);
  assert.strictEqual(fetchCalls.length, before, 'served from cache');
});

test('weather requires a session and sane coordinates', async () => {
  await request(app).get('/api/weather').query({ lat: 28.6, lng: 77.2 }).expect(401);
  await vendor.get('/api/weather').query({ lat: 91, lng: 77.2 }).expect(400);
  await vendor.get('/api/weather').query({ lat: 28.6 }).expect(400);
});

test('an upstream failure is a 503, never a crash', async () => {
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  // A fresh coordinate bucket, so the cache cannot answer.
  const res = await vendor.get('/api/weather').query({ lat: 19.076, lng: 72.8777 }).expect(503);
  assert.match(res.body.msg, /unavailable/i);
});
