'use strict';
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forwardAuthenticated, ensureAuthenticated } = require('../middleware/auth');

router.get('/login', forwardAuthenticated, authController.renderLogin);
router.post('/login', forwardAuthenticated, authController.handleLogin);

router.get('/register', forwardAuthenticated, authController.renderRegister);
router.post('/register', forwardAuthenticated, authController.handleRegister);

router.post('/logout', ensureAuthenticated, authController.handleLogout);

module.exports = router;