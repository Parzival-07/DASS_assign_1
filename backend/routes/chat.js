// team chat routes for polling based messaging typing indicators and file sharing
const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const Team = require('../models/Team');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// configure chat file upload storage with size limit and safe filenames
const chatUploadsDir = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(chatUploadsDir)) fs.mkdirSync(chatUploadsDir, { recursive: true });
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadsDir),
  filename: (req, file, cb) => {
    const prefix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${prefix}-${safeName}`);
  }
});
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// in memory stores for online presence and typing indicator tracking
const onlineUsers = {};
const typingUsers = {};
// verify that a user is a member of a team before allowing chat access
const verifyTeamMember = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) return null;
  if (!team.members.some(m => m.toString() === userId)) return null;
  return team;
};

// send a text or link message to the team chat
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { teamId, message, messageType } = req.body;
    if (!teamId || !message?.trim()) {
      return res.status(400).json({ message: 'Team ID and message are required' });
    }

    const team = await verifyTeamMember(teamId, req.user.id);
    if (!team) return res.status(403).json({ message: 'You are not a member of this team' });

    const urlRegex = /https?:\/\/[^\s]+/;
    const detectedType = messageType || (urlRegex.test(message.trim()) ? 'link' : 'text');

    const chatMessage = new ChatMessage({
      teamId,
      userId: req.user.id,
      message: message.trim(),
      messageType: detectedType
    });
    await chatMessage.save();

    await chatMessage.populate('userId', 'firstName lastName email');

    if (!onlineUsers[teamId]) onlineUsers[teamId] = {};
    onlineUsers[teamId][req.user.id] = Date.now();

    if (typingUsers[teamId]) delete typingUsers[teamId][req.user.id];

    // broadcast new message to all team members in real time via socket
    const io = req.app.get('io');
    if (io) io.to(`team:${teamId}`).emit('new-message', { chatMessage });

    res.status(201).json({ message: 'Message sent', chatMessage });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get messages with online status and typing indicators for polling
router.get('/messages/:teamId', authenticateToken, async (req, res) => {
  try {
    const team = await verifyTeamMember(req.params.teamId, req.user.id);
    if (!team) return res.status(403).json({ message: 'You are not a member of this team' });

    const { since, limit } = req.query;
    const query = { teamId: req.params.teamId };

    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    const messages = await ChatMessage.find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit) || 200);

    const teamId = req.params.teamId;
    if (!onlineUsers[teamId]) onlineUsers[teamId] = {};
    onlineUsers[teamId][req.user.id] = Date.now();

    const now = Date.now();
    const online = {};
    if (onlineUsers[teamId]) {
      for (const [uid, lastSeen] of Object.entries(onlineUsers[teamId])) {
        online[uid] = (now - lastSeen) < 30000;
      }
    }

    const typing = [];
    if (typingUsers[teamId]) {
      for (const [uid, ts] of Object.entries(typingUsers[teamId])) {
        if ((now - ts) < 5000 && uid !== req.user.id) {
          typing.push(uid);
        }
      }
    }

    res.json({ messages, online, typing, teamName: team.teamName });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// record typing indicator for a user in a team chat
router.post('/typing', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ message: 'Team ID required' });

    const team = await verifyTeamMember(teamId, req.user.id);
    if (!team) return res.status(403).json({ message: 'Not a team member' });

    if (!typingUsers[teamId]) typingUsers[teamId] = {};
    typingUsers[teamId][req.user.id] = Date.now();

    if (!onlineUsers[teamId]) onlineUsers[teamId] = {};
    onlineUsers[teamId][req.user.id] = Date.now();

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// heartbeat endpoint to maintain online presence without sending messages
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ message: 'Team ID required' });

    if (!onlineUsers[teamId]) onlineUsers[teamId] = {};
    onlineUsers[teamId][req.user.id] = Date.now();

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// count unread messages since a given timestamp for badge display
router.get('/unread/:teamId', authenticateToken, async (req, res) => {
  try {
    const { since } = req.query;
    if (!since) return res.json({ count: 0 });

    const team = await verifyTeamMember(req.params.teamId, req.user.id);
    if (!team) return res.status(403).json({ message: 'Not a team member' });

    const count = await ChatMessage.countDocuments({
      teamId: req.params.teamId,
      createdAt: { $gt: new Date(since) },
      userId: { $ne: req.user.id }
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// upload and share a file in the team chat
router.post('/send-file', authenticateToken, chatUpload.single('file'), async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId || !req.file) {
      return res.status(400).json({ message: 'Team ID and file are required' });
    }

    const team = await verifyTeamMember(teamId, req.user.id);
    if (!team) return res.status(403).json({ message: 'You are not a member of this team' });

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const fileInfo = JSON.stringify({
      url: fileUrl,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const chatMessage = new ChatMessage({
      teamId,
      userId: req.user.id,
      message: fileInfo,
      messageType: 'file'
    });
    await chatMessage.save();
    await chatMessage.populate('userId', 'firstName lastName email');

    if (!onlineUsers[teamId]) onlineUsers[teamId] = {};
    onlineUsers[teamId][req.user.id] = Date.now();

    // broadcast file message to team room in real time
    const io = req.app.get('io');
    if (io) io.to(`team:${teamId}`).emit('new-message', { chatMessage });

    res.status(201).json({ message: 'File shared', chatMessage });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
