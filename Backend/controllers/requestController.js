const Request = require('../models/Request');

const createRequest = async (req, res) => {
  console.log("Request body:", req.body); 

  const { vendorId, items, notes } = req.body || {};
  if (!vendorId || !items) {
    return res.status(400).json({ msg: "vendorId and items are required" });
  }

  try {
    const newRequest = new Request({ vendorId, items, notes });
    await newRequest.save();
    res.status(201).json({ msg: 'Request created successfully', request: newRequest });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};


module.exports = { createRequest };
