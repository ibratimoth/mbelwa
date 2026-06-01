// controllers/attendeesController.js
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
//const { guest: Guest } = require('../models');
const {
  guest: Guest,
  event: Event
} = require('../models');
const { generateQRCodeToFile } = require('../utils/qrcode');
const { generateCardPNG, generatePreviewCard } = require('../utils/cardGenerator');
const { v4: uuidv4 } = require('uuid');
const { sendBulkSMS, SENDER } = require('../services/smsService');
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
const crypto = require('crypto');

// async function sendInvite(req, res) {
//   try {
//     const eventId = req.params.id;

//     const event = await Event.findByPk(eventId);
//     if (!event) {
//       return res.status(404).json({ success: false, message: 'Event not found' });
//     }

//     const guests = await Guest.findAll({
//       where: { event_id: eventId }
//     });

//     if (!guests.length) {
//       return res.status(400).json({ success: false, message: 'No guests found' });
//     }

//     const messages = guests.map(g => ({
//       from: SENDER,
//       to: g.phone,
//       text: `You are invited to ${event.title}`
//     }));

//     await sendBulkSMS(messages);

//     return res.json({
//       success: true,
//       message: 'Invitations sent successfully'
//     });

//   } catch (err) {
//     console.error('SEND INVITE ERROR:', err);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to send invitations'
//     });
//   }
// }

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
    console.error(err);

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

    console.error(err);

    res.status(400).json({
      success: false,
      message: 'Invalid QR Code'
    });
  }
}

// async function sendScannerLink(req, res) {
//   try {
//     const eventId = req.params.id;

//     const event = await Event.findByPk(eventId);

//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message: 'Event not found'
//       });
//     }

//     const { phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'Phone number required'
//       });
//     }

//     // normalize phone (Tanzania format)
//     let formattedPhone = phone;
//     if (!formattedPhone.startsWith('255')) {
//       formattedPhone = '255' + formattedPhone.replace(/^0/, '');
//     }

//     // dynamic scanner link (your correct approach)
//     const scanLink =
//       `${req.protocol}://${req.get('host')}/scanner/${event.scanner_token}`;

//     const messages = [
//       {
//         from: SENDER,
//         to: formattedPhone,
//         text: `Scanner Access for ${event.title}: ${scanLink}`,
//         reference: `${event.id}-${Date.now()}`
//       }
//     ];

//     const response = await sendBulkSMS(messages);

//     console.log('📩 SCANNER LINK SMS RESPONSE:', JSON.stringify(response, null, 2));

//     return res.json({
//       success: true,
//       message: 'Scanner link sent successfully',
//       apiResponse: response
//     });

//   } catch (err) {
//     console.error('SEND SCANNER LINK ERROR:', err?.response?.data || err);

//     return res.status(500).json({
//       success: false,
//       message: 'Failed to send scanner link'
//     });
//   }
// }

async function sendScannerLink(req, res) {
  try {

    const eventId = req.params.id;

    // match frontend (use numbers)
    const { numbers } = req.body;

    const event = await Event.findByPk(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!numbers || !numbers.length) {
      return res.status(400).json({
        success: false,
        message: 'No phone numbers provided'
      });
    }

    const scanLink = `${process.env.APP_URL}/scanner/${event.scanner_token}`;
    const messages = numbers.map((phone, index) => {

      // clean input
      let formatted = phone
        .toString()
        .trim()
        .replace(/\s+/g, '')
        .replace('+', '');

      // normalize TZ format
      if (formatted.startsWith('0')) {
        formatted = '255' + formatted.substring(1);
      }

      if (!formatted.startsWith('255')) {
        formatted = '255' + formatted;
      }

      return {
        from: SENDER,
        to: formatted,
        text: `Scanner Access for ${event.title}: ${scanLink}`,
        reference: `${event.id}-${Date.now()}-${index}`
      };
    });

    const response = await sendBulkSMS(messages);

    console.log("📡 Scanner SMS Response:", response);

    return res.json({
      success: true,
      sent: messages.length,
      message: 'Scanner links sent successfully',
      apiResponse: response
    });

  } catch (err) {

    console.error("SMS ERROR:", err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: 'Failed to send scanner links'
    });
  }
}

async function sendInvite(req, res) {
  try {
    const eventId = req.params.id;

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const guests = await Guest.findAll({
      where: { event_id: eventId }
    });

    if (!guests.length) {
      return res.status(400).json({ success: false, message: 'No guests found' });
    }

    const messages = guests.map(g => ({
      from: SENDER,
      to: g.phone,
      text: `You are invited to ${event.title}`,
      reference: `${event.id}-${g.id}-${Date.now()}`
    }));

    // ✅ CAPTURE API RESPONSE
    const response = await sendBulkSMS(messages);

    console.log('📩 SENDER:', SENDER);
    console.log('📩 SMS API RESPONSE:', JSON.stringify(response, null, 2));

    // OPTIONAL: store raw response in DB or logs
    // await SmsLog.create({ event_id: eventId, response });

    return res.json({
      success: true,
      message: 'Invitations sent successfully',
      apiResponse: response
    });

  } catch (err) {
    console.error('SEND INVITE ERROR:', err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: 'Failed to send invitations'
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
    console.error(err);

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
      card_template: templatePath
    });

    // redirect to event dashboard
    return res.redirect(`/events/${event.id}`);

  } catch (err) {
    console.error(err);
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
      console.error(e);
      return res.status(500).send('Error processing CSV');
    }
  });

  stream.on('error', (err) => {
    console.error(err);
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

  const { name, type, phone, scans } = req.body;

  await guest.update({
    name,
    type,
    phone,
    scans
  });

  return res.redirect(`/events/${req.params.eventId}/guests`);
}

async function downloadCard(req, res) {
  const guest = await Guest.findOne({
    where: {
      id: req.params.id,
      event_id: req.params.eventId
    }
  });

  const event = await Event.findByPk(
    guest.event_id
  );

  if (!guest) {
    return res.status(404).send('Guest not found');
  }

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
    baseTemplateFilename: event.card_template || 'card_base6.jpg',
    outputFilename: `${guest.id}_card.png`,
    layoutConfig: event.layout_config || {}
  });

  return res.download(
    outPath,
    `${guest.name.replace(/\s+/g, '_')}_card.png`
  );
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
    console.error(err);
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
  sendScannerLink
};
