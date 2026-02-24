// password reset request routes for organizer initiated admin approved resets
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// generate a random password for approved reset requests
const generatePassword = () => crypto.randomBytes(8).toString('hex');

// organizer submits a password reset request with a reason
router.post('/request', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'organizer') {
      return res.status(403).json({ message: 'Only organizers can request password resets' });
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ message: 'Please provide a reason (at least 5 characters)' });
    }

    const existing = await PasswordResetRequest.findOne({
      organizerId: req.user.id,
      status: 'pending'
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have a pending request. Please wait for admin review.' });
    }

    const request = new PasswordResetRequest({
      organizerId: req.user.id,
      reason: reason.trim()
    });
    await request.save();

    res.status(201).json({ message: 'Password reset request submitted. Admin will review it.', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// organizer views their own reset request history
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'organizer') {
      return res.status(403).json({ message: 'Only organizers can view their requests' });
    }

    const requests = await PasswordResetRequest.find({ organizerId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// admin views all reset requests with optional status filter
router.get('/all-requests', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const requests = await PasswordResetRequest.find(query)
      .populate('organizerId', 'email organizationName category')
      .populate('reviewedBy', 'email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// admin approves reset request and generates a new password
router.post('/approve/:requestId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { comment } = req.body;
    const request = await PasswordResetRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    const newPlainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPlainPassword, 10);

    await User.findByIdAndUpdate(request.organizerId, { password: hashedPassword, mustChangePassword: true });

    const hashedGenPassword = await bcrypt.hash(newPlainPassword, 10);
    request.status = 'approved';
    request.adminComment = comment || '';
    request.generatedPassword = hashedGenPassword;
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    await request.populate('organizerId', 'email organizationName');

    res.json({
      message: 'Password reset approved. Share the new password with the organizer.',
      request,
      newPassword: newPlainPassword,
      organizerEmail: request.organizerId.email
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// admin rejects a reset request with an optional comment
router.post('/reject/:requestId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { comment } = req.body;
    const request = await PasswordResetRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    request.status = 'rejected';
    request.adminComment = comment || 'No reason provided';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    res.json({ message: 'Request rejected', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
