const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcrypt');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    
    await createAdminIfNotExists();
  } catch (error) {
    console.log('MongoDB error:', error);
    process.exit(1); 
  }
}

async function createAdminIfNotExists() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('Kavish@0', 10);
      
      const admin = new User({
        email: 'admin@iiit.ac.in',
        password: hashedPassword,
        role: 'admin'
      });
      
      await admin.save();
      console.log('Admin account created: admin@iiit.ac.in / Kavish@0');
    }
  } catch (error) {
    console.log('Error creating admin:', error);
  }
}

module.exports = connectDB;
