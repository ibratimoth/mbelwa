// module.exports = function verifyCsrf(req, res, next) {
//   const clientToken = req.body._csrf || req.headers['x-csrf-token'];
//   const sessionToken = req.session.csrfToken;

//   if (!clientToken || clientToken !== sessionToken) {
//     // If it's an AJAX/fetch request, return JSON instead of rendering an HTML page
//     if (req.xhr || req.headers.accept?.includes('application/json') || req.method === 'POST' && req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers['x-csrf-token']) {
//       return res.status(403).json({ 
//         success: false, 
//         message: 'Security token validation failed or expired. Please refresh the page.' 
//       });
//     }

//     // Otherwise, render the full error page for regular browser form submits
//     return res.status(403).render('error', {
//       status: 403,
//       message: 'Security token validation failed or expired. Please refresh and try again.',
//       error: null
//     });
//   }

//   // Clear token to prevent reuse
//   req.session.csrfToken = null;
//   next();
// };

module.exports = function verifyCsrf(req, res, next) {
  // Extract client token from form body or request headers
  const clientToken = req.body._csrf || req.headers['x-csrf-token'];
  const sessionToken = req.session ? req.session.csrfToken : null;

  // Diagnostic Logs for incoming request
  console.log(`\n----------------------------------------`);
  console.log(`[CSRF Middleware] Route: ${req.method} ${req.originalUrl}`);
  console.log(`[CSRF Middleware] Client Token: ${clientToken ? 'Present (' + clientToken.substring(0, 6) + '...)' : 'MISSING'}`);
  console.log(`[CSRF Middleware] Session Token: ${sessionToken ? 'Present (' + sessionToken.substring(0, 6) + '...)' : 'MISSING'}`);

  // Validation Check
  if (!clientToken || clientToken !== sessionToken) {
    console.warn(`[CSRF Warning] ❌ Validation FAILED for ${req.method} ${req.originalUrl}`);
    if (!clientToken) console.warn(`[CSRF Reason] Client token was not provided in body or headers.`);
    if (clientToken && clientToken !== sessionToken) console.warn(`[CSRF Reason] Token mismatch! Client token does not match session token.`);

    // Determine if the request is an AJAX/fetch call
    const isAjax = req.xhr || 
                   req.headers.accept?.includes('application/json') || 
                   (req.method === 'POST' && req.headers['x-requested-with'] === 'XMLHttpRequest') || 
                   req.headers['x-csrf-token'];

    if (isAjax) {
      console.log(`[CSRF Response] 📦 Detected AJAX/Fetch request. Returning 403 JSON response.`);
      return res.status(403).json({ 
        success: false, 
        message: 'Security token validation failed or expired. Please refresh the page.' 
      });
    }

    console.log(`[CSRF Response] 📄 Detected standard browser form submit. Rendering 403 error page.`);
    return res.status(403).render('error', {
      status: 403,
      message: 'Security token validation failed or expired. Please refresh and try again.',
      error: null
    });
  }

  // Success path
  console.log(`[CSRF Success] ✅ Token validated successfully. Wiping session token to prevent reuse.`);
  
  // Clear token to enforce single-use replay protection
  req.session.csrfToken = null;
  console.log(`----------------------------------------\n`);
  
  next();
};