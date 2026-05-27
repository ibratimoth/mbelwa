const express = require('express');
const router = express.Router();
const { event: Event, guest: Guest } = require('../models');

/**
 * EVENT DASHBOARD (single event view)
 */
router.get('/events/:eventId', async (req, res) => {
  const event = await Event.findByPk(req.params.eventId);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  const totalGuests = await Guest.count({
    where: { event_id: event.id }
  });

  const scannedGuests = await Guest.count({
    where: {
      event_id: event.id,
      scans: { [require('sequelize').Op.gt]: 0 }
    }
  });

  const doubleGuests = await Guest.count({
    where: {
      event_id: event.id,
      type: 'double'
    }
  });

  res.render('events/dashboard', {
    event,
    stats: {
      totalGuests,
      scannedGuests,
      doubleGuests
    }
  });
});

module.exports = router;