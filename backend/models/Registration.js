const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketId: { type: String, required: true, unique: true },
  eventType: { type: String, enum: ['normal', 'merchandise'], required: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' },
  attendance: { type: Boolean, default: false }, 
  attendanceMarkedAt: { type: Date }, 
  attendanceMethod: { type: String, enum: ['manual', 'qr-scan'], default: 'manual' },

  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  
  selectedSize: String,
  selectedColor: String,
  selectedVariant: String,
  quantity: { type: Number, default: 1 },
  
  customFormData: { type: Map, of: mongoose.Schema.Types.Mixed }, 
  
  teamName: String,
  
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Registration', RegistrationSchema);
