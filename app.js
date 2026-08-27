
const { Sentry, sentryCampaignContext } = require('./utils/sentry');
require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const engine = require('ejs-mate');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const { sequelize } = require('./models');
const eventRoutes = require('./routes/events');
const smsQueue = require('./queues/smsQueue');
const logger = require('./utils/logger');

const { client, gateScanCounter, smsDispatchedCounter } = require('./utils/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app); 
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(sentryCampaignContext);
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});
// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    logger.error({ err }, "Failed to generate Prometheus metrics stream context");
    res.status(500).end(err);
  }
});

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(morgan('dev'));

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', async (req, res) => {
  const { event: Event } = require('./models');

  const events = await Event.findAll({
    order: [['createdAt', 'DESC']]
  });

  res.render('events/list', { events });
});

const attendeesRoutes = require('./routes/attendees');

app.use('/', attendeesRoutes);

app.use('/', eventRoutes);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(smsQueue)
  ],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());

if (process.env.SENTRY_DSN) {
  // This catches any error passed via next(err) in your controllers
  app.use(Sentry.expressErrorHandler());
}

app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).send('Internal Server Error');
});

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