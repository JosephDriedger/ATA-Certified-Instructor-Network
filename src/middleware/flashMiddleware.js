
// Transfers a one-time flash message from the session into res.locals
// so every view can access it without being explicitly passed.
// The session entry is deleted immediately so it only shows once.
const flashMiddleware = (req, res, next) => {
    res.locals.flash = req.session.flash ?? null;
    delete req.session.flash;
    next();
};

module.exports = flashMiddleware;
