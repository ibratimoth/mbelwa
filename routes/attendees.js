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

const { validateEventInput } = require('../middleware/validators');
const { decryptRouteIds } = require('../middleware/decryptParams');
const { verifyEventOwnership } = require('../middleware/authOwnership');
const verifyCsrf = require('../middleware/verifyCsrf');

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
    // Generate a cryptographically safe unique name combined with the original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Updated file filter to accept JPG, PNG, PDF, and CSV files
const fileFilter = (req, file, cb) => {
  // Added 'csv' to allowed extensions
  const allowedExtensions = /jpeg|jpg|png|pdf|csv/;
  
  // Added CSV MIME types (text/csv and Excel compatibility type)
  const allowedMimeTypes = [
    'image/jpeg', 
    'image/png', 
    'application/pdf', 
    'text/csv', 
    'application/vnd.ms-excel'
  ];

  const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedMimeTypes.includes(file.mimetype);

  if (extName && mimeType) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, PDF, and CSV files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * =========================
 * EVENT-SCOPED GUEST ROUTES
 * =========================
 */

// Public scanner


router.use(ensureAuthenticated);

router.post('/events/:id/send-invite', decryptRouteIds, verifyCsrf,sendInvite);
router.post('/events/:id/send-invite-whatsapp', decryptRouteIds, verifyCsrf,sendWhatsAppInvite);
// List guests for an event
router.get('/events/:eventId/guests', decryptRouteIds, verifyEventOwnership, list);
router.post('/events/create', upload.single('card_template'), validateEventInput, verifyCsrf, createEvent);

router.get('/events/:id/preview', decryptRouteIds, verifyEventOwnership,previewCard);
router.post('/events/:id/layout', decryptRouteIds, updateLayoutConfig);
router.get('/events/:id/editor', decryptRouteIds, verifyEventOwnership, showEditor);

// Upload guests
router.get('/events/:eventId/guests/upload', decryptRouteIds, verifyEventOwnership,showUploadForm);
router.post('/events/:eventId/guests/upload', decryptRouteIds, upload.single('csvfile'), verifyCsrf,handleCsvUpload);

// Edit guest
router.get('/events/:eventId/guests/:id/edit', decryptRouteIds, verifyEventOwnership, editForm);
router.post('/events/:eventId/guests/:id/edit', decryptRouteIds, verifyCsrf,updateGuest);

// Download card
router.get('/events/:eventId/guests/:id/download', decryptRouteIds, verifyEventOwnership, downloadCard);

// Scan (QR validation)
router.get('/events/:eventId/scan', decryptRouteIds, verifyEventOwnership, showScan);
router.post('/events/:eventId/scan', decryptRouteIds, verifyCsrf,scanGuest);

// Generate scanner link
router.post(
  '/events/:id/generate-scanner-link', decryptRouteIds,verifyCsrf,
  generateScannerLink
);



router.post('/events/:id/send-scanner-link', decryptRouteIds, verifyCsrf,sendScannerLink);

router.post('/sms/webhook', verifyCsrf,smsWebhook);

// Add GET handler for provider verification checks
router.get('/sms/webhook', (req, res) => {
  return res.status(200).send('Webhook endpoint active');
});

router.get(
  '/sms/campaigns/:campaignId/summary', decryptRouteIds,
  getCampaignSummary
);

router.post(
  '/sms/campaigns/:campaignId/retry-failed', decryptRouteIds, verifyCsrf,
  retryFailedSms
);

module.exports = router;
