const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const http = require('node:http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const Notification = require('../models/Notification');

let mongod, supplier, vendor, other, idS, idV, sCookie;

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return [agent, res.body.user._id, res.headers['set-cookie'][0].split(';')[0]];
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  [supplier, idS, sCookie] = await makeUser({ name: 'Imran', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' });
  [vendor, idV] = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' });
  [other] = await makeUser({ name: 'Sunita', email: 'v2@t.co', password: 'secret123', userType: 'vendor', location: 'Pune' });
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

let n = 0;
async function listItem(qty = 20) {
  const res = await supplier.post('/api/suppliers').send({
    location: 'Delhi',
    inventory: { itemName: `Item ${++n}`, quantity: qty, price: 30, unit: 'kg', category: 'others' },
  }).expect(201);
  return res.body.item._id;
}

test('placing an order notifies the supplier not the vendor', async () => {
  await Notification.deleteMany({});
  const itemId = await listItem();
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 4 }).expect(201);

  const forSupplier = await Notification.find({ userId: idS });
  assert.strictEqual(forSupplier.length, 1);
  assert.strictEqual(forSupplier[0].type, 'order_placed');
  assert.match(forSupplier[0].title, /New order from Ramesh/);
  assert.match(forSupplier[0].body, /4 kg Item/);

  assert.strictEqual(await Notification.countDocuments({ userId: idV }), 0, 'the buyer gets nothing');
});

test('a multi line cart to one supplier is a single notification', async () => {
  await Notification.deleteMany({});
  const a = await listItem();
  const b = await listItem();
  const c = await listItem();

  await vendor.post('/api/placeOrders').send({
    items: [
      { supplierId: idS, itemId: a, quantity: 1 },
      { supplierId: idS, itemId: b, quantity: 2 },
      { supplierId: idS, itemId: c, quantity: 3 },
    ],
    deliveryAddress: 'Stall 14',
  }).expect(201);

  const notes = await Notification.find({ userId: idS });
  assert.strictEqual(notes.length, 1, 'one alert, not three');
  assert.match(notes[0].body, /3 items/);
});

test('a status change notifies the vendor', async () => {
  await Notification.deleteMany({});
  const itemId = await listItem();
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 2 }).expect(201);
  await Notification.deleteMany({});

  await supplier.patch(`/api/orders/${placed.body.order._id}/status`).send({ status: 'Accepted' }).expect(200);

  const notes = await Notification.find({ userId: idV });
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].type, 'order_status');
  assert.match(notes[0].title, /has been accepted/);
});

test('a cancellation notifies the supplier', async () => {
  await Notification.deleteMany({});
  const itemId = await listItem();
  const placed = await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 2 }).expect(201);
  await Notification.deleteMany({});

  await vendor.post(`/api/orders/${placed.body.order._id}/cancel`).expect(200);

  const notes = await Notification.find({ userId: idS });
  assert.strictEqual(notes[0].type, 'order_cancelled');
  assert.match(notes[0].body, /stock is back/);
});

test('the feed returns only my notifications with an unread count', async () => {
  await Notification.deleteMany({});
  const itemId = await listItem();
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }).expect(201);

  const mine = await supplier.get('/api/notifications').expect(200);
  assert.strictEqual(mine.body.items.length, 1);
  assert.strictEqual(mine.body.unread, 1);

  const theirs = await other.get('/api/notifications').expect(200);
  assert.strictEqual(theirs.body.items.length, 0);
  assert.strictEqual(theirs.body.unread, 0);
});

test('marking one read clears it from the unread count', async () => {
  const before = await supplier.get('/api/notifications').expect(200);
  const id = before.body.items[0]._id;

  await supplier.post(`/api/notifications/${id}/read`).expect(200);

  const after = await supplier.get('/api/notifications').expect(200);
  assert.strictEqual(after.body.unread, before.body.unread - 1);
});

test('you cannot mark somebody else notification as read', async () => {
  await Notification.deleteMany({});
  const itemId = await listItem();
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }).expect(201);
  const note = await Notification.findOne({ userId: idS });

  await other.post(`/api/notifications/${note._id}/read`).expect(404);
  assert.strictEqual((await Notification.findById(note._id)).read, false, 'still unread');
});

test('read all clears the badge', async () => {
  const itemId = await listItem();
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 1 }).expect(201);

  await supplier.post('/api/notifications/read-all').expect(200);
  const after = await supplier.get('/api/notifications').expect(200);
  assert.strictEqual(after.body.unread, 0);
});

test('the feed is closed to anonymous callers', async () => {
  await request(app).get('/api/notifications').expect(401);
  await request(app).post('/api/notifications/read-all').expect(401);
  await request(app).get('/api/notifications/stream').expect(401);
});

test('a new order is pushed down the live stream', async (t) => {
  await Notification.deleteMany({});
  const server = app.listen(0);
  t.after(() => server.close());
  const port = server.address().port;

  // Open the SSE stream as the supplier and wait for the pushed frame.
  const pushed = new Promise((resolve, reject) => {
    const req = http.get({ port, path: '/api/notifications/stream', headers: { Cookie: sCookie } }, (res) => {
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/event-stream/);
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
        const frame = buf.split('\n\n').find(f => f.startsWith('data: ') && f.length > 12);
        if (frame) { req.destroy(); resolve(JSON.parse(frame.slice(6))); }
      });
    });
    req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
    setTimeout(() => reject(new Error('nothing arrived on the stream within 5s')), 5000);
  });

  await new Promise(r => setTimeout(r, 300)); // let the subscription attach
  const itemId = await listItem();
  await vendor.post('/api/placeOrder').send({ supplierId: idS, itemId, quantity: 7 }).expect(201);

  const note = await pushed;
  assert.strictEqual(note.type, 'order_placed');
  assert.match(note.title, /New order from Ramesh/);
  assert.match(note.body, /7 kg/);
});
