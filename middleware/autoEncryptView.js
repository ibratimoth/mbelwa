const { encryptId } = require('../utils/idCipher');

// Helper function to recursively traverse and encrypt ID fields in objects/arrays
function encryptDataIds(data) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(item => encryptDataIds(item));
  }

  if (typeof data === 'object' && data !== null) {
    const obj = typeof data.get === 'function' ? data.get({ plain: true }) : { ...data };

    for (const key of Object.keys(obj)) {
      if ((key === 'id' || key.endsWith('_id'))) {
        if (obj[key] && (typeof obj[key] === 'string' || typeof obj[key] === 'number')) {
          obj[key] = encryptId(obj[key]);
        }
      } else if (typeof obj[key] === 'object') {
        obj[key] = encryptDataIds(obj[key]);
      }
    }
    return obj;
  }

  return data;
}

function autoEncryptView(req, res, next) {
  const originalRender = res.render;
  const originalRedirect = res.redirect;

  // 1. Intercept res.render to encrypt IDs passed into EJS views
  res.render = function (view, options, callback) {
    if (options && typeof options === 'object') {
      for (const key of Object.keys(options)) {
        options[key] = encryptDataIds(options[key]);
      }
    }
    return originalRender.call(this, view, options, callback);
  };

  // 2. Intercept res.redirect to automatically encrypt any raw IDs in redirect URLs
res.redirect = function (url) {
    // Updated Regex to match both UUIDs (e.g., 8-4-4-4-12 hex chars) and standard alphanumeric/numeric IDs
    const uuidRegex = /\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?=\/|$|\?)/g;
    
    const encryptedUrl = url.replace(uuidRegex, (match, id) => {
      return '/' + encryptId(id);
    });

    return originalRedirect.call(this, encryptedUrl);
  };

  next();
}

module.exports = { autoEncryptView };