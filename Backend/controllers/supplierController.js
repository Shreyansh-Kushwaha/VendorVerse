
const Supplier = require('../models/Supplier');

const getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

module.exports = { getAllSuppliers };
