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

let mongod;
let supA, supB, vendor, otherVendor;   // logged-in agents
let idA, idB, idV, idOV;               // their user ids

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login')
    .send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  [supA, idA] = await makeUser({ name: 'Sup A', email: 'a@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });
  [supB, idB] = await makeUser({ name: 'Sup B', email: 'b@t.co', password: 'secret123', userType: 'supplier', location: 'Pune' });
  [vendor, idV] = await makeUser({ name: 'Vend', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });
  [otherVendor, idOV] = await makeUser({ name: 'Vend2', email: 'v2@t.co', password: 'secret123', userType: 'vendor', location: 'Surat' });
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

async function addItem(agent) {
  const res = await agent.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 10, price: 40, category: 'vegetables' },
  }).expect(201);
  return res.body.item._id;
}

test('a supplier can add inventory and it is attributed to them not to a client id', async () => {
  const itemId = await addItem(supA);
  const doc = await Supplier.findOne({ supplierId: idA });
  assert.ok(doc, 'supplier doc created under the session user');
  assert.ok(doc.inventory.id(itemId));
});

test('a vendor cannot add inventory', async () => {
  const res = await vendor.post('/api/suppliers').send({
    location: 'Mumbai',
    inventory: { itemName: 'Sneaky', quantity: 1, price: 1, category: 'others' },
  });
  assert.strictEqual(res.status, 403);
});

test('supplier B cannot edit or delete supplier A inventory', async () => {
  const itemId = await addItem(supA);

  const patch = await supB.patch(`/api/suppliers/${idA}/inventory/${itemId}`).send({ price: 1 });
  assert.strictEqual(patch.status, 403);

  const del = await supB.delete(`/api/suppliers/${idA}/inventory/${itemId}`);
  assert.strictEqual(del.status, 403);

  const doc = await Supplier.findOne({ supplierId: idA });
  assert.strictEqual(doc.inventory.id(itemId).price, 40, 'price must be untouched');
});

test('placing an order ignores any vendorId the client sends', async () => {
  const itemId = await addItem(supA);
  const res = await vendor.post('/api/placeOrder').send({
    vendorId: idOV,                 // attempt to order as somebody else
    supplierId: idA,
    itemId,
    itemName: 'Onion',
    quantity: 2,
    price: 40,
  }).expect(201);

  assert.strictEqual(String(res.body.order.vendorId), String(idV), 'vendor comes from the session');
});

test('a supplier only sees their own orders', async () => {
  const listA = await supA.get('/api/orders').expect(200);
  const listB = await supB.get('/api/orders').expect(200);

  assert.ok(listA.body.length > 0);
  assert.ok(listA.body.every(o => String(o.supplierId) === String(idA)));
  assert.strictEqual(listB.body.length, 0, 'supplier B has no orders of their own');
});

test('a vendor only sees their own orders', async () => {
  const mine = await vendor.get('/api/vendor/orders').expect(200);
  const theirs = await otherVendor.get('/api/vendor/orders').expect(200);
  assert.ok(mine.body.length > 0);
  assert.strictEqual(theirs.body.length, 0);
});

test('a supplier cannot advance somebody else order', async () => {
  const order = await Order.findOne({ supplierId: idA });
  const res = await supB.patch(`/api/orders/${order._id}/status`).send({ status: 'Delivered' });
  assert.strictEqual(res.status, 403);

  const after = await Order.findById(order._id);
  assert.strictEqual(after.status, 'Pending');
});

test('a vendor cannot advance an order status at all', async () => {
  const order = await Order.findOne({ supplierId: idA });
  const res = await vendor.patch(`/api/orders/${order._id}/status`).send({ status: 'Delivered' });
  assert.strictEqual(res.status, 403);
});

test('only the two parties can read an order', async () => {
  const order = await Order.findOne({ supplierId: idA });

  await vendor.get(`/api/orders/${order._id}`).expect(200);   // the buyer
  await supA.get(`/api/orders/${order._id}`).expect(200);     // the seller

  const outsider = await otherVendor.get(`/api/orders/${order._id}`);
  assert.strictEqual(outsider.status, 403);
});

test('analytics are scoped to the session', async () => {
  const a = await supA.get('/api/supplier/analytics').expect(200);
  const b = await supB.get('/api/supplier/analytics').expect(200);
  assert.ok(a.body.totalRevenue > 0);
  assert.strictEqual(b.body.totalRevenue, 0);
});

test('anonymous callers are locked out of every mutating route', async () => {
  const anon = request(app);
  await anon.get('/api/items').expect(401);
  await anon.post('/api/suppliers').send({}).expect(401);
  await anon.post('/api/upload').expect(401);
  await anon.get('/api/orders').expect(401);
  await anon.get('/api/vendor/orders').expect(401);
  await anon.get('/api/vendor/analytics').expect(401);
  await anon.post('/api/placeOrder').send({}).expect(401);
  await anon.post('/api/placeOrders').send({}).expect(401);
  await anon.patch(`/api/orders/${new mongoose.Types.ObjectId()}/status`).send({ status: 'Delivered' }).expect(401);
});
