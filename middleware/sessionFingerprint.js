// // middleware/sessionFingerprint.js
 const logger = require('../utils/logger'); // or console.log if preferred

// function enforceSessionFingerprint(req, res, next) {
//   // Skip if user is not logged in
//   if (!req.session || !req.session.userId) {
//     return next();
//   }

//   const currentUserAgent = req.headers['user-agent'] || 'unknown';

//   // 1. If fingerprint doesn't exist yet, bind it to this session upon login/first encounter
//   if (!req.session.deviceFingerprint) {
//     req.session.deviceFingerprint = currentUserAgent;
//     console.log(`[Fingerprint] 🔒 Bound new session (${req.session.id.substring(0, 6)}...) to User-Agent: ${currentUserAgent.substring(0, 40)}...`);
//   } 
//   // 2. Compare current browser signature against the stored session fingerprint
//   else if (req.session.deviceFingerprint !== currentUserAgent) {
//     console.warn(`[Fingerprint] ❌ SECURITY WARNING: User-Agent mismatch detected for session ID: ${req.session.id.substring(0, 6)}...`);
//     console.warn(`[Fingerprint] Expected: ${req.session.deviceFingerprint.substring(0, 40)}...`);
//     console.warn(`[Fingerprint] Received: ${currentUserAgent.substring(0, 40)}...`);

//     // Destroy compromised session immediately to block hijacking
//     return req.session.destroy((err) => {
//       if (err) {
//         console.error('[Fingerprint] Error destroying compromised session:', err);
//       }
//       res.clearCookie('delle.sid'); // Clear your session cookie name
//       return res.redirect('/login?error=Session+security+violation+detected.+Please+log+in+again.');
//     });
//   }

//   next();
// }

// module.exports = { enforceSessionFingerprint };

// middleware/sessionFingerprint.js

function enforceSessionFingerprint(req, res, next) {
  // Skip if user is not logged in
  if (!req.session || !req.session.userId) {
    return next();
  }

  const currentUserAgent = req.headers['user-agent'] || 'unknown';
  
  // Get the client's real IP (requires app.set('trust proxy', 1) in your main server file)
  const currentIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Combine both into a strict device fingerprint
  const currentFingerprint = `${currentUserAgent}__${currentIp}`;

  // 1. If fingerprint doesn't exist yet, bind it upon login/first request
  if (!req.session.deviceFingerprint) {
    req.session.deviceFingerprint = currentFingerprint;
    console.log(`[Fingerprint] 🔒 Bound new session to User-Agent & IP for User ID: ${req.session.userId}`);
  } 
  // 2. Compare current signature against the stored fingerprint
  else if (req.session.deviceFingerprint !== currentFingerprint) {
    console.warn(`[Fingerprint] ❌ SECURITY WARNING: Fingerprint mismatch detected for session ID: ${req.session.id.substring(0, 6)}...`);
    console.warn(`[Fingerprint] Expected: ${req.session.deviceFingerprint}`);
    console.warn(`[Fingerprint] Received: ${currentFingerprint}`);

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