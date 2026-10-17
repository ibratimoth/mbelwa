'use strict';
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forwardAuthenticated, ensureAuthenticated } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validators');

router.get('/login', forwardAuthenticated, authController.renderLogin);
router.post('/login', forwardAuthenticated, validateLogin, authController.handleLogin);

router.get('/register', forwardAuthenticated, authController.renderRegister);
router.post('/register', forwardAuthenticated, validateRegister, authController.handleRegister);

router.post('/logout', ensureAuthenticated, authController.handleLogout);

module.exports = router;