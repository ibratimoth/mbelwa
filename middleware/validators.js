const { body, validationResult } = require('express-validator');

// Define your validation and sanitization rules
const validateEventInput = [
  body('title')
    .trim()
    .notEmpty().withMessage('Event title is required')
    .escape(), // Converts <, >, &, etc., to safe HTML entities

  body('venue')
    .trim()
    .notEmpty().withMessage('Venue is required')
    .escape(),

  body('groom_name')
    .trim()
    .escape(),

  body('bride_name')
    .trim()
    .escape(),

  // This final function checks if any errors were found by the rules above
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      // If validation fails, return a 400 Bad Request with the errors
      // (You can also render your EJS form again passing errors if you prefer)
      return res.status(400).json({ errors: errors.array() });
    }
    
    // If everything is clean, move on to your controller function
    next();
  }
];

const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .escape(), // Prevents XSS by escaping HTML characters
  
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(), // Standardizes email format
  
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register', {
        event: null,
        error: errors.array()[0].msg, // Display the first validation error
        name: req.body.name,
        email: req.body.email
      });
    }
    next();
  }
];

// Validation rules for Login
const validateLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/login', {
        event: null,
        error: errors.array()[0].msg,
        email: req.body.email
      });
    }
    next();
  }
];

module.exports = { validateEventInput, validateRegister, validateLogin };