const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');

let mongod, supplier, idS;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Supplier.syncIndexes(), Order.syncIndexes()]);

  supplier = request.agent(app);
  await supplier.post('/api/register')
    .send({ name: 'Imran', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' })
    .expect(201);
  const res = await supplier.post('/api/login').send({ email: 's@t.co', password: 'secret123' }).expect(200);
  idS = res.body.user._id;
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('supplierId is unique so a second doc cannot be inserted', async () => {
  await Supplier.create({ supplierId: idS, name: 'Imran', location: 'Delhi', inventory: [] });
  await assert.rejects(
    () => Supplier.create({ supplierId: idS, name: 'Imran again', location: 'Delhi', inventory: [] }),
    (err) => err.code === 11000,
  );
});

test('concurrent first time adds produce one supplier doc not two', async () => {
  await Supplier.deleteMany({});

  const add = (n) => supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: `Item ${n}`, quantity: 5, price: 10, category: 'others' },
  });

  const results = await Promise.all([add(1), add(2), add(3)]);
  assert.ok(results.every(r => r.status === 201), 'every add should succeed');

  const docs = await Supplier.find({ supplierId: idS });
  assert.strictEqual(docs.length, 1, 'exactly one supplier document');
  assert.strictEqual(docs[0].inventory.length, 3, 'all three items landed on it');
});

test('orders are indexed for the filter and the sort together', async () => {
  const names = (await Order.collection.indexes()).map(i => i.name);
  assert.ok(names.includes('supplierId_1_date_-1'), `missing supplier index, have ${names}`);
  assert.ok(names.includes('vendorId_1_date_-1'), `missing vendor index, have ${names}`);
  assert.ok(!names.includes('supplierId_1'), 'redundant single field index should be gone');
  assert.ok(!names.includes('vendorId_1'), 'redundant single field index should be gone');
});

test('the supplier profile still returns the full catalog', async () => {
  const res = await supplier.get(`/api/suppliers/${idS}`).expect(200);
  assert.strictEqual(res.body.inventory.length, 3);

  const inv = await supplier.get(`/api/suppliers/${idS}/inventory`).expect(200);
  assert.strictEqual(inv.body.length, 3);
});
