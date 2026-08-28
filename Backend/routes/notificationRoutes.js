const express = require('express');
const router = express.Router();
const { z } = require('zod');
const Notification = require('../models/Notification');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { subscribe } = require('../services/notifications');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Live feed. EventSource cannot set headers, but it does send same origin
// cookies, which is exactly how this app authenticates.
router.get('/notifications/stream', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop a reverse proxy from buffering the stream
  });
  res.flushHeaders();
  res.write('event: ready\ndata: {}\n\n');

  const unsubscribe = subscribe(req.user._id, (note) => {
    res.write(`data: ${JSON.stringify(note)}\n\n`);
  });

  // Comment frames keep idle proxies from closing the connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

router.get('/notifications',
  requireAuth,
  validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }) }),
  async (req, res, next) => {
    try {
      const [items, unread] = await Promise.all([
        Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(req.query.limit).lean(),
        Notification.countDocuments({ userId: req.user._id, read: false }),
      ]);
      res.json({ items, unread });
    } catch (err) { next(err); }
  },
);

router.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const { modifiedCount } = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } },
    );
    res.json({ msg: 'All caught up', updated: modifiedCount });
  } catch (err) { next(err); }
});

router.post('/notifications/:id/read',
  requireAuth,
  validate({ params: z.object({ id: objectId }) }),
  async (req, res, next) => {
    try {
      // Scoping the filter by userId is what stops one user marking another's.
      const note = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { $set: { read: true } },
        { new: true },
      );
      if (!note) return res.status(404).json({ msg: 'Notification not found' });
      res.json({ msg: 'Marked read', notification: note });
    } catch (err) { next(err); }
  },
);

module.exports = router;
