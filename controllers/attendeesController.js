// controllers/attendeesController.js
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { guest: Guest } = require('../models');
const { generateQRCodeToFile } = require('../utils/qrcode');
const { generateCardPNG } = require('../utils/cardGenerator');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

async function list(req, res) {
    const guests = await Guest.findAll({ order: [['createdAt', 'DESC']] });
    res.render('attendees/list', { guests });
}

async function showScan(req, res) {
    res.render('attendees/scan');
}

async function showUploadForm(req, res) {
    res.render('upload');
}

async function handleCsvUpload(req, res) {
    // multer has put file in req.file
    if (!req.file) return res.status(400).send('No file uploaded.');

    const results = [];
    const stream = fs.createReadStream(req.file.path)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
        }));

    stream.on('data', (data) => {
        // expecting CSV headers: name,type
        console.log('data:', data);

        results.push({
            name: data.name,
            phone: data.phone,
            type: (data.type?.trim().toLowerCase() === 'double') ? 'double' : 'single'
        });
    });

    stream.on('end', async () => {
        // For each, create DB record and generate QR
        for (const row of results) {
            try {
                const id = uuidv4();
                // qr will contain the attendee id and name for uniqueness
                const qrFilename = `${id}.png`;
                const qrPath = await generateQRCodeToFile(JSON.stringify({ id, name: row.name }), qrFilename);

                const guest = await Guest.create({
                    id,
                    name: row.name,
                    phone: row.phone,
                    type: row.type,
                    qr_code_path: qrPath
                });
                // optionally generate card on the fly — but we'll generate on download
            } catch (e) {
                console.error('Error on row', row, e);
            }
        }
        res.redirect('/attendees');
    });

    stream.on('error', (err) => {
        console.error(err);
        res.status(500).send('Failed to process CSV');
    });
}

async function editForm(req, res) {
    const guest = await Guest.findByPk(req.params.id);
    if (!guest) return res.status(404).send('Guest not found');
    res.render('attendees/edit', { guest });
}

async function updateGuest(req, res) {
    const guest = await Guest.findByPk(req.params.id);
    if (!guest) return res.status(404).send('Guest not found');

    const { name, type, phone, scans } = req.body;
    await guest.update({ name, type, phone, scans });
    res.redirect('/attendees');
}

async function downloadCard(req, res) {
    const guest = await Guest.findByPk(req.params.id);
    if (!guest) return res.status(404).send('Guest not found');

    // Ensure QR exists, otherwise regenerate
    let qrPath = guest.qr_code_path;
    if (!qrPath || !fs.existsSync(qrPath)) {
        const qrFilename = `${guest.id}.png`;
        qrPath = await generateQRCodeToFile(JSON.stringify({ id: guest.id, name: guest.name }), qrFilename);
        await guest.update({ qr_code_path: qrPath });
    }

    const outPath = await generateCardPNG({
        name: guest.name,
        type: guest.type,
        qrPath,
        baseTemplateFilename: 'card_base.jpg',
        outputFilename: `${guest.id}_card.png`
    });

    // stream the PNG as download
    res.download(outPath, `${guest.name.replace(/\s+/g, '_')}_card.png`);
}

async function scanGuest(req, res) {
  const { qrData } = req.body;

  try {
    const parsed = JSON.parse(qrData);
    const guest = await Guest.findByPk(parsed.id);

    if (!guest) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }

    const maxScans = guest.type === 'double' ? 2 : 1;

    if (guest.scans >= maxScans) {
      return res.json({ success: false, message: 'Guest already scanned maximum times' });
    }

    // Increment scan count
    guest.scans += 1;
    await guest.save();

    res.json({
      success: true,
      message: `Welcome ${guest.name}!`,
      scansRemaining: maxScans - guest.scans
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Invalid QR code' });
  }
}


module.exports = {
    list,
    showUploadForm,
    handleCsvUpload,
    editForm,
    updateGuest,
    downloadCard,
    scanGuest,
    showScan
};
