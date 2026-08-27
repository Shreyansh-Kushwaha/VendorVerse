const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const { flushEmails } = require('../services/notifications');
const User = require('../models/user');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  await flushEmails();
  await mongoose.disconnect();
  await mongod.stop();
});

const VENDOR = { name: 'Ramesh', email: 'v@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' };
const SUPPLIER = { name: 'Imran', email: 's@t.co', password: 'secret123', userType: 'supplier', location: 'Delhi' };
const OTHER_SUPPLIER = { name: 'Asha', email: 's2@t.co', password: 'secret123', userType: 'supplier', location: 'Pune' };

async function signUpAndIn(agent, who) {
  await agent.post('/api/register').send(who).expect(201);
  const res = await agent.post('/api/login').send({ email: who.email, password: who.password }).expect(200);
  return res.body.user;
}

test('register does not sign you in and login sets an httpOnly cookie', async () => {
  const agent = request.agent(app);
  await agent.post('/api/register').send(VENDOR).expect(201);
  await agent.get('/api/me').expect(401);

  const res = await agent.post('/api/login').send({ email: VENDOR.email, password: VENDOR.password }).expect(200);

  const cookie = res.headers['set-cookie'].join(';');
  assert.match(cookie, /vv_token=/);
  assert.match(cookie, /HttpOnly/i, 'session cookie must be httpOnly');
  assert.match(cookie, /SameSite=Lax/i, 'session cookie must be SameSite=Lax');

  await agent.get('/api/me').expect(200);
});

test('login never returns the password hash', async () => {
  const res = await request(app).post('/api/login')
    .send({ email: VENDOR.email, password: VENDOR.password }).expect(200);
  assert.strictEqual(res.body.user.password, undefined);
  assert.ok(!JSON.stringify(res.body).includes('$2'), 'no bcrypt hash anywhere in the response');
});

test('wrong password and unknown email are indistinguishable', async () => {
  const bad = await request(app).post('/api/login').send({ email: VENDOR.email, password: 'wrongwrong' });
  const missing = await request(app).post('/api/login').send({ email: 'nobody@t.co', password: 'wrongwrong' });
  assert.strictEqual(bad.status, missing.status);
  assert.deepStrictEqual(bad.body, missing.body);
});

test('invalid input returns 400 with field errors, not 500', async () => {
  const res = await request(app).post('/api/register')
    .send({ ...VENDOR, email: 'x@t.co', password: '123' }).expect(400);
  assert.strictEqual(res.body.msg, 'Invalid request');
  assert.strictEqual(res.body.errors[0].path, 'password');
});

test('protected routes reject an anonymous caller', async () => {
  await request(app).get('/api/me').expect(401);
  await request(app).patch(`/api/users/${new mongoose.Types.ObjectId()}`).send({ name: 'x' }).expect(401);
});

test('you cannot edit another user via PATCH /api/users/:id', async () => {
  const agent = request.agent(app);
  await signUpAndIn(agent, SUPPLIER);
  const victim = await User.findOne({ email: VENDOR.email });

  const res = await agent.patch(`/api/users/${victim._id}`).send({ name: 'pwned' });
  assert.strictEqual(res.status, 403);

  const stillThere = await User.findById(victim._id);
  assert.strictEqual(stillThere.name, 'Ramesh', 'victim name must be untouched');
});

test('logout clears the session', async () => {
  const agent = request.agent(app);
  await signUpAndIn(agent, OTHER_SUPPLIER);
  await agent.get('/api/me').expect(200);
  await agent.post('/api/logout').expect(200);
  await agent.get('/api/me').expect(401);
});

test('a forged cookie is rejected', async () => {
  await request(app).get('/api/me').set('Cookie', 'vv_token=not.a.real.jwt').expect(401);

  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ sub: String(new mongoose.Types.ObjectId()), userType: 'supplier' }, 'wrong-secret');
  await request(app).get('/api/me').set('Cookie', `vv_token=${forged}`).expect(401);
});

test('a valid token for a deleted account is rejected', async () => {
  const agent = request.agent(app);
  const u = await signUpAndIn(agent, { ...VENDOR, email: 'ghost@t.co' });
  await User.findByIdAndDelete(u._id);
  await agent.get('/api/me').expect(401);
});
