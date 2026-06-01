
const StatusCodes = require('../constants/statusCodes');

// Privilege-level gate.
//
// requireMinRole(minRoleId) passes when req.session.roleId >= minRoleId:
//   requireMinRole(1) → any authenticated user  (instructor and above)
//   requireMinRole(2) → school owners and admins
//   requireMinRole(3) → administrators only
//
// Usage:
//   router.get('/availability',  requireAuth, requireMinRole(Roles.INSTRUCTOR),    handler)
//   router.get('/profile/school',requireAuth, requireMinRole(Roles.SCHOOL_OWNER),  handler)
//   router.get('/admin',         requireAuth, requireMinRole(Roles.ADMINISTRATOR), handler)
const requireMinRole = (minRoleId) => (req, res, next) => {
    if (!req.session.userId) {
        req.session.flash = { type: 'warning', message: 'Please sign in to continue.' };
        return res.redirect('/login');
    }

    if (req.session.roleId < minRoleId) {
        return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', {
            title: 'Access Denied'
        });
    }

    next();
};

module.exports = { requireMinRole };
