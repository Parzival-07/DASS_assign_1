const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    unique: true 
  },
  password: { 
    type: String, 
    required: true
  },
  role: { 
    type: String, 
    required: true,
    enum: ['admin', 'organizer', 'iiit-student', 'non-iiit-student']
  },
  
  firstName: { 
    type: String
  },
  lastName: { 
    type: String
  },
  collegeName: { 
    type: String 
  },
  contactNumber: { 
    type: String
  },
  
  areasOfInterest: [{ 
    type: String 
  }],
  followingClubs: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  onboardingComplete: { 
    type: Boolean, 
    default: false
  },
  
  organizationName: { 
    type: String
  },
  category: { 
    type: String
  },
  description: { 
    type: String
  },
  contactEmail: {
    type: String
  },
  discordWebhook: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false 
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
