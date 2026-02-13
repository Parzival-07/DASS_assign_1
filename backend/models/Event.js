const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  eventDescription: { type: String, required: true },
  eventType: { type: String, enum: ['normal', 'merchandise'], required: true },
  status: { type: String, enum: ['draft', 'published', 'ongoing', 'completed', 'closed'], default: 'draft' },
  eligibility: { type: String, required: true },
  registrationDeadline: { type: Date, required: true },
  eventStartDate: { type: Date, required: true },
  eventEndDate: { type: Date, required: true },
  registrationLimit: { type: Number, required: true },
  registrationFee: { type: Number, default: 0 },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventTags: [String],
  formLocked: { type: Boolean, default: false }, 

  teamBased: { type: Boolean, default: false },
  minTeamSize: { type: Number, default: 2 },
  maxTeamSize: { type: Number, default: 4 },
  
  customForm: [{
    fieldName: String,
    fieldType: String, 
    required: Boolean,
    options: [String] 
  }],
  
  itemDetails: {
    sizes: [String], 
    colors: [String], 
    variants: [String], 
    stockQuantity: { type: Number, default: 0 },
    purchaseLimitPerParticipant: { type: Number, default: 1 }
  },

  currentRegistrations: { type: Number, default: 0 },

  publishedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);
