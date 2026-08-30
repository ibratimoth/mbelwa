function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
}

function forwardAuthenticated(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }
  return res.redirect('/');
}

function setGlobalLocals(req, res, next) {
  res.locals.isAuthenticated = !!(req.session && req.session.userId);
  res.locals.currentUser = req.session ? req.session.user : null;
  next();
}

module.exports = {
  ensureAuthenticated,
  forwardAuthenticated,
  setGlobalLocals
};