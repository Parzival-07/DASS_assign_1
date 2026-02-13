const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  messageType: { 
    type: String, 
    enum: ['text', 'link', 'file', 'system'], 
    default: 'text' 
  },
  createdAt: { type: Date, default: Date.now }
});

ChatMessageSchema.index({ teamId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
