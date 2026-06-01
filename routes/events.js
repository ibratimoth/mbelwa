const express = require('express');
const router = express.Router();
const { event: Event, guest: Guest } = require('../models');
const { generatePreviewCard } = require('../utils/cardGenerator');


/**
 * EVENT DASHBOARD (single event view)
 */
router.get('/events/:eventId', async (req, res) => {
  const event = await Event.findByPk(req.params.eventId);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  const previewCardPath = await generatePreviewCard(event);

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

  console.log(`Event ${event.id} stats: Total=${totalGuests}, Scanned=${scannedGuests}, Double=${doubleGuests}`);

  res.render('events/dashboard', {
    event,
    stats: {
      totalGuests,
      scannedGuests,
      doubleGuests
    },
    previewCardPath
  });
});

module.exports = router;