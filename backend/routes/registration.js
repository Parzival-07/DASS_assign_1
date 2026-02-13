
const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');
const Team = require('../models/Team');
const { authenticateToken } = require('../middleware/auth');
const { sendTicketEmail } = require('../config/email');
const crypto = require('crypto');

const generateTicketId = () => 'TKT-' + crypto.randomBytes(6).toString('hex').toUpperCase();

router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { eventId, selectedSize, selectedColor, selectedVariant, quantity, customFormData, teamName } = req.body;
    const userId = req.user.id;

    if (!['iiit-student', 'non-iiit-student'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only participants can register for events' });
    }

    const event = await Event.findById(eventId);
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

    if (event.eventType === 'normal' && Array.isArray(event.customForm) && event.customForm.length > 0) {
      const formData = (customFormData && typeof customFormData === 'object') ? customFormData : {};

      const hasValue = (value) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'boolean') return value === true; 
        return true; 
      };

      const missing = [];
      for (const field of event.customForm) {
        if (!field?.required) continue;
        const value = formData[field.fieldName];

        if (!hasValue(value)) {
          missing.push(field.fieldName);
          continue;
        }

        if (field.fieldType === 'select' && Array.isArray(field.options) && field.options.length > 0) {
          if (typeof value !== 'string' || !field.options.includes(value)) {
            return res.status(400).json({ message: `Invalid value for ${field.fieldName}` });
          }
        }
        if (field.fieldType === 'checkbox' && Array.isArray(field.options) && field.options.length > 0) {
          const values = Array.isArray(value) ? value : [value];
          const invalid = values.some(v => typeof v !== 'string' || !field.options.includes(v));
          if (invalid) {
            return res.status(400).json({ message: `Invalid value for ${field.fieldName}` });
          }
        }
      }

      if (missing.length > 0) {
        return res.status(400).json({ message: `Please fill required fields: ${missing.join(', ')}` });
      }
    }

    const existingReg = await Registration.findOne({ eventId, userId, status: 'confirmed' });
    if (existingReg) return res.status(400).json({ message: 'Already registered for this event' });

    const regCount = await Registration.countDocuments({ eventId, status: 'confirmed' });
    if (regCount >= event.registrationLimit) {
      return res.status(400).json({ message: 'Registration limit reached' });
    }

    const qty = event.eventType === 'merchandise' ? (Number(quantity) || 1) : 1;

    if (event.eventType === 'merchandise') {
      if (event.itemDetails.stockQuantity < qty) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      if (qty > event.itemDetails.purchaseLimitPerParticipant) {
        return res.status(400).json({ message: `Maximum ${event.itemDetails.purchaseLimitPerParticipant} items per person` });
      }
    }

    const registration = new Registration({
      eventId,
      userId,
      ticketId: generateTicketId(),
      eventType: event.eventType,
      selectedSize,
      selectedColor,
      selectedVariant,
      quantity: qty,
      customFormData,
      teamName
    });

    await registration.save();

    if (!event.formLocked && event.currentRegistrations === 0) {
      event.formLocked = true;
      await event.save();
    }

    if (event.eventType === 'merchandise') {
      await Event.findByIdAndUpdate(eventId, {
        $inc: { currentRegistrations: 1, 'itemDetails.stockQuantity': -qty }
      });
    } else {
      await Event.findByIdAndUpdate(eventId, { $inc: { currentRegistrations: 1 } });
    }

    const user = await User.findById(userId).select('email firstName lastName');
    
    sendTicketEmail(user.email, {
      userName: `${user.firstName} ${user.lastName}`,
      eventName: event.eventName,
      ticketId: registration.ticketId,
      eventDate: event.eventStartDate,
      eventType: event.eventType,
      eventId: event._id,
      userId: userId,
      teamName,
      selectedSize,
      selectedColor,
      selectedVariant,
      quantity: quantity || 1
    }).then(() => console.log(`Ticket email sent to ${user.email}`))
      .catch(err => console.error('Email sending failed:', err.message));

    res.status(201).json({
      message: 'Registration successful! Check your email for ticket details.',
      registration: await registration.populate('eventId')
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    const registrations = await Registration.find({ userId: req.user.id })
      .populate({
        path: 'eventId',
        populate: { path: 'organizerId', select: 'organizationName category email' }
      })
      .sort({ registeredAt: -1 });

    const upcoming = registrations.filter(r =>
      r.status === 'confirmed' &&
      r.eventId?.status &&
      ['published', 'ongoing', 'closed'].includes(r.eventId.status)
    );

    const completed = registrations.filter(r =>
      r.status === 'completed' ||
      (r.status === 'confirmed' && r.eventId?.status === 'completed')
    );
    const cancelled = registrations.filter(r => r.status === 'cancelled');
    const normal = registrations.filter(r => r.eventType === 'normal');
    const merchandise = registrations.filter(r => r.eventType === 'merchandise');

    res.json({ upcoming, completed, cancelled, normal, merchandise, all: registrations });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/ticket/:ticketId', authenticateToken, async (req, res) => {
  try {
    const registration = await Registration.findOne({ ticketId: req.params.ticketId })
      .populate('eventId')
      .populate('userId', 'firstName lastName email');
    if (!registration) return res.status(404).json({ message: 'Ticket not found' });
    res.json(registration);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/calendar/:ticketId', authenticateToken, async (req, res) => {
  try {
    const registration = await Registration.findOne({ ticketId: req.params.ticketId })
      .populate('eventId')
      .populate('userId', 'firstName lastName email');
    if (!registration) return res.status(404).json({ message: 'Ticket not found' });

    const event = registration.eventId;
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const formatICSDate = (date) => {
      const d = new Date(date);
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const dtStart = formatICSDate(event.eventStartDate);
    const dtEnd = formatICSDate(event.eventEndDate);
    const now = formatICSDate(new Date());
    const uid = `${registration.ticketId}@eventmanager`;

    const escapeICS = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const summary = escapeICS(event.eventName);
    const description = escapeICS(
      `${event.eventDescription || ''}\\n\\nTicket ID: ${registration.ticketId}\\nType: ${event.eventType}\\nFee: ₹${event.registrationFee || 0}\\nOrganizer: ${event.organizerId || 'N/A'}`
    );

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EventManager//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${event.eventName.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
    res.send(icsContent);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/cancel/:ticketId', authenticateToken, async (req, res) => {
  try {
    const registration = await Registration.findOne({ ticketId: req.params.ticketId, userId: req.user.id });
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    if (registration.status === 'cancelled') {
      return res.json({ message: 'Registration already cancelled' });
    }

    if (registration.teamId) {
      const team = await Team.findById(registration.teamId);
      if (team && team.status !== 'cancelled') {
        const isLeader = team.leaderId.toString() === req.user.id;

        if (isLeader) {
          const allTeamRegs = await Registration.find({
            teamId: team._id, status: 'confirmed'
          });

          let cancelledCount = 0;
          for (const reg of allTeamRegs) {
            reg.status = 'cancelled';
            await reg.save();
            cancelledCount++;
          }

          team.status = 'cancelled';
          await team.save();

          if (cancelledCount > 0) {
            await Event.findByIdAndUpdate(registration.eventId, {
              $inc: { currentRegistrations: -cancelledCount }
            });
          }

          return res.json({
            message: `Team disbanded — ${cancelledCount} registration(s) cancelled for all team members`
          });
        } else {
          registration.status = 'cancelled';
          await registration.save();

          await Event.findByIdAndUpdate(registration.eventId, {
            $inc: { currentRegistrations: -1 }
          });

          team.members = team.members.filter(m => m.toString() !== req.user.id);

          if (team.status === 'complete') {
            team.status = 'forming';
          }
          await team.save();

          return res.json({
            message: 'Registration cancelled — you have been removed from the team'
          });
        }
      }
    }

    registration.status = 'cancelled';
    await registration.save();

    if (registration.eventType === 'merchandise') {
      await Event.findByIdAndUpdate(registration.eventId, {
        $inc: { currentRegistrations: -1, 'itemDetails.stockQuantity': registration.quantity }
      });
    } else {
      await Event.findByIdAndUpdate(registration.eventId, { $inc: { currentRegistrations: -1 } });
    }

    res.json({ message: 'Registration cancelled' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
