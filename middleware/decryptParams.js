const { decryptId } = require('../utils/idCipher');

function decryptRouteIds(req, res, next) {
    // Check all route parameters (e.g., req.params.id, req.params.eventId)
    for (const key of Object.keys(req.params)) {
        if (key.toLowerCase().includes('id')) {
            const encryptedVal = req.params[key];
            const decryptedVal = decryptId(encryptedVal);

            if (!decryptedVal) {
                return res.status(400).render('error', {
                    status: 400,
                    message: 'Bad Request: Invalid or tampered resource identifier.',
                    error: null
                });
            }

            // Replace the encrypted token with the real database ID for your controllers
            req.params[key] = decryptedVal;
        }
    }
    next();
}

module.exports = { decryptRouteIds };