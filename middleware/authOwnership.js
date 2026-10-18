const {
    event: Event
} = require('../models');

async function verifyEventOwnership(req, res, next) {
    try {
        // Grab eventId from route parameters (handles both /events/:id and /events/:eventId/guests)
        const eventId = req.params.eventId || req.params.id;

        if (!eventId) {
            return res.status(400).render('error', {
                status: 400,
                message: 'Event ID is required.',
                error: null
            });
        }

        console.log(`Verifying ownership for event ID: ${eventId} and user ID: ${req.session.userId}`);
        // Query database for the event matching BOTH the ID and the current user's session
        const event = await Event.findOne({
            where: {
                id: eventId,
                user_id: req.session.userId // Ensures user owns this resource
            }
        });

        if (!event) {
            // Return 403 Forbidden if it doesn't exist or belongs to someone else
                        return res.status(403).render('error', {
                status: 403,
                message: 'Access Denied: You do not have permission to access this event.',
                error: null
            });
        }

        // Attach the event to req so your controller can use it without querying again!
        req.event = event;
        next();
    } catch (err) {
        console.error('Ownership check error:', err);
        return res.status(500).render('error', {
            status: 500,
            message: 'Internal Server Error.',
            error: null
        });
    }
}

module.exports = { verifyEventOwnership };