
const express          = require('express');
const { body }         = require('express-validator');

const BookingController  = require('../controllers/bookingController');
const { requireAuth }    = require('../middleware/authMiddleware');
const { requireMinRole } = require('../middleware/roleMiddleware');
const { Roles }          = require('../constants/roles');

const router    = express.Router();
const authGuard = [requireAuth];

const declineValidation = [
    body('responseMessage')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 1000 }).withMessage('Response must be 1,000 characters or less.')
];

// ── List & detail — any authenticated user ────────────────────────────────
router.get('/bookings',     ...authGuard, BookingController.index);
router.get('/bookings/:id', ...authGuard, BookingController.show);

// ── Instructor actions — any user with an instructor profile (level 1+)
// The controller itself verifies the caller owns the instructor profile.
router.post('/bookings/:id/accept',  ...authGuard, requireMinRole(Roles.INSTRUCTOR), BookingController.accept);
router.post('/bookings/:id/decline', ...authGuard, requireMinRole(Roles.INSTRUCTOR), declineValidation, BookingController.decline);

// ── School owner / admin actions ──────────────────────────────────────────
router.post('/bookings/:id/cancel',   ...authGuard, requireMinRole(Roles.SCHOOL_OWNER), BookingController.cancel);
router.post('/bookings/:id/complete', ...authGuard, requireMinRole(Roles.SCHOOL_OWNER), BookingController.complete);

module.exports = router;
