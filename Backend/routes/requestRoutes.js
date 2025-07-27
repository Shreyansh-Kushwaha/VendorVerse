const express = require('express');
const router = express.Router();
const { createRequest } = require('../controllers/requestController');
const Request = require('../models/Request');
const Order = require('../models/Order');

router.get("/vendor/request", async (req, res) => {
  try {
    const { vendorId } = req.query;
    const orders = await Request.find({ vendorId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


//POST
router.post('/vendor/request', createRequest);


// 


// to place order api
router.post('/placeOrder', async (req, res) => {
  try {
    const { vendorId, supplierId, itemId, itemName, quantity, price } = req.body;
    const order = new Order({ vendorId, supplierId, itemId, itemName, quantity, price });
    await order.save();
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error placing order' });
  }
});




module.exports = router;
