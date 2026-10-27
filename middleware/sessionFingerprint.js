// middleware/sessionFingerprint.js
const logger = require('../utils/logger'); // or console.log if preferred

function enforceSessionFingerprint(req, res, next) {
  // Skip if user is not logged in
  if (!req.session || !req.session.userId) {
    return next();
  }

  const currentUserAgent = req.headers['user-agent'] || 'unknown';

  // 1. If fingerprint doesn't exist yet, bind it to this session upon login/first encounter
  if (!req.session.deviceFingerprint) {
    req.session.deviceFingerprint = currentUserAgent;
    console.log(`[Fingerprint] 🔒 Bound new session (${req.session.id.substring(0, 6)}...) to User-Agent: ${currentUserAgent.substring(0, 40)}...`);
  } 
  // 2. Compare current browser signature against the stored session fingerprint
  else if (req.session.deviceFingerprint !== currentUserAgent) {
    console.warn(`[Fingerprint] ❌ SECURITY WARNING: User-Agent mismatch detected for session ID: ${req.session.id.substring(0, 6)}...`);
    console.warn(`[Fingerprint] Expected: ${req.session.deviceFingerprint.substring(0, 40)}...`);
    console.warn(`[Fingerprint] Received: ${currentUserAgent.substring(0, 40)}...`);

    // Destroy compromised session immediately to block hijacking
    return req.session.destroy((err) => {
      if (err) {
        console.error('[Fingerprint] Error destroying compromised session:', err);
      }
      res.clearCookie('delle.sid'); // Clear your session cookie name
      return res.redirect('/login?error=Session+security+violation+detected.+Please+log+in+again.');
    });
  }

  next();
}

module.exports = { enforceSessionFingerprint };