// middleware/checkLock.js

function checkLockState(req, res, next) {
  // Only check lock status if the user has an active logged-in session
  if (req.session && req.session.userId && req.session.isLocked) {
    const now = Date.now();
    const maxLockDuration = 30 * 60 * 1000; // 30 minutes prolonged lock threshold

    // 1. Initialize lock timestamp if missing
    if (!req.session.lockTimestamp) {
      req.session.lockTimestamp = now;
      console.log(`[Lockout Guard] 🔒 Session (${req.session.userId}) flagged as LOCKED at ${new Date(now).toISOString()}`);
    } 
    // 2. Hard logout check for prolonged inactivity while locked
    else if (now - req.session.lockTimestamp > maxLockDuration) {
      console.warn(`[Lockout Guard] ⚠️ Prolonged lock threshold exceeded for user (${req.session.userId}). Destroying session.`);
      
      return req.session.destroy((err) => {
        if (err) console.error('[Lockout Guard] Error destroying expired session:', err);
        res.clearCookie('delle.sid');
        return res.redirect('/login?error=Session+expired+due+to+prolonged+inactivity.');
      });
    }

    // 3. Allow requests targeting /lock and /unlock endpoints to proceed
    const allowedPaths = ['/lock', '/unlock', '/logout'];
    if (!allowedPaths.includes(req.path)) {
      console.log(`[Lockout Guard] ⛔ Redirecting locked user from ${req.path} -> /lock`);
      return res.redirect('/lock');
    }
  }

  next();
}

module.exports = { checkLockState };