const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const Supplier = require('../models/Supplier');

let mongod, vendor;

const realFetch = global.fetch;
let fetchCalls;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Supplier.syncIndexes();

  vendor = request.agent(app);
  await vendor.post('/api/register').send({
    name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi',
  }).expect(201);
  await vendor.post('/api/login').send({ email: 'v@t.co', password: 'secret123' }).expect(200);

  const supplier = request.agent(app);
  await supplier.post('/api/register').send({
    name: 'Mandi Fresh', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi',
  }).expect(201);
  await supplier.post('/api/login').send({ email: 's@t.co', password: 'secret123' }).expect(200);
  await supplier.post('/api/suppliers').send({
    location: 'Delhi', lat: 28.64, lng: 77.22,
    inventory: { itemName: 'Onion', quantity: 10, price: 40, category: 'vegetables' },
  }).expect(201);

  fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return {
      ok: true, status: 200,
      json: async () => ({
        code: 'Ok',
        // Row 0 is from the source: itself, then each destination in order.
        durations: [[0, 720, 1500]],
        distances: [[0, 3400, 11200]],
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

test('the matrix returns one road route per destination, in order', async () => {
  const res = await vendor.get('/api/route-matrix')
    .query({ from: '28.6315,77.2167', to: '28.64,77.22;28.7,77.3' }).expect(200);
  assert.deepStrictEqual(res.body.routes, [
    { km: 3.4, minutes: 12 },
    { km: 11.2, minutes: 25 },
  ]);
  const upstream = fetchCalls.find(u => u.includes('project-osrm.org'));
  assert.ok(upstream.startsWith('https://router.project-osrm.org/table/v1/driving/77.2167,28.6315;'),
    'source first, as lng,lat');
});

test('a repeat request from the same corner is served from the cache', async () => {
  const before = fetchCalls.length;
  await vendor.get('/api/route-matrix')
    .query({ from: '28.6315,77.2167', to: '28.64,77.22;28.7,77.3' }).expect(200);
  assert.strictEqual(fetchCalls.length, before, 'no second upstream call');
});

test('the matrix requires a session and refuses junk coordinates', async () => {
  await request(app).get('/api/route-matrix')
    .query({ from: '28.6,77.2', to: '28.7,77.3' }).expect(401);
  await vendor.get('/api/route-matrix').query({ from: '91,77.2', to: '28.7,77.3' }).expect(400);
  await vendor.get('/api/route-matrix').query({ from: '28.6,77.2', to: 'not,coords' }).expect(400);
  await vendor.get('/api/route-matrix')
    .query({ from: '28.6,77.2', to: Array(25).fill('28.7,77.3').join(';') }).expect(400);
});

test('nearby supplier cards carry the point the map needs', async () => {
  const res = await vendor.get('/api/suppliers/near')
    .query({ lat: 28.6315, lng: 77.2167 }).expect(200);
  assert.deepStrictEqual(res.body.suppliers[0].geo.coordinates, [77.22, 28.64]);
});

test('an OSRM error is a 503, never a crash', async () => {
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ code: 'NoTable' }) });
  const res = await vendor.get('/api/route-matrix')
    .query({ from: '19.076,72.8777', to: '19.1,72.9' }).expect(503);
  assert.match(res.body.msg, /unavailable/i);
});
