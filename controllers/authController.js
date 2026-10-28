'use strict';
const { user: User } = require('../models');

async function renderLogin(req, res) {
  res.render('auth/login', { event: null, error: null });
}

async function handleLogin(req, res, next) {
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

    // 🔒 REGENERATE SESSION: Prevents session fixation by issuing a brand-new session ID upon login
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return next(err); // Or handle via your error render/middleware
      }

      // Assign user identification data to the fresh, secure session
      req.session.userId = foundUser.id;
      req.session.user = {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email
      };

      // 🔒 INITIALIZE LOCK STATE TO FALSE
      req.session.isLocked = false;
      delete req.session.lockTimestamp;

      // Save the regenerated session before redirecting to prevent race conditions
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return next(err);
        }
        res.redirect('/');
      });
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

// 1. Render Lock Screen
async function renderLock(req, res) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  // Ensure session is marked as locked when viewing lock page
  req.session.isLocked = true;
  if (!req.session.lockTimestamp) {
    req.session.lockTimestamp = Date.now();
  }

  res.render('auth/lock', {
    user: req.session.user,
    error: null,
    csrfToken: req.session.csrfToken
  });
}

// 2. Handle Unlock Submission
async function handleUnlock(req, res, next) {
  try {
    const { password } = req.body;

    // 1. Validate password presence
    if (!password) {
      return res.status(400).render('auth/lock', {
        user: req.session.user,
        error: 'Password is required to unlock.',
        csrfToken: req.session.csrfToken
      });
    }

    // 2. Fetch active session user from database
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      console.warn(`[Lockout Controller] ⚠️ User ID (${req.session.userId}) not found during unlock. Destroying session.`);
      return req.session.destroy(() => {
        res.clearCookie('delle.sid');
        res.redirect('/login');
      });
    }

    // 3. Verify password match
    const isMatch = await user.validPassword(password);
    if (!isMatch) {
      console.warn(`[Lockout Controller] ❌ Incorrect unlock password attempt for user ID: ${req.session.userId}`);
      return res.status(401).render('auth/lock', {
        user: req.session.user,
        error: 'Incorrect password. Please try again.',
        csrfToken: req.session.csrfToken
      });
    }

    // 4. Password valid -> Clear lockout flags
    console.log(`[Lockout Controller] ✅ Session successfully unlocked for user ID: ${req.session.userId}`);
    req.session.isLocked = false;
    delete req.session.lockTimestamp;

    // 5. 🎯 PRE-LOCKOUT RETURN URL RESTORATION
    let destination = req.session.returnTo || '/';
    delete req.session.returnTo; // Always delete to prevent stale redirect loops

    // 6. 🛡️ OPEN REDIRECT GUARD: Ensure destination is strictly a relative local path starting with '/'
    if (!destination.startsWith('/') || destination.startsWith('//')) {
      console.warn(`[Lockout Controller] ⚠️ Untrusted redirect target detected (${destination}). Fallback to '/'`);
      destination = '/';
    }

    console.log(`[Lockout Controller] 🔀 Restoring user navigation session to: ${destination}`);

    // 7. Save session state changes securely before completing redirect
    req.session.save((err) => {
      if (err) {
        console.error('[Lockout Controller] Session save error during unlock:', err);
        return next(err);
      }
      res.redirect(destination);
    });

  } catch (err) {
    console.error('[Lockout Controller] Unlock handling exception:', err);
    next(err);
  }
}

// 3. API Endpoint called when the 10s countdown finishes on frontend
async function triggerLockoutApi(req, res) {
  if (req.session && req.session.userId) {
    req.session.isLocked = true;
    req.session.lockTimestamp = Date.now();

    // Save the exact pre-lockout route sent from the client
    if (req.body && req.body.returnTo && typeof req.body.returnTo === 'string') {
      req.session.returnTo = req.body.returnTo;
      console.log(`[Lockout] Saved pre-lockout location: ${req.session.returnTo}`);
    }

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to lock session' });
      }
      return res.json({ success: true, redirect: '/lock' });
    });
  } else {
    res.status(401).json({ success: false, redirect: '/login' });
  }
}

module.exports = {
  renderLogin,
  handleLogin,
  renderRegister,
  handleRegister,
  handleLogout,
  renderLock,
  handleUnlock,
  triggerLockoutApi
};