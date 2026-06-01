
// Guards routes that require an authenticated session.
// Stores the attempted URL so the user can be redirected back after login.
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        req.session.flash       = { type: 'warning', message: 'Please sign in to continue.' };
        req.session.returnTo    = req.originalUrl;
        return res.redirect('/login');
    }
    next();
};

module.exports = { requireAuth };
