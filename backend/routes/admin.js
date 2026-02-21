// admin routes for organizer account management and system statistics
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Team = require('../models/Team');
const ChatMessage = require('../models/ChatMessage');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// helper to auto generate credentials for new organizer accounts
const generatePassword = () => crypto.randomBytes(8).toString('hex');

const generateEmail = (orgName) => {
  const sanitized = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = crypto.randomBytes(2).toString('hex');
  return `${sanitized}.${random}@organizer.events.com`;
};

// create a new organizer account with optional auto generated credentials
router.post('/create-organizer', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { organizationName, category, description, autoGenerate } = req.body;
    let { email, password } = req.body;

    if (!organizationName) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    if (autoGenerate) {
      email = generateEmail(organizationName);
      password = generatePassword();
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const organizer = new User({
      email,
      password: hashedPassword,
      role: 'organizer',
      organizationName,
      category: category || '',
      description: description || '',
      isActive: true
    });

    await organizer.save();

    res.status(201).json({
      message: 'Organizer account created successfully',
      organizer: {
        id: organizer._id,
        email: organizer.email,
        role: organizer.role,
        organizationName: organizer.organizationName,
        category: organizer.category,
        description: organizer.description
      },
      credentials: autoGenerate ? { email, password } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// list all organizers with optional archive filter
router.get('/organizers', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { includeArchived, archivedOnly } = req.query;
    let query = { role: 'organizer' };

    if (archivedOnly === 'true') {
      query.isArchived = true;
    }
    else if (includeArchived !== 'true') {
      query.isArchived = { $ne: true };
    }

    const organizers = await User.find(query).select('-password');
    res.json(organizers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// toggle organizer active or disabled status
router.put('/organizer/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const organizer = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    res.json({
      message: isActive ? 'Organizer enabled' : 'Organizer disabled',
      organizer
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// archive an organizer account and disable access
router.put('/organizer/:id/archive', authenticateToken, isAdmin, async (req, res) => {
  try {
    const organizer = await User.findByIdAndUpdate(
      req.params.id,
      { isArchived: true, isActive: false },
      { new: true }
    ).select('-password');

    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    res.json({ message: 'Organizer archived', organizer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// restore a previously archived organizer account
router.put('/organizer/:id/restore', authenticateToken, isAdmin, async (req, res) => {
  try {
    const organizer = await User.findByIdAndUpdate(
      req.params.id,
      { isArchived: false, isActive: true },
      { new: true }
    ).select('-password');

    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    res.json({ message: 'Organizer restored', organizer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// permanently delete organizer and cascade remove all associated data
router.delete('/organizer/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await User.findById(id);
    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const events = await Event.find({ organizerId: id }).select('_id');
    const eventIds = events.map(e => e._id);

    if (eventIds.length > 0) {
      const teams = await Team.find({ eventId: { $in: eventIds } }).select('_id');
      const teamIds = teams.map(t => t._id);

      if (teamIds.length > 0) {
        await ChatMessage.deleteMany({ teamId: { $in: teamIds } });
      }

      await Team.deleteMany({ eventId: { $in: eventIds } });

      await Registration.deleteMany({ eventId: { $in: eventIds } });

      await Event.deleteMany({ organizerId: id });
    }

    await PasswordResetRequest.deleteMany({ organizerId: id });

    await User.updateMany(
      { followingClubs: id },
      { $pull: { followingClubs: id } }
    );

    await User.findByIdAndDelete(id);

    res.json({
      message: 'Organizer and all associated data permanently deleted',
      deletedEvents: eventIds.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get system wide statistics for the admin dashboard
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const totalOrganizers = await User.countDocuments({ role: 'organizer', isArchived: { $ne: true } });
    const activeOrganizers = await User.countDocuments({ role: 'organizer', isActive: true, isArchived: { $ne: true } });
    const totalParticipants = await User.countDocuments({ role: { $in: ['iiit-student', 'non-iiit-student'] } });
    const totalEvents = await Event.countDocuments();

    res.json({
      totalOrganizers,
      activeOrganizers,
      disabledOrganizers: totalOrganizers - activeOrganizers,
      totalParticipants,
      totalEvents
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
