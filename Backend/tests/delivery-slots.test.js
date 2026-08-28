const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const { SLOTS } = require('../lib/slots');

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

async function listItem({ name = 'Onion', qty = 50, price = 40 } = {}) {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: name, quantity: qty, price, category: 'vegetables' },
  }).expect(201);
  return res.body.item._id;
}

test('a chosen delivery window is stored on the order', async () => {
  const itemId = await listItem();
  const res = await vendor.post('/api/placeOrder').send({
    supplierId: idS, itemId, quantity: 2, deliverySlot: SLOTS[0],
  }).expect(201);
  assert.strictEqual(res.body.order.deliverySlot, SLOTS[0]);
});

test('leaving the window out means anytime', async () => {
  const itemId = await listItem({ name: 'Tomato' });
  const res = await vendor.post('/api/placeOrder').send({
    supplierId: idS, itemId, quantity: 1,
  }).expect(201);
  assert.strictEqual(res.body.order.deliverySlot, undefined);
});

test('a made-up window is rejected', async () => {
  const itemId = await listItem({ name: 'Paneer' });
  await vendor.post('/api/placeOrder').send({
    supplierId: idS, itemId, quantity: 1, deliverySlot: 'Whenever, honestly',
  }).expect(400);
});

test('bulk checkout carries the window onto every order', async () => {
  const a = await listItem({ name: 'Oil' });
  const b = await listItem({ name: 'Chilli' });
  const res = await vendor.post('/api/placeOrders').send({
    items: [
      { supplierId: idS, itemId: a, quantity: 1 },
      { supplierId: idS, itemId: b, quantity: 1 },
    ],
    deliverySlot: SLOTS[1],
  }).expect(201);
  for (const o of res.body.orders) assert.strictEqual(o.deliverySlot, SLOTS[1]);
});
