const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';
process.env.APP_URL = 'https://vendorverse.example';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const email = require('../services/email');
const { flushEmails } = require('../services/notifications');

let mongod, supplier, vendor, idS;
let sent = [];

// Stands in for a real SMTP connection so the whole path is exercised without
// anything leaving the machine.
const stubTransport = { sendMail: async (msg) => { sent.push(msg); return { messageId: 'stub' }; } };

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  [supplier, idS] = await makeUser({ name: 'Imran', email: 'imran@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });
  [vendor] = await makeUser({ name: 'Ramesh', email: 'ramesh@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });
});

test.after(async () => {
  email.setTransport(undefined);
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(() => { sent = []; email.setTransport(stubTransport); });

let n = 0;
async function listItem() {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: `Item ${++n}`, quantity: 30, price: 25, unit: 'kg', category: 'others' },
  }).expect(201);
  return res.body.item._id;
}

test('a new order emails the supplier at their registered address', async () => {
  const itemId = await listItem();
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 6 }).expect(201);
  await flushEmails();

  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'imran@t.co');
  assert.match(sent[0].subject, /New order from Ramesh/);
  assert.match(sent[0].text, /6 kg/);
});

test('the email links back to the order', async () => {
  const itemId = await listItem();
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }).expect(201);
  await flushEmails();

  const url = `https://vendorverse.example/orders/${placed.body.order._id}`;
  assert.ok(sent[0].text.includes(url), 'plain text link');
  assert.ok(sent[0].html.includes(url), 'html button link');
});

test('accepted and delivered are emailed but packed is not', async () => {
  const itemId = await listItem();
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }).expect(201);
  await flushEmails();
  sent = [];

  const id = placed.body.order._id;
  await supplier.patch(`/api/orders/${id}/status`).send({ status: 'Accepted' }).expect(200);
  await supplier.patch(`/api/orders/${id}/status`).send({ status: 'Packed' }).expect(200);
  await supplier.patch(`/api/orders/${id}/status`).send({ status: 'OutForDelivery' }).expect(200);
  await supplier.patch(`/api/orders/${id}/status`).send({ status: 'Delivered' }).expect(200);
  await flushEmails();

  const subjects = sent.map(m => m.subject);
  assert.strictEqual(sent.length, 3, `expected 3 mails, got ${subjects.length}: ${subjects}`);
  assert.ok(sent.every(m => m.to === 'ramesh@t.co'), 'all go to the buyer');
  assert.ok(!subjects.some(s => /packed/i.test(s)), 'Packed must not send');
});

test('a cancellation emails the supplier', async () => {
  const itemId = await listItem();
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 2 }).expect(201);
  await flushEmails();
  sent = [];

  await vendor.post(`/api/orders/${placed.body.order._id}/cancel`).expect(200);
  await flushEmails();

  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'imran@t.co');
  assert.match(sent[0].subject, /Ramesh cancelled an order/);
});

test('with SMTP unconfigured nothing is sent and the order still succeeds', async () => {
  email.setTransport(null);
  const itemId = await listItem();

  const res = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 3 });
  await flushEmails();

  assert.strictEqual(res.status, 201, 'the order goes through regardless');
  assert.strictEqual(sent.length, 0);
});

test('an SMTP failure does not break the order', async () => {
  email.setTransport({ sendMail: async () => { throw new Error('mail server on fire'); } });
  const itemId = await listItem();

  const res = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 3 });
  await flushEmails();

  assert.strictEqual(res.status, 201);
  const inApp = await supplier.get('/api/notifications').expect(200);
  assert.ok(inApp.body.items.length > 0, 'the in app notification still landed');
});

test('the rendered email escapes anything a user typed', () => {
  const { html } = email.render({
    title: 'New order from <script>alert(1)</script>',
    body: 'note: "5 kg" & <b>more</b>',
    orderId: null,
  });
  assert.ok(!html.includes('<script>'), 'script tag must be escaped');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp;'));
});
