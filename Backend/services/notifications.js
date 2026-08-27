const EventEmitter = require('events');
const Notification = require('../models/Notification');
const User = require('../models/user');
const { sendNotificationEmail } = require('./email');

// In process fan out to any dashboards this user currently has open. On a single
// Render instance that is every open tab. If this ever runs on more than one
// instance, this is the piece that needs a shared broker.
const bus = new EventEmitter();
bus.setMaxListeners(0);

const channelFor = (userId) => `user:${userId}`;

// Email is sent in the background. Waiting on SMTP would put seconds onto a
// checkout response, and a mail server being slow must not fail an order.
const inFlightEmails = new Set();

function inBackground(promise) {
  const tracked = promise
    .catch((err) => console.error('[email] send failed:', err.message))
    .finally(() => inFlightEmails.delete(tracked));
  inFlightEmails.add(tracked);
}

// Tests await this instead of sleeping.
async function flushEmails() {
  await Promise.all([...inFlightEmails]);
}

async function notify(userId, { type, title, body, orderId, email = false }) {
  const doc = await Notification.create({ userId, type, title, body, orderId });
  bus.emit(channelFor(userId), doc.toObject());

  if (email) {
    inBackground(
      User.findById(userId).select('email name')
        .then((recipient) => sendNotificationEmail(recipient, { title, body, orderId })),
    );
  }

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

module.exports = { notify, notifySafely, subscribe, flushEmails, bus };
