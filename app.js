// // app.js
// require('dotenv').config();
// const express = require('express');
// const path = require('path');
// const morgan = require('morgan');
// const { sequelize } = require('./models');
// const attendeesRoutes = require('./routes/attendees');
// const engine = require('ejs-mate'); // <-- add this

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use('/public', express.static(path.join(__dirname, 'public')));
// app.use(express.static(path.join(__dirname, 'public')));
// app.use(morgan('dev'))

// // View engine setup
// app.engine('ejs', engine); // <-- enables ejs-mate layouts
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));

// // Routes
// app.get('/', (req, res) => res.redirect('/attendees'));
// app.use('/attendees', attendeesRoutes);

// // Start the server
// async function start() {
//   try {
//     await sequelize.authenticate();
//     console.log('✅ Database connected');
//     app.listen(PORT, () =>
//       console.log(`🚀 Server running on http://localhost:${PORT}`)
//     );
//   } catch (err) {
//     console.error('❌ Failed to start:', err);
//   }
// }

// start();

require('dotenv').config();

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const engine = require('ejs-mate');

const { sequelize } = require('./models');
const attendeesRoutes = require('./routes/attendees');
const eventRoutes = require('./routes/events');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * =========================
 * MIDDLEWARE
 * =========================
 */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(morgan('dev'));

/**
 * =========================
 * VIEW ENGINE
 * =========================
 */
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/**
 * =========================
 * ROUTES
 * =========================
 */

// Home → redirect to event-based entry (recommended)
app.get('/', async (req, res) => {
  const { event: Event } = require('./models');

  const events = await Event.findAll({
    order: [['createdAt', 'DESC']]
  });

  res.render('events/list', { events });
});

app.use('/', attendeesRoutes);

app.use('/', eventRoutes);

/**
 * =========================
 * SERVER START
 * =========================
 */
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