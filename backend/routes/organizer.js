// organizer routes for profile dashboard event management and attendance tracking
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Team = require('../models/Team');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const fetch = require('node-fetch');

// middleware to restrict routes to organizer role only
const isOrganizer = (req, res, next) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ message: 'Organizers only' });
  }
  next();
};

// get organizer profile data excluding password
router.get('/profile', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const organizer = await User.findById(req.user.id).select('-password');
    res.json(organizer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// update organizer profile including discord webhook
router.put('/profile', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const { organizationName, category, description, contactEmail, contactNumber, discordWebhook } = req.body;

    const organizer = await User.findByIdAndUpdate(
      req.user.id,
      { organizationName, category, description, contactEmail, contactNumber, discordWebhook },
      { new: true }
    ).select('-password');

    res.json({ message: 'Profile updated', organizer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get organizer dashboard with all events and aggregate analytics
router.get('/dashboard', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ createdAt: -1 });

    const completedEvents = events.filter(e => e.status === 'completed');
    let totalRegistrations = 0;
    let totalRevenue = 0;
    let totalAttendance = 0;

    for (const event of completedEvents) {
      const regs = await Registration.find({ eventId: event._id, status: { $in: ['confirmed', 'completed'] } });
      totalRegistrations += regs.length;
      totalRevenue += regs.reduce((sum, r) => sum + (event.registrationFee * (r.quantity || 1)), 0);
      totalAttendance += regs.filter(r => r.attendance).length;
    }

    res.json({
      events,
      analytics: {
        totalEvents: events.length,
        completedEvents: completedEvents.length,
        totalRegistrations,
        totalRevenue,
        totalAttendance
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// list ongoing and published events for the organizer sidebar
router.get('/ongoing', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const events = await Event.find({
      organizerId: req.user.id,
      status: { $in: ['published', 'ongoing', 'closed'] }
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get detailed event view with analytics and participant list
router.get('/event/:id', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const registrations = await Registration.find({ eventId: event._id })
      .populate('userId', 'firstName lastName email contactNumber');

    const confirmed = registrations.filter(r => r.status === 'confirmed' || r.status === 'completed');
    const attended = confirmed.filter(r => r.attendance).length;
    const revenue = confirmed.reduce((sum, r) => sum + (event.registrationFee * (r.quantity || 1)), 0);

    const teamsComplete = event.teamBased
      ? await Team.countDocuments({ eventId: event._id, status: 'complete' })
      : 0;
    const totalTeams = event.teamBased
      ? await Team.countDocuments({ eventId: event._id })
      : 0;

    res.json({
      event,
      analytics: {
        totalRegistrations: confirmed.length,
        attendance: attended,
        teamsComplete,
        totalTeams,
        revenue,
        cancelled: registrations.filter(r => r.status === 'cancelled').length
      },
      participants: registrations
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// filterable participant list with search status attendance and institution filters
router.get('/event/:id/participants', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const { search, status, attendance, institution } = req.query;
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    let query = { eventId: event._id };
    if (status) query.status = status;
    if (attendance !== undefined) query.attendance = attendance === 'true';

    let registrations = await Registration.find(query)
      .populate('userId', 'firstName lastName email contactNumber role');

    if (institution) {
      registrations = registrations.filter(r => {
        if (institution === 'iiit') return r.userId?.role === 'iiit-student';
        if (institution === 'non-iiit') return r.userId?.role === 'non-iiit-student';
        return true;
      });
    }

    if (search) {
      const s = search.toLowerCase();
      registrations = registrations.filter(r =>
        r.userId?.firstName?.toLowerCase().includes(s) ||
        r.userId?.lastName?.toLowerCase().includes(s) ||
        r.userId?.email?.toLowerCase().includes(s) ||
        r.ticketId?.toLowerCase().includes(s)
      );
    }

    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// manually toggle attendance for a participant
router.put('/event/:id/attendance/:regId', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const registration = await Registration.findByIdAndUpdate(
      req.params.regId,
      {
        attendance: req.body.attendance,
        attendanceMarkedAt: req.body.attendance ? new Date() : null,
        attendanceMethod: 'manual'
      },
      { new: true }
    );

    res.json({ message: 'Attendance updated', registration });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// validate and process a QR code scan for attendance marking
router.post('/event/:id/scan-qr', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const { ticketId, eventId: qrEventId, userId: qrUserId } = req.body;
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (qrEventId && qrEventId !== req.params.id) {
      return res.status(400).json({ message: 'QR code is for a different event', scanResult: 'wrong-event' });
    }

    const registration = await Registration.findOne({ ticketId, eventId: req.params.id })
      .populate('userId', 'firstName lastName email');
    if (!registration) {
      return res.status(404).json({ message: 'Invalid ticket - no registration found', scanResult: 'invalid' });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({ message: 'This registration has been cancelled', scanResult: 'cancelled' });
    }

    if (registration.attendance) {
      return res.status(400).json({
        message: `Already scanned at ${new Date(registration.attendanceMarkedAt).toLocaleString()}`,
        scanResult: 'duplicate',
        participant: {
          name: `${registration.userId?.firstName} ${registration.userId?.lastName}`,
          email: registration.userId?.email,
          markedAt: registration.attendanceMarkedAt
        }
      });
    }

    registration.attendance = true;
    registration.attendanceMarkedAt = new Date();
    registration.attendanceMethod = 'qr-scan';
    await registration.save();

    res.json({
      message: 'Attendance marked successfully',
      scanResult: 'success',
      participant: {
        name: `${registration.userId?.firstName} ${registration.userId?.lastName}`,
        email: registration.userId?.email,
        ticketId: registration.ticketId,
        teamName: registration.teamName || null,
        markedAt: registration.attendanceMarkedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// mark attendance manually with audit logging
router.post('/event/:id/manual-attendance', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const { registrationId, reason } = req.body;
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const registration = await Registration.findById(registrationId)
      .populate('userId', 'firstName lastName email');
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    registration.attendance = true;
    registration.attendanceMarkedAt = new Date();
    registration.attendanceMethod = 'manual';
    await registration.save();

    console.log(`[AUDIT] Manual attendance override: Event=${event.eventName}, Participant=${registration.userId?.email}, Organizer=${req.user.id}, Reason=${reason || 'N/A'}, Time=${new Date().toISOString()}`);

    res.json({
      message: 'Manual attendance marked',
      participant: {
        name: `${registration.userId?.firstName} ${registration.userId?.lastName}`,
        email: registration.userId?.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get attendance statistics with scanned and not scanned lists
router.get('/event/:id/attendance-stats', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const registrations = await Registration.find({ eventId: event._id, status: { $in: ['confirmed', 'completed'] } })
      .populate('userId', 'firstName lastName email');

    const scanned = registrations.filter(r => r.attendance);
    const notScanned = registrations.filter(r => !r.attendance);

    res.json({
      total: registrations.length,
      scanned: scanned.length,
      notScanned: notScanned.length,
      scannedList: scanned.map(r => ({
        _id: r._id,
        name: `${r.userId?.firstName} ${r.userId?.lastName}`,
        email: r.userId?.email,
        ticketId: r.ticketId,
        teamName: r.teamName,
        markedAt: r.attendanceMarkedAt,
        method: r.attendanceMethod
      })),
      notScannedList: notScanned.map(r => ({
        _id: r._id,
        name: `${r.userId?.firstName} ${r.userId?.lastName}`,
        email: r.userId?.email,
        ticketId: r.ticketId,
        teamName: r.teamName
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// change event status with valid transition enforcement and discord notification
router.put('/event/:id/status', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const validTransitions = {
      'draft': ['published'],
      'published': ['ongoing', 'closed', 'completed'],
      'ongoing': ['completed', 'closed'],
      'completed': [],
      'closed': ['ongoing', 'completed']
    };

    if (!validTransitions[event.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot change status from ${event.status} to ${status}` });
    }

    event.status = status;

    if (status === 'published' && !event.publishedAt) {
      event.publishedAt = new Date();
    }
    await event.save();

    if (status === 'published') {
      const organizer = await User.findById(req.user.id);
      if (organizer.discordWebhook) {
        try {
          await fetch(organizer.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🎉 **New Event Published!**\n\n**${event.eventName}**\n${event.eventDescription}\n\n📅 Date: ${new Date(event.eventStartDate).toLocaleDateString()}\n💰 Fee: ₹${event.registrationFee}\n👥 Limit: ${event.registrationLimit} spots`
            })
          });
        } catch (err) {
          console.error('Discord webhook failed:', err.message);
        }
      }
    }

    res.json({ message: 'Status updated', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// edit event with status based field restrictions
router.put('/event/:id/edit', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const updates = req.body;

    if (event.status === 'draft') {
      Object.assign(event, updates);
    }
    else if (event.status === 'published') {
      const allowedFields = ['eventDescription', 'registrationDeadline', 'registrationLimit'];
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          if (field === 'registrationDeadline' && new Date(updates[field]) < new Date(event.registrationDeadline)) {
            return res.status(400).json({ message: 'Can only extend registration deadline' });
          }
          if (field === 'registrationLimit' && updates[field] < event.registrationLimit) {
            return res.status(400).json({ message: 'Can only increase registration limit' });
          }
          event[field] = updates[field];
        }
      }
    }
    else {
      return res.status(400).json({ message: 'Cannot edit event in current status' });
    }

    await event.save();
    res.json({ message: 'Event updated', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// update custom registration form locked after first registration
router.put('/event/:id/form', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.formLocked) {
      return res.status(400).json({ message: 'Form is locked after first registration' });
    }

    event.customForm = req.body.customForm;
    await event.save();

    res.json({ message: 'Form updated', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
