const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');

let mongod, supplier, idS;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  supplier = request.agent(app);
  await supplier.post('/api/register').send({
    name: 'Imran', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi',
  }).expect(201);
  const res = await supplier.post('/api/login').send({ email: 's@t.co', password: 'secret123' }).expect(200);
  idS = res.body.user._id;
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

async function listItem(price) {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 50, price, category: 'vegetables' },
  }).expect(201);
  return res.body.item._id;
}

test('listing an item writes its first price point', async () => {
  const itemId = await listItem(40);
  const res = await request(app).get(`/api/items/${itemId}/prices`).expect(200);
  assert.strictEqual(res.body.points.length, 1);
  assert.strictEqual(res.body.points[0].price, 40);
});

test('every price change adds a point, oldest first', async () => {
  const itemId = await listItem(40);
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ price: 45 }).expect(200);
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ price: 38 }).expect(200);
  const res = await request(app).get(`/api/items/${itemId}/prices`).expect(200);
  assert.deepStrictEqual(res.body.points.map(p => p.price), [40, 45, 38]);
});

test('touching stock without touching price records nothing', async () => {
  const itemId = await listItem(40);
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ quantity: 99 }).expect(200);
  // Re-sending the same price is not a change either.
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ price: 40 }).expect(200);
  const res = await request(app).get(`/api/items/${itemId}/prices`).expect(200);
  assert.strictEqual(res.body.points.length, 1);
});
