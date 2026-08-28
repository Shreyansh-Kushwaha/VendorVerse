const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');

let mongod, supplier, vendor, idS;

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  [supplier, idS] = await makeUser({ name: 'Imran', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });
  [vendor] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });

  const listed = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 100, price: 40, category: 'vegetables' },
  }).expect(201);
  const itemId = listed.body.item._id;

  // 2×40 = 80 kept, 3×40 = 120 kept, 5×40 = 200 cancelled (counts for zero).
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 2 }).expect(201);
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 3 }).expect(201);
  const res = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 5 }).expect(201);
  await vendor.post(`/api/orders/${res.body.order._id}/cancel`).expect(200);
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('supplier analytics counts money once and cancellations for nothing', async () => {
  const { body } = await supplier.get('/api/supplier/analytics').expect(200);
  assert.strictEqual(body.totalOrders, 3);
  assert.strictEqual(body.totalRevenue, 200);
  assert.deepStrictEqual(body.statusCounts, { Pending: 2, Cancelled: 1 });
  assert.strictEqual(body.daily.length, 7, 'always a full week of bars');
  assert.strictEqual(body.daily.reduce((s, d) => s + d.revenue, 0), 200, 'today’s bar carries the kept revenue');
});

test('vendor analytics mirrors the same rules for spend', async () => {
  const { body } = await vendor.get('/api/vendor/analytics').expect(200);
  assert.strictEqual(body.totalOrders, 3);
  assert.strictEqual(body.totalSpend, 200);
  assert.strictEqual(body.weekSpend, 200);
  assert.deepStrictEqual(body.statusCounts, { Pending: 2, Cancelled: 1 });
});

test('a fresh account gets zeros, not errors', async () => {
  const [empty] = await makeUser({ name: 'New', email: 'n@t.co', password: 'secret123', userType: 'vendor', location: 'Pune' });
  const { body } = await empty.get('/api/vendor/analytics').expect(200);
  assert.deepStrictEqual(body, { totalOrders: 0, totalSpend: 0, weekSpend: 0, statusCounts: {} });
});
