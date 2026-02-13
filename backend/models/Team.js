const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  teamName: { type: String, required: true },
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  maxSize: { type: Number, required: true, min: 2 },
  inviteCode: { type: String, required: true, unique: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  status: { type: String, enum: ['forming', 'complete', 'cancelled'], default: 'forming' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', TeamSchema);
