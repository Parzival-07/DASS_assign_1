const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { sendTicketEmail } = require('../config/email');
const crypto = require('crypto');

const generateInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const generateTicketId = () => 'TKT-' + crypto.randomBytes(6).toString('hex').toUpperCase();

router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { eventId, teamName, maxSize } = req.body;
    const userId = req.user.id;

    if (!['iiit-student', 'non-iiit-student'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only participants can create teams' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.teamBased) return res.status(400).json({ message: 'This event does not support team registration' });
    if (!['published', 'ongoing'].includes(event.status)) {
      return res.status(400).json({ message: 'Registrations are closed for this event' });
    }
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ message: 'Registration deadline has passed' });
    }

    const size = parseInt(maxSize);
    if (size < event.minTeamSize || size > event.maxTeamSize) {
      return res.status(400).json({ message: `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}` });
    }

    if (event.eligibility === 'IIIT Students' && req.user.role !== 'iiit-student') {
      return res.status(403).json({ message: 'This event is only for IIIT students' });
    }
    if (event.eligibility === 'Non-IIIT Students' && req.user.role === 'iiit-student') {
      return res.status(403).json({ message: 'This event is only for Non-IIIT students' });
    }

    const existingTeam = await Team.findOne({
      eventId, members: userId, status: { $ne: 'cancelled' }
    });
    if (existingTeam) return res.status(400).json({ message: 'You are already in a team for this event' });

    const existingReg = await Registration.findOne({ eventId, userId, status: 'confirmed' });
    if (existingReg) return res.status(400).json({ message: 'You are already registered for this event' });

    const team = new Team({
      eventId,
      teamName,
      leaderId: userId,
      maxSize: size,
      inviteCode: generateInviteCode(),
      members: [userId]
    });

    await team.save();
    await team.populate('members', 'firstName lastName email');
    await team.populate('leaderId', 'firstName lastName email');

    res.status(201).json({
      message: 'Team created! Share the invite code with your teammates.',
      team
    });
  } catch (error) {
    console.error('CREATE TEAM ERROR:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    if (!['iiit-student', 'non-iiit-student'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only participants can join teams' });
    }

    const team = await Team.findOne({ inviteCode, status: 'forming' });
    if (!team) return res.status(404).json({ message: 'Invalid or expired invite code' });

    const event = await Event.findById(team.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!['published', 'ongoing'].includes(event.status)) {
      return res.status(400).json({ message: 'Registrations are closed for this event' });
    }
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ message: 'Registration deadline has passed' });
    }

    if (event.eligibility === 'IIIT Students' && req.user.role !== 'iiit-student') {
      return res.status(403).json({ message: 'This event is only for IIIT students' });
    }
    if (event.eligibility === 'Non-IIIT Students' && req.user.role === 'iiit-student') {
      return res.status(403).json({ message: 'This event is only for Non-IIIT students' });
    }

    const existingTeam = await Team.findOne({
      eventId: team.eventId, members: userId, status: { $ne: 'cancelled' }
    });
    if (existingTeam) return res.status(400).json({ message: 'You are already in a team for this event' });

    const existingReg = await Registration.findOne({ eventId: team.eventId, userId, status: 'confirmed' });
    if (existingReg) return res.status(400).json({ message: 'You are already registered for this event' });

    if (team.members.length >= team.maxSize) {
      return res.status(400).json({ message: 'Team is already full' });
    }

    team.members.push(userId);

    if (team.members.length >= team.maxSize) {
      team.status = 'complete';
      await team.save();

      const regCount = await Registration.countDocuments({ eventId: team.eventId, status: 'confirmed' });
      if (regCount + team.members.length > event.registrationLimit) {
        team.status = 'forming';
        team.members.pop();
        await team.save();
        return res.status(400).json({ message: 'Event registration limit would be exceeded' });
      }

      let newRegCount = 0;
      for (const memberId of team.members) {
        const existingReg = await Registration.findOne({
          eventId: team.eventId, userId: memberId, status: 'confirmed'
        });
        if (existingReg) continue;

        const member = await User.findById(memberId).select('email firstName lastName');
        const ticketId = generateTicketId();

        const registration = new Registration({
          eventId: team.eventId,
          userId: memberId,
          ticketId,
          eventType: event.eventType,
          status: 'confirmed',
          teamName: team.teamName,
          teamId: team._id
        });
        await registration.save();
        newRegCount++;

        try {
          await sendTicketEmail(member.email, {
            userName: `${member.firstName} ${member.lastName}`,
            eventName: event.eventName,
            ticketId,
            eventDate: event.eventStartDate,
            eventType: event.eventType,
            eventId: event._id,
            userId: memberId,
            teamName: team.teamName
          });
        } catch (emailErr) {
          console.error(`Email failed for ${member.email}:`, emailErr.message);
        }
      }

      if (newRegCount > 0) {
        await Event.findByIdAndUpdate(team.eventId, {
          $inc: { currentRegistrations: newRegCount }
        });
      }

      if (!event.formLocked && event.currentRegistrations === 0) {
        event.formLocked = true;
        await event.save();
      }

      const populatedTeam = await Team.findById(team._id)
        .populate('members', 'firstName lastName email')
        .populate('leaderId', 'firstName lastName email');

      const tickets = await Registration.find({
        teamId: team._id, status: 'confirmed'
      }).select('userId ticketId createdAt').populate('userId', 'firstName lastName email');

      return res.json({
        message: 'Team complete! Tickets generated for all members. Check your email.',
        team: populatedTeam,
        tickets,
        teamComplete: true
      });
    }

    await team.save();

    const populatedTeam = await Team.findById(team._id)
      .populate('members', 'firstName lastName email')
      .populate('leaderId', 'firstName lastName email');
    res.json({
      message: `Joined team! ${team.maxSize - team.members.length} spots remaining.`,
      team: populatedTeam,
      teamComplete: false
    });
  } catch (error) {
    console.error('JOIN TEAM ERROR:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-team/:eventId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findOne({
      eventId: req.params.eventId,
      members: req.user.id,
      status: { $ne: 'cancelled' }
    }).populate('members', 'firstName lastName email')
      .populate('leaderId', 'firstName lastName email')
      .populate('eventId', 'eventName minTeamSize maxTeamSize');

    if (!team) return res.json({ team: null });

    let tickets = [];
    if (team.status === 'complete') {
      tickets = await Registration.find({
        teamId: team._id, status: 'confirmed'
      }).select('userId ticketId createdAt').populate('userId', 'firstName lastName email');
    }

    res.json({ team, tickets });
  } catch (error) {
    console.error('GET MY TEAM ERROR:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/leave/:teamId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.status === 'cancelled') {
      return res.status(400).json({ message: 'This team has been cancelled' });
    }
    if (!team.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are not in this team' });
    }

    const wasComplete = team.status === 'complete';
    const isLeader = team.leaderId.toString() === req.user.id;

    if (isLeader) {
      team.status = 'cancelled';
      await team.save();

      if (wasComplete) {
        const regs = await Registration.find({ teamId: team._id, status: 'confirmed' });
        for (const reg of regs) {
          reg.status = 'cancelled';
          await reg.save();
        }
        if (regs.length > 0) {
          await Event.findByIdAndUpdate(team.eventId, {
            $inc: { currentRegistrations: -regs.length }
          });
        }
      }

      return res.json({
        message: wasComplete
          ? `Team disbanded — ${(await Registration.countDocuments({ teamId: team._id, status: 'cancelled' }))} registration(s) cancelled`
          : 'Team disbanded (leader left)'
      });
    }

    team.members = team.members.filter(m => m.toString() !== req.user.id);

    if (wasComplete) {
      team.status = 'forming';

      const reg = await Registration.findOne({
        teamId: team._id, userId: req.user.id, status: 'confirmed'
      });
      if (reg) {
        reg.status = 'cancelled';
        await reg.save();
        await Event.findByIdAndUpdate(team.eventId, {
          $inc: { currentRegistrations: -1 }
        });
      }
    }

    await team.save();

    res.json({
      message: wasComplete
        ? 'Left team — your registration has been cancelled. Team needs a replacement member.'
        : 'Left team successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/event/:eventId', authenticateToken, async (req, res) => {
  try {
    const teams = await Team.find({ eventId: req.params.eventId })
      .populate('members', 'firstName lastName email')
      .populate('leaderId', 'firstName lastName email');
    res.json({ teams });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
