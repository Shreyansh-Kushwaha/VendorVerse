const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { registerUser, loginUser } = require('../controllers/authController');
const User = require('../models/user');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const validate = require('../middleware/validate');

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

router.get('/vendors', async (req, res, next) => {
  try {
    const vendors = await User.find().select('-password');
    res.json(vendors);
  } catch (err) { next(err); }
});

// =====================================================================
// User: profile update + change password + delete account
// =====================================================================
router.patch('/users/:id',
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
      await user.save();
      res.json({ msg: 'Password updated' });
    } catch (err) { next(err); }
  },
);

router.delete('/users/:id',
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
      await Promise.all([
        Supplier.deleteMany({ supplierId: user._id }),
        Order.deleteMany({ $or: [{ vendorId: user._id }, { supplierId: user._id }] }),
        User.findByIdAndDelete(user._id),
      ]);
      res.json({ msg: 'Account deleted' });
    } catch (err) { next(err); }
  },
);

module.exports = router;
