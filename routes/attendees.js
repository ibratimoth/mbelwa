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
} = require('../controllers/attendeesController');
const logger = require('../utils/logger');

const { ensureAuthenticated } = require('../middleware/auth');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    logger.info('Uploading file:', file.fieldname, file.originalname);
    if (file.fieldname === 'card_template') {
      return cb(null, 'public/templates');
    }

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
router.use(ensureAuthenticated);

router.post('/events/:id/send-invite', sendInvite);
router.post('/events/:id/send-invite-whatsapp', sendWhatsAppInvite);
// List guests for an event
router.get('/events/:eventId/guests', list);
router.post('/events/create', upload.single('card_template'), createEvent);

router.get('/events/:id/preview', previewCard);
router.post('/events/:id/layout', updateLayoutConfig);
router.get('/events/:id/editor', showEditor);

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

// Generate scanner link
router.post(
  '/events/:id/generate-scanner-link',
  generateScannerLink
);

// Public scanner
router.get(
  '/scanner/:token',
  showPublicScanner
);

// Scan via token
router.post(
  '/scanner/:token/scan',
  scanGuestByToken
);

router.post('/events/:id/send-scanner-link', sendScannerLink);

router.post('/sms/webhook', smsWebhook);

// Add GET handler for provider verification checks
router.get('/sms/webhook', (req, res) => {
  return res.status(200).send('Webhook endpoint active');
});

router.get(
  '/sms/campaigns/:campaignId/summary',
  getCampaignSummary
);

router.post(
  '/sms/campaigns/:campaignId/retry-failed',
  retryFailedSms
);

module.exports = router;
