// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const { sequelize } = require('./models');
const attendeesRoutes = require('./routes/attendees');
const engine = require('ejs-mate'); // <-- add this

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'))

// View engine setup
app.engine('ejs', engine); // <-- enables ejs-mate layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => res.redirect('/attendees'));
app.use('/attendees', attendeesRoutes);

// Start the server
async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://95.217.22.143:${PORT}`)
    );
  } catch (err) {
    console.error('❌ Failed to start:', err);
  }
}

start();
