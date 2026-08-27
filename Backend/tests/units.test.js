const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { UNITS } = require('../lib/units');

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
  await mongoose.disconnect();
  await mongod.stop();
});

const list = (item) => supplier.post('/api/suppliers').send({ location: 'Delhi', inventory: item });

test('an item can be listed in any supported unit', async () => {
  for (const unit of UNITS) {
    const res = await list({ itemName: `Thing ${unit}`, quantity: 5, price: 10, unit, category: 'others' }).expect(201);
    assert.strictEqual(res.body.item.unit, unit);
  }
});

test('unit defaults to kg when the supplier does not pick one', async () => {
  const res = await list({ itemName: 'Unspecified', quantity: 5, price: 10, category: 'others' }).expect(201);
  assert.strictEqual(res.body.item.unit, 'kg');
});

test('a made up unit is refused with a 400', async () => {
  const res = await list({ itemName: 'Bad', quantity: 5, price: 10, unit: 'truckload', category: 'others' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.errors[0].path, 'inventory.unit');
});

test('an order snapshots the unit off the listing', async () => {
  const listed = await list({ itemName: 'Milk', quantity: 20, price: 60, unit: 'L', category: 'dairy' }).expect(201);
  const res = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId: listed.body.item._id, quantity: 3 }).expect(201);

  assert.strictEqual(res.body.order.unit, 'L');
  assert.strictEqual(res.body.order.price, 60);
});

test('an out of stock message names the unit', async () => {
  const listed = await list({ itemName: 'Eggs', quantity: 2, price: 90, unit: 'dozen', category: 'others' }).expect(201);
  const res = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId: listed.body.item._id, quantity: 5 });

  assert.strictEqual(res.status, 409);
  assert.match(res.body.msg, /Only 2 dozen left of Eggs, you asked for 5 dozen/);
});

test('a supplier can relist an item in a different unit', async () => {
  const listed = await list({ itemName: 'Rice', quantity: 10, price: 50, unit: 'kg', category: 'grains' }).expect(201);
  const res = await supplier
    .patch(`/api/suppliers/${idS}/inventory/${listed.body.item._id}`)
    .send({ unit: 'sack', price: 2400 }).expect(200);

  assert.strictEqual(res.body.item.unit, 'sack');
  assert.strictEqual(res.body.item.price, 2400);
});

test('changing the listing unit does not rewrite past orders', async () => {
  const listed = await list({ itemName: 'Sugar', quantity: 50, price: 45, unit: 'kg', category: 'grains' }).expect(201);
  const placed = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId: listed.body.item._id, quantity: 2 }).expect(201);

  await supplier.patch(`/api/suppliers/${idS}/inventory/${listed.body.item._id}`)
    .send({ unit: 'sack', price: 2000 }).expect(200);

  const after = await vendor.get(`/api/orders/${placed.body.order._id}`).expect(200);
  assert.strictEqual(after.body.unit, 'kg', 'the order keeps the unit it was placed in');
  assert.strictEqual(after.body.price, 45);
});
