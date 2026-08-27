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
const Order = require('../models/Order');

let mongod, supplier, vendor, other, idS;

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
  [other] = await makeUser({ name: 'Sunita', email: 'v2@t.co', password: 'secret123', userType: 'vendor', location: 'Pune' });
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

let n = 0;
async function placeOne(qty = 10, take = 3) {
  const listed = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: `Item ${++n}`, quantity: qty, price: 20, unit: 'kg', category: 'others' },
  }).expect(201);
  const placed = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId: listed.body.item._id, quantity: take }).expect(201);
  return { orderId: placed.body.order._id, itemId: listed.body.item._id };
}

const stockOf = async (itemId) =>
  (await Supplier.findOne({ supplierId: idS, 'inventory._id': itemId })).inventory.id(itemId).quantity;

test('a vendor can cancel their own pending order and the stock comes back', async () => {
  const { orderId, itemId } = await placeOne(10, 3);
  assert.strictEqual(await stockOf(itemId), 7);

  const res = await vendor.post(`/api/orders/${orderId}/cancel`).expect(200);
  assert.strictEqual(res.body.order.status, 'Cancelled');
  assert.strictEqual(await stockOf(itemId), 10, 'stock returned');
});

test('cancelling records a history entry', async () => {
  const { orderId } = await placeOne();
  await vendor.post(`/api/orders/${orderId}/cancel`).expect(200);
  const order = await Order.findById(orderId);
  assert.ok(order.statusHistory.some(h => h.status === 'Cancelled'));
});

test('a vendor cannot cancel somebody else order', async () => {
  const { orderId, itemId } = await placeOne(10, 3);
  const res = await other.post(`/api/orders/${orderId}/cancel`);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(await stockOf(itemId), 7, 'stock untouched');
  assert.strictEqual((await Order.findById(orderId)).status, 'Pending');
});

test('a supplier cannot use the vendor cancel route', async () => {
  const { orderId } = await placeOne();
  await supplier.post(`/api/orders/${orderId}/cancel`).expect(403);
});

test('an anonymous caller cannot cancel', async () => {
  const { orderId } = await placeOne();
  await request(app).post(`/api/orders/${orderId}/cancel`).expect(401);
});

test('once the supplier accepts the order can no longer be cancelled', async () => {
  const { orderId, itemId } = await placeOne(10, 3);
  await supplier.patch(`/api/orders/${orderId}/status`).send({ status: 'Accepted' }).expect(200);

  const res = await vendor.post(`/api/orders/${orderId}/cancel`);
  assert.strictEqual(res.status, 409);
  assert.match(res.body.msg, /already Accepted/);
  assert.strictEqual(await stockOf(itemId), 7, 'stock stays reserved');
});

test('cancelling twice does not return stock twice', async () => {
  const { orderId, itemId } = await placeOne(10, 4);
  await vendor.post(`/api/orders/${orderId}/cancel`).expect(200);
  assert.strictEqual(await stockOf(itemId), 10);

  await vendor.post(`/api/orders/${orderId}/cancel`).expect(409);
  assert.strictEqual(await stockOf(itemId), 10, 'stock must not be inflated');
});

test('cancelling an order that does not exist is a 404', async () => {
  await vendor.post(`/api/orders/${new mongoose.Types.ObjectId()}/cancel`).expect(404);
});
