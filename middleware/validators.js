// const { body, validationResult } = require('express-validator');

// // Define your validation and sanitization rules
// const validateEventInput = [
//   body('title')
//     .trim()
//     .notEmpty().withMessage('Event title is required')
//     .escape(), // Converts <, >, &, etc., to safe HTML entities

//   body('venue')
//     .trim()
//     .notEmpty().withMessage('Venue is required')
//     .escape(),

//   body('groom_name')
//     .trim()
//     .escape(),

//   body('bride_name')
//     .trim()
//     .escape(),

//   // This final function checks if any errors were found by the rules above
//   (req, res, next) => {
//     const errors = validationResult(req);

//     if (!errors.isEmpty()) {
//       // If validation fails, return a 400 Bad Request with the errors
//       // (You can also render your EJS form again passing errors if you prefer)
//       return res.status(400).json({ errors: errors.array() });
//     }

//     // If everything is clean, move on to your controller function
//     next();
//   }
// ];

// const validateRegister = [
//   body('name')
//     .trim()
//     .notEmpty().withMessage('Name is required.')
//     .escape(), // Prevents XSS by escaping HTML characters

//   body('email')
//     .trim()
//     .isEmail().withMessage('Please provide a valid email address.')
//     .normalizeEmail(), // Standardizes email format

//   body('password')
//     .notEmpty().withMessage('Password is required.')
//     .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),

//   body('confirm_password')
//     .custom((value, { req }) => {
//       if (value !== req.body.password) {
//         throw new Error('Passwords do not match.');
//       }
//       return true;
//     }),

//   (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).render('auth/register', {
//         event: null,
//         error: errors.array()[0].msg, // Display the first validation error
//         name: req.body.name,
//         email: req.body.email
//       });
//     }
//     next();
//   }
// ];

// // Validation rules for Login
// const validateLogin = [
//   body('email')
//     .trim()
//     .isEmail().withMessage('Please provide a valid email address.')
//     .normalizeEmail(),

//   body('password')
//     .notEmpty().withMessage('Password is required.'),

//   (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).render('auth/login', {
//         event: null,
//         error: errors.array()[0].msg,
//         email: req.body.email
//       });
//     }
//     next();
//   }
// ];

// module.exports = { validateEventInput, validateRegister, validateLogin };


const { body, validationResult } = require('express-validator');

// Helper function to detect malicious or unauthorized code patterns
const containsMaliciousPatterns = (value) => {
  if (typeof value !== 'string') return false;

  // Patterns to detect:
  // 1. HTML / Script tags (<script>, <img ...>, <html>, <body>, etc.)
  // 2. SQL injection tautologies (' OR '1'='1, etc.)
  // 3. Command execution functions (system(...), etc.)
  const dangerousPatterns = [
    /<[a-z][\s\S]*>/i,                                  // Catches any HTML/XML tags
    /('|\")\s*(OR|AND)\s*('|\")?\s*[\w\d-]+\s*=\s*['|\"]?/i, // Catches basic SQLi like ' OR '1'='1
    /\b(system|exec|eval|passthru|shell_exec)\s*\(/i      // Catches code execution functions
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(value)) {
      return true; // Malicious pattern found
    }
  }
  return false;
};

// Reusable security check
const validateNoMaliciousInput = (value) => {
  if (containsMaliciousPatterns(value)) {
    const err = new Error('Invalid input detected. Potentially unsafe characters or scripts are not allowed.');
    err.status = 400; // Attach the code you want
    throw err; // Stop execution and throw up to the controller
  }
  return true;
};

// Define your validation and sanitization rules
const validateEventInput = [
  body('title')
    .custom(validateNoMaliciousInput) // Reject malicious payloads first
    .trim()
    .notEmpty().withMessage('Event title is required')
    .escape(),

  body('venue')
    .custom(validateNoMaliciousInput)
    .trim()
    .notEmpty().withMessage('Venue is required')
    .escape(),

  body('groom_name')
    .custom(validateNoMaliciousInput)
    .trim()
    .escape(),

  body('bride_name')
    .custom(validateNoMaliciousInput)
    .trim()
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateRegister = [
  body('name')
    .custom(validateNoMaliciousInput)
    .trim()
    .notEmpty().withMessage('Name is required.')
    .escape(),

  body('email')
    .custom(validateNoMaliciousInput)
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

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
        error: errors.array()[0].msg,
        name: req.body.name,
        email: req.body.email
      });
    }
    next();
  }
];

const validateLogin = [
  body('email')
    .custom(validateNoMaliciousInput)
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