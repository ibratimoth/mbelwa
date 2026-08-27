const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    // In V8, tracing integration is built-in automatically!
    tracesSampleRate: 0.2, 
  });
}

// Custom middleware to bind errors to specific client events/campaigns automatically
function sentryCampaignContext(req, res, next) {
  const eventId = req.params.eventId || req.params.id || req.body.eventId || req.query.eventId;
  
  if (eventId) {
    // In V8, configureScope is replaced by the cleaner, functional getIsolatedScope()
    const scope = Sentry.getIsolatedScope();
    scope.setTag("campaign_id", eventId);
    scope.setTag("http_method", req.method);
  }
  next();
}

module.exports = { Sentry, sentryCampaignContext };