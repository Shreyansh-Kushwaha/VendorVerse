const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { z } = require('zod');
const { registerUser, loginUser, me, logoutUser } = require('../controllers/authController');
const User = require('../models/user');
const Supplier = require('../models/Supplier');
const Notification = require('../models/Notification');
const validate = require('../middleware/validate');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { clearAuthCookie, setAuthCookie } = require('../lib/tokens');
const { sendPasswordResetEmail } = require('../services/email');

const RESET_WINDOW_MS = 60 * 60 * 1000; // one hour
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

router.post('/register',
  validate({
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      userType: z.enum(['vendor', 'supplier']),
      location: z.string().min(1),
      businessName: z.string().optional(),
    }),
  }),
  registerUser,
);

router.post('/login',
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),
  loginUser,
);

// =====================================================================
// Password reset
// =====================================================================
router.post('/forgot-password',
  validate({ body: z.object({ email: z.string().email() }) }),
  async (req, res, next) => {
    try {
      const user = await User.findOne({ email: req.body.email });

      // Always answer the same way. Otherwise this endpoint tells an attacker
      // which email addresses have accounts.
      if (user) {
        const raw = crypto.randomBytes(32).toString('hex');
        user.resetTokenHash = hashToken(raw);
        user.resetTokenExpires = new Date(Date.now() + RESET_WINDOW_MS);
        await user.save();

        const base = (process.env.APP_URL || '').replace(/\/$/, '');
        try {
          await sendPasswordResetEmail(user, `${base}/reset-password?token=${raw}`);
        } catch (err) {
          console.error('[reset] could not send the email:', err.message);
        }
      }

      res.json({ msg: 'If that email has an account, a reset link is on its way.' });
    } catch (err) { next(err); }
  },
);

router.post('/reset-password',
  validate({
    body: z.object({
      token: z.string().min(32).max(128),
      password: z.string().min(6),
    }),
  }),
  async (req, res, next) => {
    try {
      const user = await User.findOne({
        resetTokenHash: hashToken(req.body.token),
        resetTokenExpires: { $gt: new Date() },
      }).select('+resetTokenHash +resetTokenExpires');

      if (!user) {
        return res.status(400).json({ msg: 'That reset link is invalid or has expired' });
      }

      user.password = await bcrypt.hash(req.body.password, 10);
      user.passwordChangedAt = new Date();
      // Single use.
      user.resetTokenHash = undefined;
      user.resetTokenExpires = undefined;
      await user.save();

      res.json({ msg: 'Password updated, you can sign in now' });
    } catch (err) { next(err); }
  },
);

router.get('/me', requireAuth, me);

router.post('/logout', logoutUser);

// =====================================================================
// User: profile update + change password + delete account
// =====================================================================
router.patch('/users/:id',
  requireAuth,
  requireSelf('id'),
  validate({
    params: z.object({ id: objectId }),
    body: z.object({
      name: z.string().min(1).optional(),
      location: z.string().min(1).optional(),
      businessName: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true },
      ).select('-password');
      if (!user) return res.status(404).json({ msg: 'User not found' });
      res.json({ msg: 'Profile updated', user });
    } catch (err) { next(err); }
  },
);

router.patch('/users/:id/password',
  requireAuth,
  requireSelf('id'),
  validate({
    params: z.object({ id: objectId }),
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }),
  }),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ msg: 'User not found' });
      const ok = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!ok) return res.status(401).json({ msg: 'Current password is incorrect' });
      user.password = await bcrypt.hash(req.body.newPassword, 10);
      user.passwordChangedAt = new Date();
      await user.save();

      // Every other session is now stale, so hand this one a fresh cookie.
      setAuthCookie(res, user);
      res.json({ msg: 'Password updated' });
    } catch (err) { next(err); }
  },
);

router.delete('/users/:id',
  requireAuth,
  requireSelf('id'),
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ password: z.string().min(1) }),
  }),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ msg: 'User not found' });
      const ok = await bcrypt.compare(req.body.password, user.password);
      if (!ok) return res.status(401).json({ msg: 'Password is incorrect' });
      // Orders are a shared record. Deleting this account removes the personal
      // details, but the counterparty keeps their own order history.
      await Promise.all([
        Supplier.deleteMany({ supplierId: user._id }),
        Notification.deleteMany({ userId: user._id }),
        User.findByIdAndDelete(user._id),
      ]);
      clearAuthCookie(res);
      res.json({ msg: 'Account deleted' });
    } catch (err) { next(err); }
  },
);

module.exports = router;
