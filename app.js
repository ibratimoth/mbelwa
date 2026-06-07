require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const engine = require('ejs-mate');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const { sequelize } = require('./models');
const attendeesRoutes = require('./routes/attendees');
const eventRoutes = require('./routes/events');
const smsQueue = require('./queues/smsQueue');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Failed to start:', err);
  }
}

start();