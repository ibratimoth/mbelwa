const express = require('express');
const router = express.Router();

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
  '/scanner/:token/scan',
  scanGuestByToken
);

module.exports = router;