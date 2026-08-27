const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';
process.env.APP_URL = 'https://vendorverse.example';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../app');
const email = require('../services/email');
const User = require('../models/user');

let mongod;
let sent = [];
const stubTransport = { sendMail: async (m) => { sent.push(m); return { messageId: 'stub' }; } };

const ACCOUNT = { name: 'Ramesh', email: 'r@t.co', password: 'secret123', userType: 'vendor', location: 'Mumbai' };

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  email.setTransport(undefined);
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  sent = [];
  email.setTransport(stubTransport);
  await User.deleteMany({});
  await request(app).post('/api/register').send(ACCOUNT).expect(201);
});

function tokenFromEmail() {
  const m = sent[0]?.text.match(/reset-password\?token=([a-f0-9]+)/);
  return m?.[1];
}

const forgot = (e) => request(app).post('/api/forgot-password').send({ email: e });
const reset = (token, password) => request(app).post('/api/reset-password').send({ token, password });

test('a reset link is emailed and works once', async () => {
  await forgot(ACCOUNT.email).expect(200);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, ACCOUNT.email);

  const token = tokenFromEmail();
  assert.ok(token, 'the email carries a token');

  await reset(token, 'brandnew123').expect(200);

  await request(app).post('/api/login').send({ email: ACCOUNT.email, password: 'brandnew123' }).expect(200);
  await request(app).post('/api/login').send({ email: ACCOUNT.email, password: ACCOUNT.password }).expect(401);
});

test('the same link cannot be used twice', async () => {
  await forgot(ACCOUNT.email).expect(200);
  const token = tokenFromEmail();

  await reset(token, 'firsttry123').expect(200);
  const second = await reset(token, 'secondtry123');
  assert.strictEqual(second.status, 400);

  await request(app).post('/api/login').send({ email: ACCOUNT.email, password: 'firsttry123' }).expect(200);
});

test('an expired link is refused', async () => {
  await forgot(ACCOUNT.email).expect(200);
  const token = tokenFromEmail();

  await User.updateOne({ email: ACCOUNT.email }, { $set: { resetTokenExpires: new Date(Date.now() - 1000) } });

  const res = await reset(token, 'toolate123');
  assert.strictEqual(res.status, 400);
  assert.match(res.body.msg, /invalid or has expired/);
});

test('a made up token is refused', async () => {
  const res = await reset(crypto.randomBytes(32).toString('hex'), 'nicetry123');
  assert.strictEqual(res.status, 400);
});

test('only the hash of the token is stored', async () => {
  await forgot(ACCOUNT.email).expect(200);
  const raw = tokenFromEmail();

  const stored = await User.findOne({ email: ACCOUNT.email }).select('+resetTokenHash');
  assert.ok(stored.resetTokenHash);
  assert.notStrictEqual(stored.resetTokenHash, raw, 'the raw token must not be in the database');
  assert.strictEqual(stored.resetTokenHash, crypto.createHash('sha256').update(raw).digest('hex'));
});

test('an unknown email gets the same answer and sends nothing', async () => {
  const known = await forgot(ACCOUNT.email).expect(200);
  sent = [];
  const unknown = await forgot('nobody@t.co').expect(200);

  assert.deepStrictEqual(unknown.body, known.body, 'the response must not reveal who has an account');
  assert.strictEqual(sent.length, 0);
});

test('a short new password is refused with a field error', async () => {
  await forgot(ACCOUNT.email).expect(200);
  const res = await reset(tokenFromEmail(), '123');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.errors[0].path, 'password');
});

test('resetting kills sessions that were open beforehand', async () => {
  const agent = request.agent(app);
  await agent.post('/api/login').send({ email: ACCOUNT.email, password: ACCOUNT.password }).expect(200);
  await agent.get('/api/me').expect(200);

  await forgot(ACCOUNT.email).expect(200);
  // The stamp is compared against the token's issued-at, which has one second
  // resolution, so push it forward to represent a later reset.
  await reset(tokenFromEmail(), 'brandnew123').expect(200);
  await User.updateOne({ email: ACCOUNT.email }, { $set: { passwordChangedAt: new Date(Date.now() + 2000) } });

  const res = await agent.get('/api/me');
  assert.strictEqual(res.status, 401, 'the old cookie must stop working');
});

test('changing the password from the profile keeps you signed in', async () => {
  const agent = request.agent(app);
  const login = await agent.post('/api/login').send({ email: ACCOUNT.email, password: ACCOUNT.password }).expect(200);

  const res = await agent.patch(`/api/users/${login.body.user._id}/password`)
    .send({ currentPassword: ACCOUNT.password, newPassword: 'brandnew123' })
    .expect(200);

  assert.ok(res.headers['set-cookie'], 'a fresh session cookie is issued');
  await agent.get('/api/me').expect(200);
});

test('the reset endpoints work with email switched off', async () => {
  email.setTransport(null);
  const res = await forgot(ACCOUNT.email);
  assert.strictEqual(res.status, 200, 'no SMTP must not turn into a 500');
});
