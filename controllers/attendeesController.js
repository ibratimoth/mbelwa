// controllers/attendeesController.js
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
//const { guest: Guest } = require('../models');
const {
  guest: Guest,
  event: Event,
  sms_campaign: SmsCampaign,
  sms_log: SmsLog
} = require('../models');
const { generateQRCodeToFile } = require('../utils/qrcode');
const { generateCardPNG, generatePreviewCard } = require('../utils/cardGenerator');
const { v4: uuidv4 } = require('uuid');
const { sendBulkSMS, SENDER } = require('../services/smsService');
const smsQueue = require('../queues/smsQueue');
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const { Op } = require("sequelize");

const SMS_WEBHOOK_TOKEN = process.env.WEBHOOK_SECRET;

async function smsWebhook(req, res) {
  try {

    const { token, messageId, status } = req.body;

    // 1. SECURITY CHECK
    if (token !== SMS_WEBHOOK_TOKEN) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (!messageId || !status) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    // 2. FIND SMS LOG
    const log = await SmsLog.findOne({
      where: { provider_message_id: messageId }
    });

    if (!log) {
      return res.status(404).json({ message: 'SMS log not found' });
    }

    // 3. UPDATE STATUS
    log.status = status;
    await log.save();

    logger.log(`📩 SMS updated: ${messageId} → ${status}`);

    return res.json({ success: true });

  } catch (err) {
    logger.error('WEBHOOK ERROR:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getCampaignSummary(req, res) {
  try {

    const campaignId = req.params.campaignId;

    const campaign = await SmsCampaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const stats = await SmsLog.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        campaign_id: campaignId
      },
      group: ['status']
    });

    const summary = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignType: campaign.type,
      total: 0,
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      read: 0
    };

    stats.forEach(row => {

      const status = row.status.toLowerCase();
      const count = parseInt(row.get('count'));

      summary.total += count;

      if (summary.hasOwnProperty(status)) {
        summary[status] = count;
      }
    });

    return res.json({
      success: true,
      data: summary
    });

  } catch (err) {
    logger.error(err);

    return res.status(500).json({
      success: false,
      message: 'Failed to load summary'
    });
  }
}

async function retryFailedSms(req, res) {
  try {

    const { campaignId } = req.params;

    const campaign = await SmsCampaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const failedLogs = await SmsLog.findAll({
      where: {
        campaign_id: campaignId,
        status: 'FAILED'
      }
    });

    if (!failedLogs.length) {
      return res.json({
        success: true,
        message: 'No failed SMS found'
      });
    }

    const messages = failedLogs.map(log => ({
      to: log.phone,
      text: log.message,
      reference: log.reference_id
    }));

    await SmsLog.update(
      {
        status: 'PENDING'
      },
      {
        where: {
          campaign_id: campaignId,
          status: 'FAILED'
        }
      }
    );

    const job = await smsQueue.add(
      'retry-failed-sms',
      {
        messages,
        campaignId
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30000
        }
      }
    );

    return res.json({
      success: true,
      retried: messages.length,
      jobId: job.id
    });

  } catch (err) {

    logger.error(err);

    return res.status(500).json({
      success: false,
      message: 'Retry failed'
    });
  }
}

async function generateScannerLink(req, res) {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.scanner_token) {
      event.scanner_token = crypto.randomUUID();
      await event.save();
    }

    const scanLink =
      `${req.protocol}://${req.get('host')}/scanner/${event.scanner_token}`;

    res.json({
      success: true,
      scanLink
    });

  } catch (err) {
    logger.error(err);

    res.status(500).json({
      success: false
    });
  }
}

async function showPublicScanner(req, res) {

  const event = await Event.findOne({
    where: {
      scanner_token: req.params.token
    }
  });

  if (!event) {
    return res.status(404).send('Invalid scanner link');
  }

  res.render('scanner/public-scan', {
    event
  });
}

async function scanGuestByToken(req, res) {

  const event = await Event.findOne({
    where: {
      scanner_token: req.params.token
    }
  });

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Invalid scanner link'
    });
  }

  try {

    const { qrData } = req.body;

    const parsed = JSON.parse(qrData);

    if (!parsed.guest_id || !parsed.event_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR'
      });
    }

    // IMPORTANT SECURITY CHECK
    if (parsed.event_id !== event.id) {
      return res.status(403).json({
        success: false,
        message: 'This QR belongs to another event'
      });
    }

    const guest = await Guest.findOne({
      where: {
        id: parsed.guest_id,
        event_id: event.id
      }
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    const maxScans =
      guest.type === 'double'
        ? 2
        : 1;

    if (guest.scans >= maxScans) {
      return res.json({
        success: false,
        message: 'Guest already scanned maximum times'
      });
    }

    guest.scans += 1;

    await guest.save();

    res.json({
      success: true,
      message: `Welcome ${guest.name}`,
      scansRemaining: maxScans - guest.scans
    });

  } catch (err) {

    logger.error(err);

    res.status(400).json({
      success: false,
      message: 'Invalid QR Code'
    });
  }
}

async function sendScannerLink(req, res) {
  try {

    const eventId = req.params.id;
    const { numbers } = req.body;

    const event = await Event.findByPk(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!numbers?.length) {
      return res.status(400).json({
        success: false,
        message: 'No phone numbers provided'
      });
    }

    const scanLink = `${process.env.APP_URL}/scanner/${event.scanner_token}`;

    const validRecipients = [];

    // CHECK DUPLICATES FIRST
    for (let i = 0; i < numbers.length; i++) {

      let phone = numbers[i]
        .toString()
        .trim()
        .replace(/\s+/g, '')
        .replace('+', '');

      if (phone.startsWith('0')) {
        phone = '255' + phone.substring(1);
      }

      if (!phone.startsWith('255')) {
        phone = '255' + phone;
      }

      const duplicateLog = await SmsLog.findOne({
        where: {
          event_id: eventId,
          phone
        }
      });

      if (duplicateLog) {

        logger.info(
          `⚠️ Scanner SMS already sent to ${phone} for event ${eventId}. Skipping.`
        );

        continue;
      }

      validRecipients.push(phone);
    }

    if (!validRecipients.length) {

      logger.info(
        '⚠️ All supplied numbers already received scanner links.'
      );

      return res.status(400).json({
        success: false,
        message: 'All supplied numbers have already received scanner links'
      });
    }

    // CREATE CAMPAIGN ONLY IF THERE ARE MESSAGES
    const campaign = await SmsCampaign.create({
      event_id: eventId,
      name: 'Scanner Link',
      type: 'scanner',
      message_template: `Scanner Access for ${event.title}`
    });

    const messages = [];

    for (const phone of validRecipients) {

      const reference_id = `scanner-${campaign.id}-${phone}`;

      await SmsLog.create({
        campaign_id: campaign.id,
        event_id: eventId,
        phone,
        message: `Scanner Access for ${event.title}: ${scanLink}`,
        reference_id,
        status: 'PENDING'
      });

      messages.push({
        from: SENDER,
        to: phone,
        text: `Scanner Access for ${event.title}: ${scanLink}`,
        reference: reference_id
      });
    }

    logger.info(
      `📤 Scanner SMS queued: ${messages.length} messages`
    );

    const job = await smsQueue.add(
      'send-sms',
      {
        messages,
        campaignId: campaign.id,
        type: 'scanner'
      },
      {
        jobId: `scanner-${campaign.id}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30000
        }
      }
    );

    return res.json({
      success: true,
      campaignId: campaign.id,
      jobId: job.id,
      sent: messages.length,
      message: 'Scanner links queued successfully'
    });

  } catch (err) {

    logger.error('SCANNER SMS ERROR:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to queue scanner links'
    });
  }
}

async function sendWhatsAppInvite(req, res) {
  try {
    const eventId = req.params.id;
    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const guests = await Guest.findAll({ where: { event_id: eventId } });
    if (!guests.length) return res.status(400).json({ message: 'No guests found' });

    const campaign = await SmsCampaign.create({
      event_id: eventId,
      name: 'WhatsApp Invitation with Card',
      type: 'whatsapp_wedding_invite',
      message_template: 'next_gen_card'
    });

    const recipients = [];
    let skipped = 0;
    const APP_BASE_URL = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;

    for (const g of guests) {
      const reference_id = `wa-${g.id}-${eventId}`;

      const exists = await SmsLog.findOne({ where: { reference_id } });
      if (exists) {
        skipped++;
        continue;
      }

      // 1. Ensure QR Code exists
      let qrPath = g.qr_code_path;
      if (!qrPath || !fs.existsSync(qrPath)) {
        const qrFilename = `${g.id}.png`;
        qrPath = await generateQRCodeToFile(
          JSON.stringify({ guest_id: g.id, event_id: eventId, name: g.name }),
          qrFilename
        );
        await g.update({ qr_code_path: qrPath });
      }

      // 2. Generate Card PNG
      const generatedCardPath = await generateCardPNG({
        name: g.name,
        type: g.type,
        qrPath,
        baseTemplateFilename: event.card_template || 'card_base6.jpg',
        outputFilename: `wa_card_${g.id}.png`,
        layoutConfig: event.layout_config || {},
        maxSizeBytes: 2 * 1024 * 1024 // 2 MB target limit
      });

      // 3. Convert local file path to public HTTP URL
      const relativePath = path.relative('public', generatedCardPath).replace(/\\/g, '/');
      const publicCardUrl = `${APP_BASE_URL}/public/${relativePath}`;

      // const variables = {
      //   guest_name: g.name,
      //   groom_name: event.groom_name,
      //   bride_name: event.bride_name,
      //   card_number: g.card_number,
      //   venue: event.venue,
      //   event_date: new Date(event.event_date).toLocaleDateString()
      // };

      const variables = {
        guest_name: String(g.name),
        groom_name: String(event.groom_name),
        bride_name: String(event.bride_name),
        card_number: String(g.card_number), // Ensures integer 16 becomes "16"
        venue: String(event.venue),
        event_date: String(new Date(event.event_date).toLocaleDateString())
      };
      await SmsLog.create({
        campaign_id: campaign.id,
        event_id: eventId,
        guest_id: g.id,
        phone: g.phone,
        message: JSON.stringify(variables),
        reference_id,
        status: 'PENDING'
      });

      recipients.push({
        phone: g.phone,
        cardUrl: publicCardUrl,
        reference: reference_id,
        variables
      });
    }

    if (!recipients.length) {
      return res.status(400).json({ success: false, message: 'All WhatsApp invites already sent' });
    }

    // Queue BullMQ job
    const job = await smsQueue.add(
      'send-whatsapp',
      {
        recipients,
        templateName: campaign.message_template,
        campaignId: campaign.id
      },
      {
        jobId: `wa-invite-${campaign.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 }
      }
    );

    return res.json({
      success: true,
      campaignId: campaign.id,
      jobId: job.id,
      sent: recipients.length,
      skipped,
      message: 'WhatsApp invitations with cards queued successfully'
    });

  } catch (err) {
    console.error('WA INVITE ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to process WhatsApp invitations' });
  }
}

async function sendInvite(req, res) {
  try {
    const eventId = req.params.id;

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const guests = await Guest.findAll({
      where: { event_id: eventId }
    });

    if (!guests.length) {
      return res.status(400).json({ message: 'No guests found' });
    }

    // 1. CREATE CAMPAIGN FIRST
    const campaign = await SmsCampaign.create({
      event_id: eventId,
      name: 'Invitation',
      type: 'wedding_invite',
      message_template: `Wedding invitation`
    });

    const messages = [];
    let skipped = 0;

    // 2. BUILD MESSAGES + LOGS
    for (const g of guests) {

      const reference_id = `${campaign.type}-${g.id}-${eventId}`;

      // 3. PREVENT DUPLICATE
      const exists = await SmsLog.findOne({
        where: {
          reference_id,
          provider_response: {
            [Op.ne]: null
          }
        }
      });

      if (exists) {
        logger.info(
          `⚠️ SKIPPED (already sent): guest_id=${g.id}, phone=${g.phone}`
        );
        skipped++;
        continue;
      }

      const invitationMessage =
        `Ndugu ${g.name}, kwa heshima kubwa tunakualika kuhudhuria sherehe ya harusi ya ` +
        `${event.groom_name} na ${event.bride_name}. ` +
        `Kadi yako ni Na. ${g.card_number}. ` +
        `Sherehe itafanyika ${event.venue} tarehe ${new Date(event.event_date).toLocaleDateString()}. ` +
        `Karibu kusherehekea nasi siku hii ya furaha.`;

      // 4. SAVE SMS LOG
      await SmsLog.create({
        campaign_id: campaign.id,
        event_id: eventId,
        guest_id: g.id,
        phone: g.phone,
        message: invitationMessage,
        reference_id,
        status: 'PENDING'
      });

      // 5. QUEUE PAYLOAD
      messages.push({
        from: SENDER,
        to: g.phone,
        text: invitationMessage,
        reference: reference_id
      });
    }

    // 6. NOTHING TO SEND CHECK
    if (!messages.length) {
      return res.status(400).json({
        success: false,
        message: 'All invites already sent'
      });
    }

    // 7. QUEUE JOB
    const job = await smsQueue.add(
      'send-sms',
      {
        messages,
        campaignId: campaign.id,
        type: 'invite'
      },
      {
        jobId: `invite-${campaign.id}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30000
        }
      }
    );

    return res.json({
      success: true,
      campaignId: campaign.id,
      jobId: job.id,
      sent: messages.length,
      skipped,
      message: 'Invitation queued successfully'
    });

  } catch (err) {
    logger.error('INVITE ERROR:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to queue invitations'
    });
  }
}

async function showEditor(req, res) {
  const event = await Event.findByPk(req.params.id);

  if (!event) return res.status(404).send('Event not found');

  res.render('events/editor', { event });
}

async function previewCard(req, res) {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // IMPORTANT: preview should NOT use Jimp rendering
    // It should only return the template image
    const url = `/public/templates/${event.card_template}`;

    return res.json({
      success: true,
      url
    });

  } catch (err) {
    logger.error(err);

    return res.status(500).json({
      success: false,
      message: 'Failed to load preview'
    });
  }
}

async function updateLayoutConfig(req, res) {
  const event = await Event.findByPk(req.params.id);

  if (!event) return res.status(404).send('Not found');

  await event.update({
    layout_config: req.body.layout_config
  });

  res.json({ success: true });
}

async function createEvent(req, res) {
  try {
    const {
      title,
      groom_name,
      bride_name,
      venue,
      event_date
    } = req.body;

    const templatePath = req.file
      ? `${req.file.filename}`
      : null;

    const event = await Event.create({
      title,
      groom_name,
      bride_name,
      venue,
      event_date,
      card_template: templatePath,
      user_id: req.session.userId
    });

    // redirect to event dashboard
    return res.redirect(`/events/${event.id}`);

  } catch (err) {
    logger.error(err);
    return res.status(500).send('Failed to create event');
  }
}

async function list(req, res) {
  const event = await Event.findByPk(req.params.eventId);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  const guests = await Guest.findAll({
    where: {
      event_id: req.params.eventId
    },
    order: [['createdAt', 'DESC']]
  });

  res.render('attendees/list', {
    guests,
    event
  });
}

async function showUploadForm(req, res) {
  const event = await Event.findByPk(req.params.eventId);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  res.render('upload', { event });
}

async function handleCsvUpload(req, res) {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const results = [];

  const stream = fs.createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        header.trim().replace(/^\uFEFF/, '')
    }));

  // stream.on('data', (data) => {
  //   results.push({
  //     name: data.name,
  //     phone: data.phone,
  //     type: (data.type?.trim().toLowerCase() === 'double') ? 'double' : 'single'
  //   });
  // });

  stream.on('data', (data) => {

    let phone = (data.phone || '').trim();

    // remove spaces and non-digits except +
    phone = phone.replace(/\s+/g, '');

    // convert starting 0 → 255 (Tanzania format)
    if (phone.startsWith('0')) {
      phone = '255' + phone.substring(1);
    }

    // if already starts with +255 → remove +
    if (phone.startsWith('+255')) {
      phone = phone.replace('+', '');
    }

    // if user entered raw 9 digits like 7XXXXXXXX
    if (phone.length === 9 && !phone.startsWith('255')) {
      phone = '255' + phone;
    }

    results.push({
      name: data.name,
      phone: phone,
      type: (data.type?.trim().toLowerCase() === 'double') ? 'double' : 'single'
    });
  });

  stream.on('end', async () => {
    try {
      for (const row of results) {
        const id = uuidv4();
        const qrFilename = `${id}.png`;

        const qrPath = await generateQRCodeToFile(
          JSON.stringify({
            guest_id: id,
            event_id: req.params.eventId,
            name: row.name
          }),
          qrFilename
        );

        await Guest.create({
          id,
          event_id: req.params.eventId,
          name: row.name,
          phone: row.phone,
          type: row.type,
          qr_code_path: qrPath,
          scans: 0
        });
      }

      return res.redirect(`/events/${req.params.eventId}/guests`);
    } catch (e) {
      logger.error(e);
      return res.status(500).send('Error processing CSV');
    }
  });

  stream.on('error', (err) => {
    logger.error(err);
    return res.status(500).send('Failed to process CSV');
  });
}

async function editForm(req, res) {
  const event = await Event.findByPk(req.params.eventId);
  if (!event) {
    return res.status(404).send('Event not found');
  }

  const guest = await Guest.findOne({
    where: {
      id: req.params.id,
      event_id: req.params.eventId
    }
  });

  if (!guest) {
    return res.status(404).send('Guest not found');
  }

  res.render('attendees/edit', { guest, event });
}

async function updateGuest(req, res) {
  const guest = await Guest.findOne({
    where: {
      id: req.params.id,
      event_id: req.params.eventId
    }
  });

  if (!guest) {
    return res.status(404).send('Guest not found');
  }

  const { name, type, phone, scans, card_number } = req.body;

  await guest.update({
    name,
    type,
    phone,
    scans,
    card_number
  });

  return res.redirect(`/events/${req.params.eventId}/guests`);
}

// async function downloadCard(req, res) {
//   const guest = await Guest.findOne({
//     where: {
//       id: req.params.id,
//       event_id: req.params.eventId
//     }
//   });

//   const event = await Event.findByPk(
//     guest.event_id
//   );

//   if (!guest) {
//     return res.status(404).send('Guest not found');
//   }

//   let qrPath = guest.qr_code_path;

//   if (!qrPath || !fs.existsSync(qrPath)) {
//     const qrFilename = `${guest.id}.png`;

//     qrPath = await generateQRCodeToFile(
//       JSON.stringify({
//         guest_id: guest.id,
//         event_id: req.params.eventId,
//         name: guest.name
//       }),
//       qrFilename
//     );

//     await guest.update({ qr_code_path: qrPath });
//   }

//   const outPath = await generateCardPNG({
//     name: guest.name,
//     type: guest.type,
//     qrPath,
//     baseTemplateFilename: event.card_template || 'card_base6.jpg',
//     outputFilename: `${guest.id}_card.png`,
//     layoutConfig: event.layout_config || {}
//   });

//   return res.download(
//     outPath,
//     `${guest.name.replace(/\s+/g, '_')}_card.png`
//   );
// }

async function downloadCard(req, res) {
  try {
    const guest = await Guest.findOne({
      where: {
        id: req.params.id,
        event_id: req.params.eventId
      }
    });

    if (!guest) {
      return res.status(404).send('Guest not found');
    }

    const event = await Event.findByPk(guest.event_id);

    let qrPath = guest.qr_code_path;

    if (!qrPath || !fs.existsSync(qrPath)) {
      const qrFilename = `${guest.id}.png`;

      qrPath = await generateQRCodeToFile(
        JSON.stringify({
          guest_id: guest.id,
          event_id: req.params.eventId,
          name: guest.name
        }),
        qrFilename
      );

      await guest.update({ qr_code_path: qrPath });
    }

    const outPath = await generateCardPNG({
      name: guest.name,
      type: guest.type,
      qrPath,
      baseTemplateFilename: event?.card_template || 'card_base6.jpg',
      outputFilename: `${guest.id}_card.png`,
      layoutConfig: event?.layout_config || {},
      maxSizeBytes: 2 * 1024 * 1024 // 2 MB target limit
    });

    const safeFilename = `${guest.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_card.png`;

    return res.download(outPath, safeFilename);
  } catch (error) {
    console.error('Error generating card download:', error);
    return res.status(500).send('Failed to generate card');
  }
}

async function scanGuest(req, res) {
  try {
    const { qrData } = req.body;

    const parsed = JSON.parse(qrData);

    if (!parsed.guest_id || !parsed.event_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    const guest = await Guest.findOne({
      where: {
        id: parsed.guest_id,
        event_id: parsed.event_id
      }
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    const maxScans = guest.type === 'double' ? 2 : 1;

    if (guest.scans >= maxScans) {
      return res.json({
        success: false,
        message: 'Guest already scanned maximum times'
      });
    }

    guest.scans += 1;
    await guest.save();

    return res.json({
      success: true,
      message: `Welcome ${guest.name}!`,
      scansRemaining: maxScans - guest.scans
    });

  } catch (err) {
    logger.error(err);
    return res.status(400).json({
      success: false,
      message: 'Invalid QR code'
    });
  }
}

async function showScan(req, res) {
  const event = await Event.findByPk(req.params.eventId);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  res.render('attendees/scan', { event });
}

module.exports = {
  list,
  showUploadForm,
  handleCsvUpload,
  editForm,
  updateGuest,
  downloadCard,
  scanGuest,
  showScan,
  createEvent,
  previewCard,
  updateLayoutConfig,
  showEditor,
  sendInvite,
  generateScannerLink,
  showPublicScanner,
  scanGuestByToken,
  sendScannerLink,
  smsWebhook,
  getCampaignSummary,
  retryFailedSms,
  sendWhatsAppInvite
};
