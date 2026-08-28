const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');

let mongod, vendor, supplier, supplierId;

const realFetch = global.fetch;

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id];
}

async function listItem(itemName, price) {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName, quantity: 100, price, category: 'vegetables' },
  }).expect(201);
  return res.body.item._id;
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  [vendor] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi' });
  [supplier, supplierId] = await makeUser({ name: 'Azad Traders', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });

  const onion = await listItem('onion', 40);
  const paneer = await listItem('Paneer', 300);

  // ₹400 of onion, ₹900 of paneer, and a cancelled order that must count for zero.
  await vendor.post('/api/placeOrder').send({ supplierId, itemId: onion, quantity: 10 }).expect(201);
  await vendor.post('/api/placeOrder').send({ supplierId, itemId: paneer, quantity: 3 }).expect(201);
  const cancelled = await vendor.post('/api/placeOrder').send({ supplierId, itemId: onion, quantity: 5 }).expect(201);
  await vendor.post(`/api/orders/${cancelled.body.order._id}/cancel`).expect(200);

  // Agmarknet, stubbed: onions trade at ₹27/kg wholesale.
  global.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({
      records: [{
        market: 'Azadpur', district: 'Delhi', state: 'Delhi', variety: 'Red',
        arrival_date: '28/08/2026', min_price: '2000', max_price: '3000', modal_price: '2700',
      }],
    }),
  });
});

test.after(async () => {
  global.fetch = realFetch;
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('insights reduce the history and ignore cancelled money', async () => {
  const res = await vendor.get('/api/vendor/insights').expect(200);
  assert.strictEqual(res.body.totalSpend, 1300, '10×40 + 3×300, cancelled order worth 0');
  assert.strictEqual(res.body.totalOrders, 3);
  assert.strictEqual(res.body.activeOrders, 2);
  assert.strictEqual(res.body.supplierCount, 1);
  assert.strictEqual(res.body.avgOrderValue, 650);
});

test('top items lead with the biggest spend and carry the mandi comparison', async () => {
  const res = await vendor.get('/api/vendor/insights').expect(200);
  const [paneer, onion] = res.body.topItems;
  assert.strictEqual(paneer.name, 'Paneer');
  assert.strictEqual(paneer.spend, 900);
  assert.strictEqual(onion.name, 'onion');
  assert.strictEqual(onion.qty, 10, 'the cancelled 5 kg never counted');
  assert.strictEqual(onion.paidPerKg, 40);
  assert.strictEqual(onion.mandiPerKg, 27, 'stubbed Agmarknet median attached');
});

test('this week of spending lands in the last weekly bucket', async () => {
  const res = await vendor.get('/api/vendor/insights').expect(200);
  assert.strictEqual(res.body.weekly.length, 8);
  assert.strictEqual(res.body.weekly.at(-1).spend, 1300, 'everything was bought just now');
  assert.strictEqual(res.body.weekly[0].spend, 0, 'quiet weeks still get a bar');
});

test('top suppliers arrive named, biggest first', async () => {
  const res = await vendor.get('/api/vendor/insights').expect(200);
  assert.deepStrictEqual(
    res.body.topSuppliers.map(s => ({ name: s.name, spend: s.spend, orders: s.orders })),
    [{ name: 'Azad Traders', spend: 1300, orders: 2 }],
  );
});

test('insights are the vendor\'s own — suppliers and anonymous callers are refused', async () => {
  await request(app).get('/api/vendor/insights').expect(401);
  await supplier.get('/api/vendor/insights').expect(403);
});

test('a dead mandi upstream does not take the page down', async () => {
  global.fetch = async () => { throw new Error('network down'); };
  // The onion answer above is cached; a fresh vendor forces a fresh mandi call.
  const [v2] = await makeUser({ name: 'Sunita', email: 'v2@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi' });
  const tomato = await listItem('Tomato', 25);
  await v2.post('/api/placeOrder').send({ supplierId, itemId: tomato, quantity: 4 }).expect(201);

  const res = await v2.get('/api/vendor/insights').expect(200);
  assert.strictEqual(res.body.topItems[0].name, 'Tomato');
  assert.strictEqual(res.body.topItems[0].mandiPerKg, undefined, 'no comparison, no crash');
});
