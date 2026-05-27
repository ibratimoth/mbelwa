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
const { generateCardPNG } = require('../utils/cardGenerator');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

// async function list(req, res) {
//     const guests = await Guest.findAll({ order: [['createdAt', 'DESC']] });
//     res.render('attendees/list', { guests });
// }

// async function list(req, res) {

//     const event = await Event.findByPk(req.params.eventId);

//     if (!event) {
//         return res.status(404).send('Event not found');
//     }

//     const guests = await Guest.findAll({

//         where: {
//             event_id: req.params.eventId
//         },

//         order: [['createdAt', 'DESC']]
//     });

//     res.render('attendees/list', {
//         guests,
//         event
//     });
// }

// async function showScan(req, res) {
//     res.render('attendees/scan');
// }

// // async function showUploadForm(req, res) {
// //     res.render('upload');
// // }

// async function showUploadForm(req, res) {

//     const event = await Event.findByPk(req.params.eventId);

//     if (!event) {
//         return res.status(404).send('Event not found');
//     }

//     res.render('upload', { event });
// }

// async function handleCsvUpload(req, res) {
//     // multer has put file in req.file
//     if (!req.file) return res.status(400).send('No file uploaded.');

//     const results = [];
//     const stream = fs.createReadStream(req.file.path)
//         .pipe(csv({
//             mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
//         }));

//     stream.on('data', (data) => {
//         // expecting CSV headers: name,type
//         console.log('data:', data);

//         results.push({
//             name: data.name,
//             phone: data.phone,
//             type: (data.type?.trim().toLowerCase() === 'double') ? 'double' : 'single'
//         });
//     });

//     stream.on('end', async () => {
//         // For each, create DB record and generate QR
//         for (const row of results) {
//             try {
//                 const id = uuidv4();
//                 // qr will contain the attendee id and name for uniqueness
//                 const qrFilename = `${id}.png`;
//                 const qrPath = await generateQRCodeToFile(JSON.stringify({ guest_id: id, event_id: req.params.eventId, name: row.name }), qrFilename);

//                 // const guest = await Guest.create({
//                 //     id,
//                 //     name: row.name,
//                 //     phone: row.phone,
//                 //     type: row.type,
//                 //     qr_code_path: qrPath
//                 // });

//                 const guest = await Guest.create({
//                     id,
//                     event_id: req.params.eventId,
//                     name: row.name,
//                     phone: row.phone,
//                     type: row.type,
//                     qr_code_path: qrPath
//                 });
//                 // optionally generate card on the fly — but we'll generate on download
//             } catch (e) {
//                 console.error('Error on row', row, e);
//             }
//         }
//         //res.redirect('/attendees');
//         res.redirect(`/events/${req.params.eventId}/guests`);
//     });

//     stream.on('error', (err) => {
//         console.error(err);
//         res.status(500).send('Failed to process CSV');
//     });
// }

// async function editForm(req, res) {
//     //const guest = await Guest.findByPk(req.params.id);
//     const guest = await Guest.findOne({

//         where: {
//             id: req.params.id,
//             event_id: req.params.eventId
//         }

//     });
//     if (!guest) return res.status(404).send('Guest not found');
//     res.render('attendees/edit', { guest });
// }

// async function updateGuest(req, res) {
//     //const guest = await Guest.findByPk(req.params.id);
//     const guest = await Guest.findOne({

//         where: {
//             id: req.params.id,
//             event_id: req.params.eventId
//         }

//     });
//     if (!guest) return res.status(404).send('Guest not found');

//     const { name, type, phone, scans } = req.body;
//     await guest.update({ name, type, phone, scans });
//     res.redirect('/attendees');
// }

// async function downloadCard(req, res) {
//     //const guest = await Guest.findByPk(req.params.id);
//     const guest = await Guest.findOne({

//         where: {
//             id: req.params.id,
//             event_id: req.params.eventId
//         }

//     });
//     if (!guest) return res.status(404).send('Guest not found');

//     // Ensure QR exists, otherwise regenerate
//     let qrPath = guest.qr_code_path;
//     if (!qrPath || !fs.existsSync(qrPath)) {
//         const qrFilename = `${guest.id}.png`;
//         qrPath = await generateQRCodeToFile(JSON.stringify({ id: guest.id, name: guest.name }), qrFilename);
//         await guest.update({ qr_code_path: qrPath });
//     }

//     const outPath = await generateCardPNG({
//         name: guest.name,
//         type: guest.type,
//         qrPath,
//         baseTemplateFilename: 'card_base6.jpg',
//         outputFilename: `${guest.id}_card.png`
//     });

//     // stream the PNG as download
//     res.download(outPath, `${guest.name.replace(/\s+/g, '_')}_card.png`);
// }

// async function scanGuest(req, res) {
//     const { qrData } = req.body;

//     try {
//         const parsed = JSON.parse(qrData);
//         //const guest = await Guest.findByPk(parsed.id);
//         const guest = await Guest.findOne({
//             where: {
//                 id: parsed.guest_id,
//                 event_id: parsed.event_id
//             }
//         });

//         if (!guest) {
//             return res.status(404).json({ success: false, message: 'Guest not found' });
//         }

//         const maxScans = guest.type === 'double' ? 2 : 1;

//         if (guest.scans >= maxScans) {
//             return res.json({ success: false, message: 'Guest already scanned maximum times' });
//         }

//         // Increment scan count
//         guest.scans += 1;
//         await guest.save();

//         res.json({
//             success: true,
//             message: `Welcome ${guest.name}!`,
//             scansRemaining: maxScans - guest.scans
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(400).json({ success: false, message: 'Invalid QR code' });
//     }
// }

async function createEvent(req, res) {
  try {
    const {
      title,
      groom_name,
      bride_name,
      venue,
      event_date,
      card_template
    } = req.body;

    const event = await Event.create({
      title,
      groom_name,
      bride_name,
      venue,
      event_date,
      card_template
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

  stream.on('data', (data) => {
    results.push({
      name: data.name,
      phone: data.phone,
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
    baseTemplateFilename: 'card_base6.jpg',
    outputFilename: `${guest.id}_card.png`
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
  createEvent
};
