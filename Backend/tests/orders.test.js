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

async function listItem({ name = 'Onion', qty = 10, price = 40 } = {}) {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: name, quantity: qty, price, category: 'vegetables' },
  }).expect(201);
  return res.body.item._id;
}

async function stockOf(itemId) {
  const doc = await Supplier.findOne({ supplierId: idS, 'inventory._id': itemId });
  return doc.inventory.id(itemId).quantity;
}

test('the server uses the listed price and ignores whatever the client sends', async () => {
  const itemId = await listItem({ name: 'Tomato', qty: 10, price: 55 });

  const res = await vendor.post('/api/placeOrder').send({
    supplierId: idS, itemId, quantity: 2,
    price: 0,                 // free tomatoes, please
    itemName: 'Gold bar',     // and relabel them
  }).expect(201);

  assert.strictEqual(res.body.order.price, 55, 'price comes from the listing');
  assert.strictEqual(res.body.order.itemName, 'Tomato', 'name comes from the listing');
});

test('placing an order decrements stock by exactly the amount ordered', async () => {
  const itemId = await listItem({ name: 'Potato', qty: 10 });
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 3 }).expect(201);
  assert.strictEqual(await stockOf(itemId), 7);
});

test('you cannot order more than is in stock', async () => {
  const itemId = await listItem({ name: 'Ginger', qty: 5 });

  const res = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 6 });
  assert.strictEqual(res.status, 409);
  assert.match(res.body.msg, /Only 5 kg left of Ginger/);

  assert.strictEqual(await stockOf(itemId), 5, 'a rejected order must not touch stock');
  assert.strictEqual(await Order.countDocuments({ itemId }), 0, 'no order row written');
});

test('a partly unfulfillable cart writes nothing and restores stock', async () => {
  const ok = await listItem({ name: 'Chilli', qty: 10 });
  const short = await listItem({ name: 'Garlic', qty: 1 });

  const res = await vendor.post('/api/placeOrders').send({
    items: [
      { supplierId: idS, itemId: ok, quantity: 4 },
      { supplierId: idS, itemId: short, quantity: 9 },   // this one fails
    ],
  });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(await stockOf(ok), 10, 'the first line must be rolled back');
  assert.strictEqual(await stockOf(short), 1);
  assert.strictEqual(await Order.countDocuments({ itemId: ok }), 0, 'no partial order');
});

test('a whole cart succeeds together', async () => {
  const a = await listItem({ name: 'Coriander', qty: 10, price: 20 });
  const b = await listItem({ name: 'Mint', qty: 10, price: 15 });

  const res = await vendor.post('/api/placeOrders').send({
    items: [
      { supplierId: idS, itemId: a, quantity: 2 },
      { supplierId: idS, itemId: b, quantity: 3 },
    ],
  }).expect(201);

  assert.strictEqual(res.body.count, 2);
  assert.strictEqual(await stockOf(a), 8);
  assert.strictEqual(await stockOf(b), 7);
});

test('rejecting an order gives the stock back and cannot be repeated', async () => {
  const itemId = await listItem({ name: 'Lemon', qty: 10 });
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 4 }).expect(201);
  assert.strictEqual(await stockOf(itemId), 6);

  await supplier.patch(`/api/orders/${placed.body.order._id}/status`).send({ status: 'Rejected' }).expect(200);
  assert.strictEqual(await stockOf(itemId), 10, 'stock returned');

  // Rejected is terminal, so the second attempt is refused outright.
  await supplier.patch(`/api/orders/${placed.body.order._id}/status`).send({ status: 'Rejected' }).expect(409);
  assert.strictEqual(await stockOf(itemId), 10, 'a second reject must not inflate stock');
});

test('delivering an order does not give stock back', async () => {
  const itemId = await listItem({ name: 'Beans', qty: 10 });
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 4 }).expect(201);

  for (const status of ['Accepted', 'Packed', 'OutForDelivery', 'Delivered']) {
    await supplier.patch(`/api/orders/${placed.body.order._id}/status`).send({ status }).expect(200);
  }
  assert.strictEqual(await stockOf(itemId), 6);
});

test('two vendors racing for the last unit cannot both win', async () => {
  const itemId = await listItem({ name: 'Saffron', qty: 1 });

  const results = await Promise.all([
    vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }),
    vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }),
  ]);

  const created = results.filter(r => r.status === 201);
  const refused = results.filter(r => r.status === 409);
  assert.strictEqual(created.length, 1, 'exactly one order goes through');
  assert.strictEqual(refused.length, 1);
  assert.strictEqual(await stockOf(itemId), 0, 'stock cannot go negative');
});

test('ordering an item that is no longer listed is a 404', async () => {
  const res = await vendor.post('/api/placeOrder').send({
    supplierId: idS, itemId: String(new mongoose.Types.ObjectId()), quantity: 1,
  });
  assert.strictEqual(res.status, 404);
});

test('the delivery address and notes from checkout are stored on every order', async () => {
  const a = await listItem({ name: 'Curry leaf', qty: 10 });
  const b = await listItem({ name: 'Turmeric', qty: 10 });

  const res = await vendor.post('/api/placeOrders').send({
    items: [
      { supplierId: idS, itemId: a, quantity: 1 },
      { supplierId: idS, itemId: b, quantity: 1 },
    ],
    deliveryAddress: 'Stall 14, near Dadar station',
    notes: 'deliver before 8 AM',
  }).expect(201);

  assert.strictEqual(res.body.orders.length, 2);
  for (const o of res.body.orders) {
    assert.strictEqual(o.deliveryAddress, 'Stall 14, near Dadar station');
    assert.strictEqual(o.notes, 'deliver before 8 AM');
  }
});

test('a blank address falls back to the vendor profile location', async () => {
  const itemId = await listItem({ name: 'Cardamom', qty: 10 });
  const res = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId, quantity: 1, deliveryAddress: '   ' }).expect(201);
  assert.strictEqual(res.body.order.deliveryAddress, 'Mumbai');
});

test('the supplier sees the address on their incoming orders', async () => {
  const itemId = await listItem({ name: 'Clove', qty: 10 });
  await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId, quantity: 1, deliveryAddress: 'Shop 9, Andheri' }).expect(201);

  const list = await supplier.get('/api/orders').expect(200);
  const mine = list.body.find(o => o.itemName === 'Clove');
  assert.strictEqual(mine.deliveryAddress, 'Shop 9, Andheri');
});

test('an order can be read back with its address', async () => {
  const itemId = await listItem({ name: 'Bay leaf', qty: 10 });
  const placed = await vendor.post('/api/placeOrder')
    .send({ supplierId: idS, itemId, quantity: 1, deliveryAddress: 'Lane 3, Pune', notes: 'ring the bell' }).expect(201);

  const res = await vendor.get(`/api/orders/${placed.body.order._id}`).expect(200);
  assert.strictEqual(res.body.deliveryAddress, 'Lane 3, Pune');
  assert.strictEqual(res.body.notes, 'ring the bell');
});
