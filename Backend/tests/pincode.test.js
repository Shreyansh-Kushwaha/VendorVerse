const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const request = require('supertest');
const app = require('../app');

// The lookup is public and never touches the database, so unlike its sibling
// suites this one needs no MongoDB at all — only a stubbed fetch.
const realFetch = global.fetch;
let fetchCalls;

test.before(() => {
  fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    const pin = String(url).split('/').pop();
    if (pin === '110001') {
      return {
        ok: true, status: 200,
        json: async () => ([{
          Status: 'Success',
          PostOffice: [{ Name: 'Connaught Place', District: 'Central Delhi', State: 'Delhi' }],
        }]),
      };
    }
    return { ok: true, status: 200, json: async () => ([{ Status: 'Error', PostOffice: null }]) };
  };
});

test.after(() => { global.fetch = realFetch; });

test('a known PIN resolves to area, district and state', async () => {
  const res = await request(app).get('/api/pincode/110001').expect(200);
  assert.deepStrictEqual(res.body, {
    pin: '110001', area: 'Connaught Place', district: 'Central Delhi', state: 'Delhi',
  });
});

test('a repeat lookup is served from the cache', async () => {
  const before = fetchCalls.length;
  await request(app).get('/api/pincode/110001').expect(200);
  assert.strictEqual(fetchCalls.length, before, 'no second upstream call');
});

test('an unknown PIN is a 404, and stays cached as one', async () => {
  await request(app).get('/api/pincode/999999').expect(404);
  const before = fetchCalls.length;
  await request(app).get('/api/pincode/999999').expect(404);
  assert.strictEqual(fetchCalls.length, before, 'the miss was cached too');
});

test('a malformed PIN never reaches the upstream', async () => {
  const before = fetchCalls.length;
  await request(app).get('/api/pincode/1234').expect(400);
  await request(app).get('/api/pincode/012345').expect(400); // PINs never start with 0
  await request(app).get('/api/pincode/abcdef').expect(400);
  assert.strictEqual(fetchCalls.length, before);
});

test('an upstream failure is a 503, never a crash', async () => {
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const res = await request(app).get('/api/pincode/560001').expect(503);
  assert.match(res.body.msg, /unavailable/i);
});
