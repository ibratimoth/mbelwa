'use strict';
const { user: User } = require('../models');

async function renderLogin(req, res) {
  res.render('auth/login', { event: null, error: null });
}

async function handleLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('auth/login', {
        event: null,
        error: 'Please enter both email and password.',
        email
      });
    }

    const foundUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!foundUser) {
      return res.status(401).render('auth/login', {
        event: null,
        error: 'Invalid credentials provided.',
        email
      });
    }

    const isMatch = await foundUser.validPassword(password);
    if (!isMatch) {
      return res.status(401).render('auth/login', {
        event: null,
        error: 'Invalid credentials provided.',
        email
      });
    }

    req.session.userId = foundUser.id;
    req.session.user = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email
    };

    req.session.save((err) => {
      if (err) throw err;
      res.redirect('/');
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('auth/login', { event: null, error: 'Internal server error occurred.' });
  }
}

async function renderRegister(req, res) {
  res.render('auth/register', { event: null, error: null });
}

async function handleRegister(req, res) {
  try {
    const { name, email, password, confirm_password } = req.body;

    if (!name || !email || !password || !confirm_password) {
      return res.status(400).render('auth/register', {
        event: null,
        error: 'All fields are required.',
        name,
        email
      });
    }

    if (password !== confirm_password) {
      return res.status(400).render('auth/register', {
        event: null,
        error: 'Passwords do not match.',
        name,
        email
      });
    }

    const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).render('auth/register', {
        event: null,
        error: 'An account with this email already exists.',
        name
      });
    }

    await User.create({
      name,
      email: email.toLowerCase().trim(),
      password
    });

    res.redirect('/login');

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).render('auth/register', { event: null, error: 'Failed to create user account.' });
  }
}

async function handleLogout(req, res) {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}

module.exports = {
  renderLogin,
  handleLogin,
  renderRegister,
  handleRegister,
  handleLogout
};