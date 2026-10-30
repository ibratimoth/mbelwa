'use strict';
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forwardAuthenticated, ensureAuthenticated } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');
const verifyCsrf = require('../middleware/verifyCsrf');

router.get('/login', forwardAuthenticated, authController.renderLogin);
router.post('/login', forwardAuthenticated, validateLogin, authLimiter, authController.handleLogin);

router.get('/register', forwardAuthenticated, authController.renderRegister);
router.post('/register', forwardAuthenticated, validateRegister, authLimiter, authController.handleRegister);

router.post('/logout', ensureAuthenticated, authController.handleLogout);

// Session Lock routes
router.get('/lock', authController.renderLock);
router.post('/unlock', verifyCsrf, authLimiter, authController.handleUnlock);
router.post('/api/session/lock', authController.triggerLockoutApi);

module.exports = router;