const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');

// This is to POST
router.post('/suppliers', async (req, res) => {
  const { supplierId, name, inventory, location } = req.body;

  if (!name || !inventory || !location) {
    return res.status(400).json({ msg: 'Name and inventory are required' });
  }

  try {
    const newSupplier = new Supplier({supplierId, name, inventory, location });
    await newSupplier.save();
    res.status(201).json({ msg: 'Supplier added', supplier: newSupplier });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


// This is to GET 
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.status(200).json(suppliers);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// trying something
const Order = require("../models/Order");// your Order model
const SupplierData = require("../models/user");

router.get("/orders", async (req, res) => {
  const { supplierId } = req.query;
  console.log("Supplier ID received:", supplierId); // ✅ Log input

  try {
    const orders = await Order.find({ supplierId })
      .populate("vendorId", "name");

    console.log("Orders fetched:", orders); // ✅ Log result
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error); // ✅ Log exact error
    res.status(500).json({ error: "Server Error" });
  }
});




module.exports = router;
