const User = require('../models/user');
const bcrypt = require('bcryptjs');


// Register Part here... (needs some changes tooo lazy to do now)

const registerUser = async (req, res) => {
  const { name, email, password, userType, location, businessName } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

 
    const hashedPassword = await bcrypt.hash(password, 10);

  
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      userType,
      location,
      businessName
    });

    await newUser.save();
    res.status(201).json({ msg: "User registered successfully" });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

module.exports = { registerUser };

// Login Part here...

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    // ✅ Login successful – send success message
    return res.status(200).json({ msg: "Login successful",
 userType: user.userType,
  user: user});

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

module.exports = { registerUser, loginUser };
