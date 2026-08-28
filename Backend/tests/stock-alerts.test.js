const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const StockAlert = require('../models/StockAlert');

let mongod, supplier, vendor, idS, idV;

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
  [vendor, idV] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

async function listItem(fields) {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: 'Onion', quantity: 0, price: 40, category: 'vegetables', ...fields },
  }).expect(201);
  return res.body.item._id;
}

async function latestNotification(agent, type) {
  const res = await agent.get('/api/notifications').expect(200);
  return res.body.items.find(n => n.type === type);
}

test('watching a listing that does not exist is a 404', async () => {
  await vendor.post('/api/stock-alerts')
    .send({ supplierId: idS, itemId: '0'.repeat(24) }).expect(404);
});

test('a restock notifies the watcher exactly once', async () => {
  const itemId = await listItem({ itemName: 'Paneer' });
  await vendor.post('/api/stock-alerts').send({ supplierId: idS, itemId }).expect(201);
  // Watching twice stays one subscription.
  await vendor.post('/api/stock-alerts').send({ supplierId: idS, itemId }).expect(201);
  assert.strictEqual(await StockAlert.countDocuments({ vendorId: idV, itemId }), 1);

  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ quantity: 20 }).expect(200);

  const note = await latestNotification(vendor, 'stock');
  assert.ok(note, 'vendor got a stock notification');
  assert.match(note.title, /Paneer is back in stock/);

  // The subscription burned on firing — bouncing the stock again stays silent.
  assert.strictEqual(await StockAlert.countDocuments({ itemId }), 0);
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ quantity: 0 }).expect(200);
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ quantity: 30 }).expect(200);
  const res = await vendor.get('/api/notifications').expect(200);
  assert.strictEqual(res.body.items.filter(n => n.type === 'stock').length, 1);
});

test('a supplier topping up an already stocked item fires nothing', async () => {
  const itemId = await listItem({ itemName: 'Ghee', quantity: 10 });
  await vendor.post('/api/stock-alerts').send({ supplierId: idS, itemId }).expect(201);
  await supplier.patch(`/api/suppliers/${idS}/inventory/${itemId}`).send({ quantity: 40 }).expect(200);
  assert.strictEqual(await StockAlert.countDocuments({ itemId }), 1, 'subscription untouched');
});

test('an unwatched bell can be switched off', async () => {
  const itemId = await listItem({ itemName: 'Oil' });
  await vendor.post('/api/stock-alerts').send({ supplierId: idS, itemId }).expect(201);
  await vendor.delete(`/api/stock-alerts/${itemId}`).expect(200);
  assert.strictEqual(await StockAlert.countDocuments({ vendorId: idV, itemId }), 0);
  const list = await vendor.get('/api/stock-alerts').expect(200);
  assert.ok(!list.body.alerts.some(a => String(a.itemId) === String(itemId)));
});

test('the order that crosses the low-water mark warns the supplier', async () => {
  const itemId = await listItem({ itemName: 'Chilli', quantity: 8 });
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 4 }).expect(201);
  const note = await latestNotification(supplier, 'stock');
  assert.ok(note, 'supplier got a low stock warning');
  assert.match(note.title, /Chilli is running low/);
  assert.match(note.body, /4 kg left/);
});

test('selling the last of it says sold out instead', async () => {
  const itemId = await listItem({ itemName: 'Butter', quantity: 6 });
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 6 }).expect(201);
  const res = await supplier.get('/api/notifications').expect(200);
  const note = res.body.items.find(n => n.type === 'stock' && /Butter/.test(n.title));
  assert.ok(note, 'supplier heard about the sell-out');
  assert.match(note.title, /just sold out/);
});
