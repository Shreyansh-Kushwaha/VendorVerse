const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const User = require('../models/user');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

let mongod, supplier, vendor, idS, idV, orderId, itemId;

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
  [vendor, idV] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });

  const listed = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 20, price: 40, unit: 'kg', category: 'vegetables' },
  }).expect(201);
  itemId = listed.body.item._id;

  const placed = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId, quantity: 5, deliveryAddress: 'Stall 14' }).expect(201);
  orderId = placed.body.order._id;
  await flushEmails();
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('deleting an account removes the profile inventory and notifications', async () => {
  assert.ok(await Supplier.findOne({ supplierId: idS }), 'inventory exists first');
  assert.ok(await Notification.countDocuments({ userId: idS }) > 0, 'notifications exist first');

  await supplier.delete(`/api/users/${idS}`).send({ password: 'secret123' }).expect(200);

  assert.strictEqual(await User.findById(idS), null);
  assert.strictEqual(await Supplier.countDocuments({ supplierId: idS }), 0);
  assert.strictEqual(await Notification.countDocuments({ userId: idS }), 0);
});

test('the other party keeps their order history', async () => {
  const order = await Order.findById(orderId);
  assert.ok(order, 'the order survives the supplier leaving');
  assert.strictEqual(order.itemName, 'Onion');
  assert.strictEqual(order.price, 40);
  assert.strictEqual(order.quantity, 5);
});

test('the vendor can still list and open that order', async () => {
  const list = await vendor.get('/api/vendor/orders').expect(200);
  assert.strictEqual(list.body.length, 1);
  assert.strictEqual(list.body[0].supplierId, null, 'the missing party populates as null, not a crash');

  const detail = await vendor.get(`/api/orders/${orderId}`).expect(200);
  assert.strictEqual(detail.body.itemName, 'Onion');
  assert.strictEqual(detail.body.supplierId, null);
});

test('vendor analytics still add up after the counterparty leaves', async () => {
  const res = await vendor.get('/api/vendor/analytics').expect(200);
  assert.strictEqual(res.body.totalOrders, 1);
  assert.strictEqual(res.body.totalSpend, 200);
});

test('the deleted user is signed out and cannot come back', async () => {
  await supplier.get('/api/me').expect(401);
  await request(app).post('/api/login').send({ email: 's@t.co', password: 'secret123' }).expect(401);
});
