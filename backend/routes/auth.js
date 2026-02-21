// authentication routes for user registration login and token verification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// register a new participant with role and email domain validation
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, collegeName, contactNumber } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    if (role === 'admin' || role === 'organizer') {
      return res.status(403).json({
        message: 'Admin and Organizer accounts cannot self-register. Contact administrator.'
      });
    }

    if (role === 'iiit-student') {
      if (!email.endsWith('@iiit.ac.in') && !email.endsWith('@students.iiit.ac.in')) {
        return res.status(400).json({
          message: 'IIIT students must use @iiit.ac.in or @students.iiit.ac.in email'
        });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      role,
      firstName: firstName || '',
      lastName: lastName || '',
      collegeName: role === 'iiit-student' ? (collegeName || 'IIIT') : (collegeName || ''),
      contactNumber: contactNumber || '',
      onboardingComplete: false
    });

    await user.save();

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        onboardingComplete: user.onboardingComplete
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// authenticate user credentials and return JWT token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role === 'organizer') {
      if (user.isArchived) {
        return res.status(403).json({ message: 'This account has been archived. Contact administrator.' });
      }
      if (user.isActive === false) {
        return res.status(403).json({ message: 'This account has been disabled. Contact administrator.' });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        organizationName: user.organizationName,
        onboardingComplete: user.onboardingComplete
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationName: user.organizationName,
        onboardingComplete: user.onboardingComplete,
        mustChangePassword: user.mustChangePassword || false
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// verify token validity and return current user data for session persistence
router.get('/verify', authenticateToken, (req, res) => {
  User.findById(req.user.id)
    .select('-password')
    .then((user) => {
      if (!user) {
        return res.status(404).json({ valid: false, message: 'User not found' });
      }

      res.json({
        valid: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          collegeName: user.collegeName,
          contactNumber: user.contactNumber,
          areasOfInterest: user.areasOfInterest || [],
          followingClubs: user.followingClubs || [],
          onboardingComplete: user.onboardingComplete,
          organizationName: user.organizationName,
          category: user.category,
          description: user.description,
          mustChangePassword: user.mustChangePassword || false
        }
      });
    })
    .catch((error) => res.status(500).json({ valid: false, message: 'Server error', error: error.message }));
});

module.exports = router;
