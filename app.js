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
const { apiLimiter } = require('./middleware/rateLimiter');

const { sequelize } = require('./models');
const eventRoutes = require('./routes/events');
const authRoutes = require('./routes/auth');
const scannerRoutes = require('./routes/scanner');
const attendeesRoutes = require('./routes/attendees');
const smsQueue = require('./queues/smsQueue');
const logger = require('./utils/logger');
const crypto = require('crypto');
const helmet = require('helmet');

const { client, gateScanCounter, smsDispatchedCounter } = require('./utils/metrics');

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// 1. Core Body Parsers & Trust Proxy
app.set('trust proxy', 1); // Crucial for reverse proxies (Apache/Nginx)
// app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(sentryCampaignContext);
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});

// 2. Security Headers (CSP)
// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: [
//         "'self'", 
//         "'unsafe-inline'", 
//         "https://cdn.jsdelivr.net",
//         "https://unpkg.com" // Required for QR code scanner
//       ],
//       styleSrc: [
//         "'self'", 
//         "'unsafe-inline'", 
//         "https://cdn.jsdelivr.net", 
//         "https://fonts.googleapis.com"
//       ],
//       fontSrc: [
//         "'self'", 
//         "https://fonts.gstatic.com", 
//         "https://cdn.jsdelivr.net"
//       ],
//       imgSrc: ["'self'", "data:", "blob:"],
//      connectSrc: [
//         "'self'", 
//         "http://localhost:3000", 
//         "https://localhost:3000",
//         "https://cdn.jsdelivr.net"
//       ],
//       frameAncestors: ["'none'"]
//     }
//   })
// );

// 3. Secure Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  name: 'delle.sid',
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}));

// 4. Session Security & Fingerprinting
app.use(enforceSessionFingerprint);

// 5. Static Assets & Logging (Moved UP so static files bypass guards)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

// View Engine Configuration
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 6. Public & Authentication Routes (Mounted BEFORE checkLockState)
app.use('/', authRoutes);
app.use('/', scannerRoutes);

// 7. Global View Token & Inactivity Lockout Guard 
// (Runs only for authenticated session paths below this line)
app.use(autoEncryptView);
app.use(checkLockState);

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

// 8. Protected Routes Guard
app.use(setGlobalLocals);
app.use(ensureAuthenticated);
app.use(apiLimiter); // Apply general API rate limiting to all authenticated routes

app.get('/', async (req, res) => {
  try {
    const { event: Event } = require('./models');

    const rawEvents = await Event.findAll({
      order: [['createdAt', 'DESC']],
      where: { user_id: req.session.userId }
    });

    const events = rawEvents.map(event => {
      const eventData = event.get({ plain: true });

      let parsedDate = null;
      if (eventData.event_date) {
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

// Database Connection & Server Startu
async function start() {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connected');

    app.listen(PORT,'127.0.0.1', () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    logger.error('Failed to start:', err);
  }
}

start();