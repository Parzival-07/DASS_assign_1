// event routes for creating editing deleting and listing organizer events
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { authenticateToken } = require('../middleware/auth');

// create a new event as draft or published with date validation and discord notification
router.post('/create', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'organizer') {
      return res.status(403).json({ message: 'Only organizers can create events' });
    }

    const { registrationDeadline, eventStartDate, eventEndDate } = req.body;

    if (!registrationDeadline || !eventStartDate || !eventEndDate) {
      return res.status(400).json({ message: 'All date fields are required' });
    }

    const deadline = new Date(registrationDeadline);
    const startDate = new Date(eventStartDate);
    const endDate = new Date(eventEndDate);

    if (isNaN(deadline.getTime()) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (deadline.getTime() >= startDate.getTime()) {
      return res.status(400).json({ message: 'Registration deadline must be before event start date' });
    }
    if (startDate.getTime() >= endDate.getTime()) {
      return res.status(400).json({ message: 'Event start date must be before event end date' });
    }

    const eventData = {
      ...req.body,
      organizerId: req.user.id,
      status: req.body.status || 'draft'
    };

    if (eventData.status === 'published') {
      eventData.publishedAt = new Date();
    }

    const event = new Event(eventData);
    await event.save();

    if (event.status === 'published') {
      const User = require('../models/User');
      const organizer = await User.findById(req.user.id);
      if (organizer.discordWebhook) {
        try {
          const fetch = require('node-fetch');
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

    res.json({ message: 'Event created successfully', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get all published events with personalized sorting for logged in users
router.get('/all', async (req, res) => {
  try {
    const events = await Event.find({ status: { $in: ['published', 'ongoing'] } })
      .populate('organizerId', 'organizationName email category');

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const jwt = require('jsonwebtoken');
      try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        const User = require('../models/User');
        const userData = await User.findById(user.id).select('areasOfInterest followingClubs');

        const sortedEvents = events.sort((a, b) => {
          let scoreA = 0, scoreB = 0;

          if (userData.followingClubs?.includes(a.organizerId?._id?.toString())) scoreA += 10;
          if (userData.followingClubs?.includes(b.organizerId?._id?.toString())) scoreB += 10;

          const matchingTagsA = a.eventTags?.filter(tag =>
            userData.areasOfInterest?.some(interest =>
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
            )
          ).length || 0;
          const matchingTagsB = b.eventTags?.filter(tag =>
            userData.areasOfInterest?.some(interest =>
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
            )
          ).length || 0;

          scoreA += matchingTagsA * 2;
          scoreB += matchingTagsB * 2;

          return scoreB - scoreA;
        });

        return res.json(sortedEvents);
      } catch (err) {

      }
    }

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// get events owned by the current organizer
router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'organizer') {
      return res.status(403).json({ message: 'Only organizers can view their events' });
    }

    const events = await Event.find({ organizerId: req.user.id });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// get a single event by ID for the detail view
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizerId', 'organizationName email');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// update event with status based edit restrictions for published events
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own events' });
    }

    const updates = req.body;
    if (event.status === 'draft') {
      Object.assign(event, updates);
    } else if (event.status === 'published') {
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
    } else {
      return res.status(400).json({ message: 'Cannot edit event in current status' });
    }
    await event.save();

    res.json({ message: 'Event updated successfully', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// delete event and cancel all confirmed registrations
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own events' });
    }

    await Registration.updateMany(
      { eventId: req.params.id, status: 'confirmed' },
      { status: 'cancelled' }
    );

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
