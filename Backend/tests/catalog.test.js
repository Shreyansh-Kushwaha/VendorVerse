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

let mongod, supA, supB, vendor, idA, idB;

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  [supA, idA] = await makeUser({ name: 'Imran Traders', email: 'a@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });
  [supB, idB] = await makeUser({ name: 'Asha Produce', email: 'b@t.co', password: 'secret123', userType: 'supplier', location: 'Pune' });
  [vendor] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });

  const stock = async (agent, location, items) => {
    for (const it of items) {
      await agent.post('/api/suppliers').send({ location, inventory: it }).expect(201);
    }
  };
  await stock(supA, 'Delhi', [
    { itemName: 'Onion', quantity: 50, price: 40, unit: 'kg', category: 'vegetables' },
    { itemName: 'Tomato', quantity: 30, price: 55, unit: 'kg', category: 'vegetables' },
    { itemName: 'Turmeric', quantity: 10, price: 300, unit: 'kg', category: 'spices' },
  ]);
  await stock(supB, 'Pune', [
    { itemName: 'Milk', quantity: 40, price: 60, unit: 'L', category: 'dairy' },
    { itemName: 'Onion Red', quantity: 20, price: 45, unit: 'kg', category: 'vegetables' },
  ]);
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

const items = (params) => vendor.get('/api/items').query(params || {});

test('the flat catalog comes back with supplier details attached', async () => {
  const res = await items().expect(200);
  assert.strictEqual(res.body.total, 5);
  assert.strictEqual(res.body.items.length, 5);

  const onion = res.body.items.find(i => i.itemName === 'Onion');
  assert.strictEqual(onion.supplierName, 'Imran Traders');
  assert.strictEqual(String(onion.supplierId), String(idA));
  assert.strictEqual(onion.location, 'Delhi');
  assert.strictEqual(onion.unit, 'kg');
  assert.ok(onion.itemId, 'carries the item id for the cart');
});

test('search matches item names and supplier names', async () => {
  const byItem = await items({ q: 'onion' }).expect(200);
  assert.strictEqual(byItem.body.total, 2, 'Onion and Onion Red');

  const bySupplier = await items({ q: 'asha' }).expect(200);
  assert.strictEqual(bySupplier.body.total, 2, 'everything Asha Produce lists');
  assert.ok(bySupplier.body.items.every(i => i.supplierName === 'Asha Produce'));
});

test('search is not a regex injection', async () => {
  const res = await items({ q: '.*' }).expect(200);
  assert.strictEqual(res.body.total, 0, 'dot star is treated as literal text');
});

test('category narrows the results', async () => {
  const res = await items({ category: 'spices' }).expect(200);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.items[0].itemName, 'Turmeric');
});

test('an unknown category is rejected rather than ignored', async () => {
  const res = await items({ category: 'gemstones' });
  assert.strictEqual(res.status, 400);
});

test('filters combine', async () => {
  const res = await items({ q: 'onion', category: 'vegetables' }).expect(200);
  assert.strictEqual(res.body.total, 2);
});

test('paging returns stable non overlapping slices', async () => {
  const p1 = await items({ limit: 2, page: 1 }).expect(200);
  const p2 = await items({ limit: 2, page: 2 }).expect(200);
  const p3 = await items({ limit: 2, page: 3 }).expect(200);

  assert.strictEqual(p1.body.pages, 3);
  assert.strictEqual(p1.body.total, 5);
  assert.strictEqual(p1.body.items.length, 2);
  assert.strictEqual(p3.body.items.length, 1);

  const names = [...p1.body.items, ...p2.body.items, ...p3.body.items].map(i => i.itemName);
  assert.strictEqual(new Set(names).size, 5, 'no duplicates and nothing skipped');
});

test('the supplier filter backs the favourites toggle', async () => {
  const res = await items({ suppliers: String(idB) }).expect(200);
  assert.strictEqual(res.body.total, 2);
  assert.ok(res.body.items.every(i => String(i.supplierId) === String(idB)));

  const both = await items({ suppliers: `${idA},${idB}` }).expect(200);
  assert.strictEqual(both.body.total, 5);
});

test('an empty supplier filter means none, not everything', async () => {
  const res = await items({ suppliers: '' }).expect(200);
  assert.strictEqual(res.body.total, 0, 'favourites with nothing favourited shows nothing');
});

test('the payload is capped no matter what the client asks for', async () => {
  const res = await items({ limit: 5000 });
  assert.strictEqual(res.status, 400, 'an absurd limit is refused');
});

test('the old full catalog dump is gone', async () => {
  await vendor.get('/api/suppliers').expect(404);
});

test('the catalog needs a session', async () => {
  await request(app).get('/api/items').expect(401);
});

test('stock levels in the catalog reflect real inventory', async () => {
  const before = await items({ q: 'Turmeric' }).expect(200);
  assert.strictEqual(before.body.items[0].quantity, 10);

  await vendor.post('/api/placeOrder')
    .send({ supplierId: idA, itemId: before.body.items[0].itemId, quantity: 4 }).expect(201);
  await flushEmails();

  const after = await items({ q: 'Turmeric' }).expect(200);
  assert.strictEqual(after.body.items[0].quantity, 6);
});

test('one supplier document still holds everything they list', async () => {
  assert.strictEqual(await Supplier.countDocuments({ supplierId: idA }), 1);
  assert.strictEqual(await Supplier.countDocuments({ supplierId: idB }), 1);
});
