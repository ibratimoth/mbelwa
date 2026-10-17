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

module.exports = { validateEventInput };