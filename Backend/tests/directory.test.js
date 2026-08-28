const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');

let mongod;

async function makeSupplier(name, email, location, items) {
  const agent = request.agent(app);
  await agent.post('/api/register').send({
    name, email, password: 'secret123', userType: 'supplier', location,
  }).expect(201);
  await agent.post('/api/login').send({ email, password: 'secret123' }).expect(200);
  for (const item of items) {
    await agent.post('/api/suppliers').send({ location, inventory: item }).expect(201);
  }
  return agent;
}

const veg = (itemName, price = 30) => ({ itemName, quantity: 10, price, category: 'vegetables' });

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await makeSupplier('Azad Traders', 'a@t.co', 'Delhi', [veg('Onion'), veg('Potato'), veg('Tomato'), veg('Garlic')]);
  await makeSupplier('Bharat Fresh', 'b@t.co', 'Mumbai', [veg('Onion')]);
  // Registered but never listed anything — must not get a card.
  const empty = request.agent(app);
  await empty.post('/api/register').send({
    name: 'Silent Supplier', email: 'c@t.co', password: 'secret123', userType: 'supplier', location: 'Pune',
  }).expect(201);
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('the directory is public and lists only suppliers with stock', async () => {
  const res = await request(app).get('/api/suppliers').expect(200);
  const names = res.body.suppliers.map(s => s.name);
  assert.ok(names.includes('Azad Traders') && names.includes('Bharat Fresh'));
  assert.ok(!names.includes('Silent Supplier'), 'no card for an empty inventory');
  assert.strictEqual(res.body.total, 2);
});

test('a card carries the summary the page renders', async () => {
  const res = await request(app).get('/api/suppliers').query({ q: 'azad' }).expect(200);
  assert.strictEqual(res.body.total, 1);
  const [s] = res.body.suppliers;
  assert.strictEqual(s.items, 4);
  assert.deepStrictEqual(s.categories, ['vegetables']);
  assert.deepStrictEqual(s.itemNames, ['Onion', 'Potato', 'Tomato'], 'teaser capped at three');
  assert.strictEqual(s.ratingCount, 0);
  assert.strictEqual(s.rating, null);
});

test('search matches location as well as name', async () => {
  const res = await request(app).get('/api/suppliers').query({ q: 'mumbai' }).expect(200);
  assert.deepStrictEqual(res.body.suppliers.map(s => s.name), ['Bharat Fresh']);
});

test('sorting by items puts the biggest inventory first', async () => {
  const res = await request(app).get('/api/suppliers').query({ sort: 'items' }).expect(200);
  assert.deepStrictEqual(res.body.suppliers.map(s => s.name), ['Azad Traders', 'Bharat Fresh']);
});

test('pagination slices and reports pages', async () => {
  const res = await request(app).get('/api/suppliers').query({ limit: 1, page: 2, sort: 'name' }).expect(200);
  assert.strictEqual(res.body.suppliers.length, 1);
  assert.strictEqual(res.body.suppliers[0].name, 'Bharat Fresh');
  assert.strictEqual(res.body.pages, 2);
});

test('junk queries are refused, not guessed at', async () => {
  await request(app).get('/api/suppliers').query({ sort: 'price' }).expect(400);
  await request(app).get('/api/suppliers').query({ page: 0 }).expect(400);
});
