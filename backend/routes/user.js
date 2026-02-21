// user routes for profile management preferences and organizer listing
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// get full user profile with followed clubs populated
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('followingClubs', 'organizationName category');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// update user personal information
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, collegeName, contactNumber } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        firstName,
        lastName,
        collegeName,
        contactNumber
      },
      { new: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// save user interest areas and followed clubs during onboarding
router.post('/preferences', authenticateToken, async (req, res) => {
  try {
    const { areasOfInterest, followingClubs } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        areasOfInterest: areasOfInterest || [],
        followingClubs: followingClubs || [],
        onboardingComplete: true
      },
      { new: true }
    ).select('-password').populate('followingClubs', 'organizationName category');

    res.json({
      message: 'Preferences saved successfully',
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// skip onboarding and mark as complete without setting preferences
router.post('/skip-onboarding', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { onboardingComplete: true },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Onboarding skipped',
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// list active organizers for the onboarding club selection
router.get('/organizers', authenticateToken, async (req, res) => {
  try {
    const organizers = await User.find({ role: 'organizer', isArchived: { $ne: true }, isActive: { $ne: false } })
      .select('organizationName category description');

    res.json({ organizers });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// return predefined list of interest areas for user preferences
router.get('/interest-areas', (req, res) => {
  const interestAreas = [
    'Technology',
    'Sports',
    'Music',
    'Dance',
    'Drama',
    'Art',
    'Photography',
    'Literature',
    'Debate',
    'Entrepreneurship',
    'Social Service',
    'Cultural',
    'Gaming',
    'Coding'
  ];

  res.json({ interestAreas });
});

module.exports = router;
