const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Order = require("../models/Order");
const SupplierData = require("../models/user");


// This is to POST
router.post('/suppliers', async (req, res) => {
  const { supplierId, name, inventory, location, imageUrl } = req.body;

  if (!name || !inventory || !location) {
    return res.status(400).json({ msg: 'Name and inventory are required' });
  }

  try {
    const newSupplier = new Supplier({supplierId, name, inventory, location, imageUrl});
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



// This is for orders from vendors to suppliers

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



// This is to update the order Status by the Supplier

router.put( "/orders", async (req, res) => {
  const { supplierId } = req.query;
  const statusString = req.body;
  try {
    const updatedStatus = await Order.findOneAndUpdate( {supplierId: supplierId } ,statusString , {
        new: true, // This option returns the updated document
        runValidators: true // This ensures the new data adheres to your schema rules
      });

    if(!updatedStatus){
      return res.status(404).json({message: 'order not found for this supplierId'});
    }

    res.status(200).json({message: 'Status set Sucessfully '})

  } catch (error) {
    res.status(500).json({message: 'Error Updating' , error: error.message});
  }
});




// This is to GET inventory for a specific supplier
router.get('/suppliers/:supplierId/inventory', async (req, res) => {
  const { supplierId } = req.params;

  try {
    const supplier = await Supplier.find({ supplierId: supplierId });
    if (!supplier) {
      return res.status(404).json({ msg: "Supplier not found" });
    }

    const combinedInventory = supplier.flatMap(supplier => supplier.inventory);
    
    res.status(200).json(combinedInventory); // Return the inventory array
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});





module.exports = router;
