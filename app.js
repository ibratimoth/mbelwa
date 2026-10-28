const { Sentry, sentryCampaignContext } = require('./utils/sentry');
require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const engine = require('ejs-mate');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const session = require('express-session');

// Import Custom Middlewares
const { setGlobalLocals, ensureAuthenticated } = require('./middleware/auth');
const { enforceSessionFingerprint } = require('./middleware/sessionFingerprint');
const { autoEncryptView } = require('./middleware/autoEncryptView');
const { checkLockState } = require('./middleware/checkLock');

const { sequelize } = require('./models');
const eventRoutes = require('./routes/events');
const smsQueue = require('./queues/smsQueue');
const logger = require('./utils/logger');
const crypto = require('crypto');

const { client, gateScanCounter, smsDispatchedCounter } = require('./utils/metrics');

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// 1. Core Body Parsers (Must be at the top)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(sentryCampaignContext);
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});

// 2. Secure Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  name: 'delle.sid', // Obscures tech stack footprint
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,              // Prevents XSS cookie theft
    secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
    sameSite: 'strict'           // Prevents cross-site request forgery via cookies
  }
}));

// 3. 🔒 Session Hijacking Defense: Fingerprint Validation
// Must run immediately after session loading, before any routes or view injectors
app.use(enforceSessionFingerprint);

// 4. Global View Token Injector
app.use(autoEncryptView);

app.use(checkLockState);

// Static Assets & Logging
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

// View Engine Configuration
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Public & Authentication Routes (No auth check required upfront)
const authRoutes = require('./routes/auth');
const scannerRoutes = require('./routes/scanner');

app.use('/', authRoutes);
app.use('/', scannerRoutes);

// Prometheus Metrics Endpoint & CSRF Token API
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    logger.error({ err }, "Failed to generate Prometheus metrics stream context");
    res.status(500).end(err);
  }
});

app.get('/api/csrf-token', (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ csrfToken: req.session.csrfToken });
});

// 5. Protected Routes Guard (Applies authentication requirements downstream)
app.use(setGlobalLocals);
app.use(ensureAuthenticated);

app.get('/', async (req, res) => {
  try {
    const { event: Event } = require('./models');

    // 1. Fetch raw plain objects using plain: true or .map(e => e.get({ plain: true }))
    const rawEvents = await Event.findAll({
      order: [['createdAt', 'DESC']],
      where: { user_id: req.session.userId }
    });

    // 2. Normalize and format event dates directly in Node.js
    const events = rawEvents.map(event => {
      const eventData = event.get({ plain: true });

      let parsedDate = null;
      if (eventData.event_date) {
        // Directly parse whether it's already a Date object or an ISO string
        const dateObj = new Date(eventData.event_date);
        if (!isNaN(dateObj.getTime())) {
          parsedDate = dateObj;
        }
      }

      return {
        ...eventData,
        formattedDate: parsedDate
          ? parsedDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
          : 'Date TBD',
        monthStr: parsedDate
          ? parsedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
          : 'TBD',
        dayStr: parsedDate
          ? parsedDate.toLocaleDateString('en-US', { day: '2-digit' })
          : '--'
      };
    });

    // 3. Guard against session user being undefined
    const user = {
      name: req.session?.user?.name || 'User',
      email: req.session?.user?.email || 'unknown'
    };

    res.render('events/list', { events, user });
  } catch (error) {
    console.error('Error fetching events dashboard:', error);
    res.status(500).render('error', { message: 'Failed to load events dashboard' });
  }
});

const attendeesRoutes = require('./routes/attendees');
app.use('/', attendeesRoutes);
app.use('/', eventRoutes);

// Bull-Board Queue Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(smsQueue)
  ],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());

// Error Handlers
if (process.env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler());
}

app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).send('Internal Server Error');
});

// Database Connection & Server Startup
async function start() {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connected');

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    logger.error('Failed to start:', err);
  }
}

start();