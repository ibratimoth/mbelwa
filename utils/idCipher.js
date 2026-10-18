const crypto = require('crypto');

// Use a secure secret key from your .env file (must be at least 32 characters)
const ENCRYPTION_KEY = process.env.ID_SECRET_KEY || 'your-super-secret-key-32-chars-minimum!!';
const IV_LENGTH = 16; // AES block size

function encryptId(id) {
  if (!id) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(String(id), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Combine IV and encrypted payload, then encode as URL-safe Base64
  const combined = iv.toString('hex') + ':' + encrypted;
  return Buffer.from(combined).toString('base64url');
}

function decryptId(encryptedText) {
  if (!encryptedText) return null;
  try {
    const decoded = Buffer.from(encryptedText, 'base64url').toString('utf8');
    const [ivHex, encrypted] = decoded.split(':');
    if (!ivHex || !encrypted) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null; // Returns null if someone tampered with the token
  }
}

module.exports = { encryptId, decryptId };