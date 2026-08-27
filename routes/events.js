const express = require('express');
const router = express.Router();
const { event: Event, guest: Guest, sms_campaign: SmsCampaign,sms_log: SmsLog } = require('../models');
const { generatePreviewCard } = require('../utils/cardGenerator');
const logger = require('../utils/logger');
const { fn, col } = require('sequelize');


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

  logger.info(`Event ${event.id} stats: Total=${totalGuests}, Scanned=${scannedGuests}, Double=${doubleGuests}`);

const smsStatsRaw = await SmsLog.findAll({
  attributes: [
    'status',
    [fn('COUNT', col('id')), 'count']
  ],
  where: {
    event_id: event.id
  },
  group: ['status']
});

const smsStats = {
  sent: 0,
  failed: 0,
  pending: 0,
  delivered: 0
};

smsStatsRaw.forEach(row => {
  const status = row.status.toLowerCase();
  const count = parseInt(row.get('count')) || 0;

  logger.info(`SMS Status ${status}: ${count}`);
  smsStats[status] = count;
});

  res.render('events/dashboard', {
    event,
    stats: {
      totalGuests,
      scannedGuests,
      doubleGuests
    },
    previewCardPath,
    smsStats
  });
});

module.exports = router;