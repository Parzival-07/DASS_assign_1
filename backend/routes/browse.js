// browse routes for event search filtering trending and club discovery
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// build a fuzzy regex that allows up to 2 extra chars between typed characters
const buildFuzzyRegex = (str) => {
  const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.split('').join('.{0,2}');
};

// search and filter published events with fuzzy text matching and interest sorting
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { search, eventType, eligibility, startDate, endDate, followedOnly, matchingInterests } = req.query;
    let query = { status: { $in: ['published', 'ongoing'] } };

    if (search) {
      const fuzzyPattern = buildFuzzyRegex(search);

      const organizerMatches = await User.find({
        role: 'organizer',
        organizationName: { $regex: fuzzyPattern, $options: 'i' },
        isArchived: { $ne: true },
        isActive: { $ne: false }
      }).select('_id');

      const organizerIds = organizerMatches.map(o => o._id);

      query.$or = [
        { eventName: { $regex: fuzzyPattern, $options: 'i' } },
        { eventDescription: { $regex: fuzzyPattern, $options: 'i' } },
        ...(organizerIds.length > 0 ? [{ organizerId: { $in: organizerIds } }] : [])
      ];
    }

    if (eventType && eventType !== 'all') {
      query.eventType = eventType;
    }

    if (eligibility && eligibility !== 'all') {
      query.eligibility = eligibility;
    }

    if (startDate) query.eventStartDate = { $gte: new Date(startDate) };
    if (endDate) query.eventEndDate = { ...query.eventEndDate, $lte: new Date(endDate) };

    if (followedOnly === 'true') {
      const user = await User.findById(req.user.id);
      if (user.followingClubs?.length > 0) {
        query.organizerId = { $in: user.followingClubs };
      }
    }

    let events = await Event.find(query)
      .populate('organizerId', 'organizationName category')
      .sort({ publishedAt: -1, createdAt: -1 });

    if (matchingInterests === 'true') {
      const user = await User.findById(req.user.id).select('areasOfInterest');
      if (user?.areasOfInterest?.length > 0) {
        events = events.filter(event => {
          const matchingTags = event.eventTags?.filter(tag =>
            user.areasOfInterest.some(interest =>
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
            )
          ).length || 0;
          return matchingTags > 0;
        });

        events = events.sort((a, b) => {
          const matchingTagsA = a.eventTags?.filter(tag =>
            user.areasOfInterest.some(interest =>
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
            )
          ).length || 0;

          const matchingTagsB = b.eventTags?.filter(tag =>
            user.areasOfInterest.some(interest =>
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
            )
          ).length || 0;

          if (matchingTagsB !== matchingTagsA) {
            return matchingTagsB - matchingTagsA;
          }

          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }
    }

    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get top 5 trending events based on registrations in the last 24 hours
router.get('/trending', async (req, res) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const trending = await Registration.aggregate([
      { $match: { registeredAt: { $gte: yesterday } } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const eventIds = trending.map(t => t._id);
    const events = await Event.find({ _id: { $in: eventIds } })
      .populate('organizerId', 'organizationName category');

    const sortedEvents = eventIds.map(id => events.find(e => e._id.toString() === id.toString())).filter(Boolean);

    res.json({ trending: sortedEvents });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get single event details with availability and deadline info
router.get('/event/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizerId', 'organizationName category description email contactEmail');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!['published', 'ongoing'].includes(event.status)) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const regCount = await Registration.countDocuments({ eventId: event._id, status: 'confirmed' });
    const spotsLeft = event.registrationLimit - regCount;
    const deadlinePassed = new Date() > new Date(event.registrationDeadline);
    const soldOut = event.eventType === 'merchandise' && event.itemDetails.stockQuantity <= 0;

    res.json({ event, spotsLeft, deadlinePassed, soldOut, registrationCount: regCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// list all active organizers for the clubs listing page
router.get('/clubs', async (req, res) => {
  try {
    const clubs = await User.find({
      role: 'organizer',
      isArchived: { $ne: true },
      isActive: { $ne: false }
    })
      .select('organizationName category description email');
    res.json({ clubs });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get organizer details with their upcoming and past events
router.get('/club/:id', async (req, res) => {
  try {
    const club = await User.findById(req.params.id)
      .select('organizationName category description email contactEmail role');
    if (!club || club.role !== 'organizer' || club.isArchived || club.isActive === false) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const now = new Date();
    const upcomingEvents = await Event.find({
      organizerId: req.params.id,
      eventEndDate: { $gt: now },
      status: { $in: ['published', 'ongoing'] }
    });
    const pastEvents = await Event.find({
      organizerId: req.params.id,
      eventEndDate: { $lte: now },
      status: { $in: ['published', 'ongoing', 'completed', 'closed'] }
    });

    res.json({ club, upcomingEvents, pastEvents });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// toggle follow or unfollow a club for personalized event feed
router.post('/club/:id/follow', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const clubId = req.params.id;

    if (user.followingClubs.includes(clubId)) {
      user.followingClubs = user.followingClubs.filter(c => c.toString() !== clubId);
      await user.save();
      res.json({ message: 'Unfollowed', following: false });
    } else {
      user.followingClubs.push(clubId);
      await user.save();
      res.json({ message: 'Following', following: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// check if current user is following a specific club
router.get('/club/:id/following', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const following = user.followingClubs.includes(req.params.id);
    res.json({ following });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
