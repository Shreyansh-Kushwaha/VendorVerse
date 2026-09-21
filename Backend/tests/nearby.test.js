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

let mongod, vendor;

// Connaught Place, Delhi and a couple of points a known distance away.
const CP = { lat: 28.6315, lng: 77.2167 };

async function makeUser(who) {
  const agent = request.agent(app);
  await agent.post('/api/register').send(who).expect(201);
  await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return agent;
}

async function makeSupplier(name, email, coords) {
  const agent = await makeUser({ name, email, password: 'secret123', userType: 'supplier', location: 'Delhi' });
  await agent.post('/api/suppliers').send({
    location: 'Delhi',
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    inventory: { itemName: 'Onion', quantity: 10, price: 40, category: 'vegetables' },
  }).expect(201);
  return agent;
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Supplier.syncIndexes();
  vendor = await makeUser({ name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Delhi' });
  await makeSupplier('Close By', 'near@t.co', { lat: CP.lat + 0.01, lng: CP.lng });        // ~1 km north
  await makeSupplier('Further Out', 'far@t.co', { lat: CP.lat + 0.2, lng: CP.lng });       // ~22 km north
  await makeSupplier('No Location', 'none@t.co', null);
  await makeSupplier('Another City', 'city@t.co', { lat: 19.076, lng: 72.8777 });          // Mumbai
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

test('near returns only located suppliers, closest first, with distances', async () => {
  const res = await vendor.get('/api/suppliers/near')
    .query({ lat: CP.lat, lng: CP.lng }).expect(200);
  const names = res.body.suppliers.map(s => s.name);
  assert.deepStrictEqual(names, ['Close By', 'Further Out'], 'ordered by distance, no unlocated, nothing 1000 km away');
  const [near, far] = res.body.suppliers;
  assert.ok(near.distanceKm > 0.5 && near.distanceKm < 2, `close supplier ~1 km (got ${near.distanceKm})`);
  assert.ok(far.distanceKm > 15 && far.distanceKm < 30, `far supplier ~22 km (got ${far.distanceKm})`);
  assert.strictEqual(near.items, 1);
});

test('near requires a signed in user and sane coordinates', async () => {
  await request(app).get('/api/suppliers/near').query({ lat: CP.lat, lng: CP.lng }).expect(401);
  await vendor.get('/api/suppliers/near').query({ lat: 91, lng: 0 }).expect(400);
  await vendor.get('/api/suppliers/near').query({ lat: CP.lat }).expect(400);
});

test('the catalog rows carry the supplier coordinates', async () => {
  const res = await vendor.get('/api/items').expect(200);
  const located = res.body.items.find(i => i.supplierName === 'Close By');
  assert.ok(located.geo?.coordinates?.length === 2, 'geo present on a located supplier row');
  const unlocated = res.body.items.find(i => i.supplierName === 'No Location');
  assert.strictEqual(unlocated.geo?.coordinates, undefined, 'absent when never shared');
});
