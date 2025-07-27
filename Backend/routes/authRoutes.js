const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const User = require('../models/user');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/vendors', async (req, res) => {
  try {
    const vendors = await User.find(); 
    res.status(200).json(vendors);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


module.exports = router;
