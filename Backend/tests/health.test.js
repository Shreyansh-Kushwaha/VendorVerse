const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../app');

let mongod;

test('health reports degraded with a 503 while the database is down', async () => {
  assert.notStrictEqual(mongoose.connection.readyState, 1);
  const res = await request(app).get('/api/health').expect(503);
  assert.strictEqual(res.body.status, 'degraded');
});

test('health reports ok once the database is up', async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const res = await request(app).get('/api/health').expect(200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(res.body.db, 'connected');

  await mongoose.disconnect();
  await mongod.stop();
});
