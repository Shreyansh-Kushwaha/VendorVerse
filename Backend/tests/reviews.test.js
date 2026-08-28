const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const Review = require('../models/Review');

let mongod, supplier, vendor, stranger, idS;

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
  [stranger] = await makeUser({ name: 'Suresh', email: 'x@t.co', password: 'secret123', userType: 'vendor', location: 'Pune' });
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

async function placeOrder() {
  const listed = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 50, price: 40, category: 'vegetables' },
  }).expect(201);
  const res = await vendor.post('/api/placeOrder').send({
    supplierId: idS, itemId: listed.body.item._id, quantity: 2,
  }).expect(201);
  return res.body.order._id;
}

async function deliver(orderId) {
  for (const status of ['Accepted', 'Packed', 'OutForDelivery', 'Delivered']) {
    await supplier.patch(`/api/orders/${orderId}/status`).send({ status }).expect(200);
  }
}

test('an undelivered order cannot be rated', async () => {
  const orderId = await placeOrder();
  const res = await vendor.put(`/api/orders/${orderId}/review`).send({ rating: 5 }).expect(409);
  assert.match(res.body.msg, /delivered/i);
});

test('only the buyer can rate, and only with a sane rating', async () => {
  const orderId = await placeOrder();
  await deliver(orderId);
  await stranger.put(`/api/orders/${orderId}/review`).send({ rating: 5 }).expect(403);
  await supplier.put(`/api/orders/${orderId}/review`).send({ rating: 5 }).expect(403);
  await vendor.put(`/api/orders/${orderId}/review`).send({ rating: 6 }).expect(400);
  await vendor.put(`/api/orders/${orderId}/review`).send({ rating: 0 }).expect(400);
});

test('rating a delivered order works and shows up on the supplier', async () => {
  const orderId = await placeOrder();
  await deliver(orderId);

  const res = await vendor.put(`/api/orders/${orderId}/review`)
    .send({ rating: 4, comment: 'Fresh stock, on time' }).expect(201);
  assert.strictEqual(res.body.review.rating, 4);

  const prof = await vendor.get(`/api/suppliers/${idS}`).expect(200);
  assert.strictEqual(prof.body.rating, 4);
  assert.strictEqual(prof.body.ratingCount, 1);

  const list = await request(app).get(`/api/suppliers/${idS}/reviews`).expect(200);
  assert.strictEqual(list.body.count, 1);
  assert.strictEqual(list.body.reviews[0].vendorName, 'Ramesh');
  assert.strictEqual(list.body.reviews[0].comment, 'Fresh stock, on time');
});

test('rating again edits the review instead of stacking a second one', async () => {
  const orderId = await placeOrder();
  await deliver(orderId);
  await vendor.put(`/api/orders/${orderId}/review`).send({ rating: 2 }).expect(201);
  await vendor.put(`/api/orders/${orderId}/review`).send({ rating: 5, comment: 'Better!' }).expect(200);
  const count = await Review.countDocuments({ orderId });
  assert.strictEqual(count, 1);
  const read = await vendor.get(`/api/orders/${orderId}/review`).expect(200);
  assert.strictEqual(read.body.review.rating, 5);
});

test('the catalog carries the supplier average', async () => {
  const res = await vendor.get('/api/items').expect(200);
  const row = res.body.items.find(i => String(i.supplierId) === String(idS));
  assert.ok(row, 'supplier has rows in the catalog');
  assert.ok(row.rating >= 1 && row.rating <= 5, `rating on the row (got ${row.rating})`);
  assert.ok(row.ratingCount >= 1, 'rating count on the row');
});
