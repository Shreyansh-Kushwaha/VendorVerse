// Promote an existing account to admin — the only path that mints one.
// Registration refuses the role by schema, so an admin can never be created
// over the wire.
//
//   node scripts/makeAdmin.js someone@example.com
//
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/makeAdmin.js <email of an existing account>');
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set — put it in Backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { userType: 'admin' } },
    { new: true },
  );
  await mongoose.disconnect();

  if (!user) {
    console.error(`No account found for ${email} — sign up first, then promote.`);
    process.exit(1);
  }
  console.log(`${user.name} <${user.email}> is now an admin.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
