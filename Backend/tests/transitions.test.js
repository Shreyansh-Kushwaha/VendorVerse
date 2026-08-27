const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const Order = require('../models/Order');

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
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

async function freshOrder(qty = 100) {
  const listed = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: `Item ${Math.abs(qty)}`, quantity: qty, price: 10, category: 'others' },
  }).expect(201);
  const placed = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId: listed.body.item._id, quantity: 1 }).expect(201);
  return placed.body.order._id;
}

const setStatus = (id, status) => supplier.patch(`/api/orders/${id}/status`).send({ status });

test('the happy path walks the whole flow', async () => {
  const id = await freshOrder(1);
  for (const s of ['Accepted', 'Packed', 'OutForDelivery', 'Delivered']) {
    await setStatus(id, s).expect(200);
  }
  assert.strictEqual((await Order.findById(id)).status, 'Delivered');
});

test('an order cannot skip a step', async () => {
  const id = await freshOrder(2);
  const res = await setStatus(id, 'Delivered');
  assert.strictEqual(res.status, 409);
  assert.match(res.body.msg, /cannot go from Pending to Delivered/);
  assert.strictEqual((await Order.findById(id)).status, 'Pending');
});

test('an order cannot move backwards', async () => {
  const id = await freshOrder(3);
  await setStatus(id, 'Accepted').expect(200);
  await setStatus(id, 'Pending').expect(409);
  assert.strictEqual((await Order.findById(id)).status, 'Accepted');
});

test('a delivered order is final', async () => {
  const id = await freshOrder(4);
  for (const s of ['Accepted', 'Packed', 'OutForDelivery', 'Delivered']) await setStatus(id, s).expect(200);

  for (const s of ['Rejected', 'Cancelled', 'Pending', 'Packed']) {
    await setStatus(id, s).expect(409);
  }
  assert.strictEqual((await Order.findById(id)).status, 'Delivered');
});

test('a rejected order is final', async () => {
  const id = await freshOrder(5);
  await setStatus(id, 'Rejected').expect(200);
  await setStatus(id, 'Accepted').expect(409);
  assert.strictEqual((await Order.findById(id)).status, 'Rejected');
});

test('an accepted order can no longer be rejected', async () => {
  const id = await freshOrder(6);
  await setStatus(id, 'Accepted').expect(200);
  await setStatus(id, 'Rejected').expect(409);
});

test('a refused transition writes no history entry', async () => {
  const id = await freshOrder(7);
  const before = (await Order.findById(id)).statusHistory.length;
  await setStatus(id, 'Delivered').expect(409);
  assert.strictEqual((await Order.findById(id)).statusHistory.length, before);
});
