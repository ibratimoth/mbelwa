// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// 🔒 1. Strict Limiter: Protects Authentication, Password Reset, and Session Unlock
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // Limit each IP to 5 failed/total attempts per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many login or unlock attempts from this IP. Please try again after 15 minutes.'
  }
});

// 🌐 2. General API Limiter: Protects standard backend endpoints & data routes
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1-minute window
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.'
  }
});

module.exports = { authLimiter, apiLimiter };