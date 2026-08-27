const EventEmitter = require('events');
const Notification = require('../models/Notification');

// In process fan out to any dashboards this user currently has open. On a single
// Render instance that is every open tab. If this ever runs on more than one
// instance, this is the piece that needs a shared broker.
const bus = new EventEmitter();
bus.setMaxListeners(0);

const channelFor = (userId) => `user:${userId}`;

async function notify(userId, { type, title, body, orderId }) {
  const doc = await Notification.create({ userId, type, title, body, orderId });
  bus.emit(channelFor(userId), doc.toObject());
  return doc;
}

// Notifying must never take down the thing that triggered it.
async function notifySafely(userId, payload) {
  try {
    return await notify(userId, payload);
  } catch (err) {
    console.error('[notify] failed for', String(userId), err.message);
    return null;
  }
}

function subscribe(userId, listener) {
  const channel = channelFor(userId);
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

module.exports = { notify, notifySafely, subscribe, bus };
