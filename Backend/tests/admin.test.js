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

let mongod, admin, vendor, supplier, supplierId, vendorId, itemId, orderId;

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  [vendor, vendorId] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi' });
  [supplier, supplierId] = await makeUser({ name: 'Azad Traders', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });

  // The only way to mint an admin: promote an existing account in the
  // database, exactly what scripts/makeAdmin.js does.
  await makeUser({ name: 'The Admin', email: 'a@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi' });
  await User.updateOne({ email: 'a@t.co' }, { $set: { userType: 'admin' } });
  admin = request.agent(app);
  await admin.post('/api/login').send({ email: 'a@t.co', password: 'secret123' }).expect(200);

  // One listing, one delivered order, one review — the fixtures moderation acts on.
  const listed = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 50, price: 40, category: 'vegetables' },
  }).expect(201);
  itemId = listed.body.item._id;

  const placed = await vendor.post('/api/placeOrder').send({ supplierId, itemId, quantity: 5 }).expect(201);
  orderId = placed.body.order._id;
  for (const status of ['Accepted', 'Packed', 'OutForDelivery', 'Delivered']) {
    await supplier.patch(`/api/orders/${orderId}/status`).send({ status }).expect(200);
  }
  await vendor.put(`/api/orders/${orderId}/review`).send({ rating: 1, comment: 'terrible spam review' }).expect(201);
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('nobody can register as an admin', async () => {
  await request(app).post('/api/register').send({
    name: 'Sneaky', email: 'x@t.co', password: 'secret123', userType: 'admin', location: 'Delhi',
  }).expect(400);
});

test('the admin surface refuses everyone but an admin', async () => {
  await request(app).get('/api/admin/overview').expect(401);
  await vendor.get('/api/admin/overview').expect(403);
  await supplier.get('/api/admin/users').expect(403);
  await vendor.patch(`/api/admin/users/${supplierId}/suspend`).send({ suspended: true }).expect(403);
});

test('the overview reduces the whole marketplace', async () => {
  const res = await admin.get('/api/admin/overview').expect(200);
  assert.strictEqual(res.body.users.vendors, 1);
  assert.strictEqual(res.body.users.suppliers, 1);
  assert.strictEqual(res.body.users.admins, 1);
  assert.strictEqual(res.body.stockedSuppliers, 1);
  assert.strictEqual(res.body.orders, 1);
  assert.strictEqual(res.body.gmv, 200, '5 kg × ₹40');
  assert.strictEqual(res.body.ordersByStatus.Delivered, 1);
  assert.strictEqual(res.body.reviews, 1);
  assert.strictEqual(res.body.recentUsers.length, 3);
});

test('the user list searches and filters, and never leaks a hash', async () => {
  const all = await admin.get('/api/admin/users').expect(200);
  assert.strictEqual(all.body.total, 3);
  for (const u of all.body.users) assert.strictEqual(u.password, undefined);

  const suppliers = await admin.get('/api/admin/users').query({ role: 'supplier' }).expect(200);
  assert.deepStrictEqual(suppliers.body.users.map(u => u.name), ['Azad Traders']);

  const byEmail = await admin.get('/api/admin/users').query({ q: 'v@t.co' }).expect(200);
  assert.deepStrictEqual(byEmail.body.users.map(u => u.name), ['Ramesh']);
});

test('suspension closes the door everywhere, and restore reopens it', async () => {
  await admin.patch(`/api/admin/users/${supplierId}/suspend`).send({ suspended: true }).expect(200);

  // The live session dies on its next request, not at the next login.
  await supplier.get('/api/orders').expect(403);

  // A fresh login is refused with the password verified first.
  const login = await request(app).post('/api/login')
    .send({ email: 's@t.co', password: 'secret123' }).expect(403);
  assert.match(login.body.msg, /suspended/i);

  // And their shelf cannot be sold from.
  const refused = await vendor.post('/api/placeOrder')
    .send({ supplierId, itemId, quantity: 1 }).expect(403);
  assert.match(refused.body.msg, /unavailable/i);

  await admin.patch(`/api/admin/users/${supplierId}/suspend`).send({ suspended: false }).expect(200);
  await request(app).post('/api/login').send({ email: 's@t.co', password: 'secret123' }).expect(200);
  await supplier.get('/api/orders').expect(200);
  await vendor.post('/api/placeOrder').send({ supplierId, itemId, quantity: 1 }).expect(201);
});

test('an admin cannot be suspended from the dashboard', async () => {
  const me = await User.findOne({ email: 'a@t.co' });
  await admin.patch(`/api/admin/users/${me._id}/suspend`).send({ suspended: true }).expect(403);
});

test('moderation: a review disappears and the rating recomputes', async () => {
  const listed = await admin.get('/api/admin/reviews').expect(200);
  assert.strictEqual(listed.body.total, 1);
  assert.strictEqual(listed.body.reviews[0].vendorId.name, 'Ramesh');
  assert.match(listed.body.reviews[0].comment, /spam/);

  await admin.delete(`/api/admin/reviews/${listed.body.reviews[0]._id}`).expect(200);
  const profile = await request(app).get(`/api/suppliers/${supplierId}`).expect(200);
  assert.strictEqual(profile.body.rating, null, 'the one-star hit is gone');
  await admin.delete(`/api/admin/reviews/${listed.body.reviews[0]._id}`).expect(404);
});

test('moderation: a listing can be pulled from the shelf', async () => {
  await admin.delete(`/api/admin/listings/${supplierId}/${itemId}`).expect(200);
  const inv = await request(app).get(`/api/suppliers/${supplierId}/inventory`).expect(200);
  assert.strictEqual(inv.body.length, 0);
  await admin.delete(`/api/admin/listings/${supplierId}/${itemId}`).expect(404);
});
