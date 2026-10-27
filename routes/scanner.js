const express = require('express');
const router = express.Router();
const verifyCsrf = require('../middleware/verifyCsrf');

const {
  showPublicScanner,
  scanGuestByToken
} = require('../controllers/attendeesController');

router.get(
  '/scanner/:token',
  showPublicScanner
);

// Scan via token
router.post(
  '/scanner/:token/scan',verifyCsrf,
  scanGuestByToken
);

module.exports = router;