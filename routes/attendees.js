// // routes/attendees.js
// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const path = require('path');
// const { showUploadForm, handleCsvUpload, list, editForm, updateGuest, downloadCard, scanGuest, showScan } = require('../controllers/attendeesController');

// const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, UPLOAD_DIR),
//   filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
// });
// const upload = multer({ storage });

// // list
// router.get('/', list);

// // upload form & handler
// router.get('/upload', showUploadForm);
// router.post('/upload', upload.single('csvfile'), handleCsvUpload);

// // edit
// router.get('/:id/edit', editForm);
// router.post('/:id/edit', updateGuest);

// // download
// router.get('/:id/download', downloadCard);
// router.post('/scan', scanGuest);
// router.get('/scan', showScan);

// module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const {
  showUploadForm,
  handleCsvUpload,
  list,
  editForm,
  updateGuest,
  downloadCard,
  scanGuest,
  showScan,
  createEvent
} = require('../controllers/attendeesController');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

/**
 * =========================
 * EVENT-SCOPED GUEST ROUTES
 * =========================
 */

// List guests for an event
router.get('/events/:eventId/guests', list);
router.post('/events/create', createEvent);

// Upload guests
router.get('/events/:eventId/guests/upload', showUploadForm);
router.post('/events/:eventId/guests/upload', upload.single('csvfile'), handleCsvUpload);

// Edit guest
router.get('/events/:eventId/guests/:id/edit', editForm);
router.post('/events/:eventId/guests/:id/edit', updateGuest);

// Download card
router.get('/events/:eventId/guests/:id/download', downloadCard);

// Scan (QR validation)
router.get('/events/:eventId/scan', showScan);
router.post('/events/:eventId/scan', scanGuest);

module.exports = router;
