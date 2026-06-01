
const express = require('express');
const { body } = require('express-validator');

const SchoolController       = require('../controllers/schoolController');
const EventController        = require('../controllers/eventController');
const JudgeRequestController = require('../controllers/judgeRequestController');
const { handleLogoUpload }   = require('../middleware/uploadMiddleware');
const { requireAuth }        = require('../middleware/authMiddleware');
const { requireMinRole }     = require('../middleware/roleMiddleware');
const { Roles }              = require('../constants/roles');
const { EVENT_TYPES }        = require('../constants/event');

const router     = express.Router();
const ownerGuard = [requireAuth, requireMinRole(Roles.SCHOOL_OWNER)];

// ── School profile validation ──────────────────────────────────────────────

const schoolValidation = [
    body('name')
        .trim().notEmpty().withMessage('School name is required.')
        .isLength({ max: 255 }).withMessage('School name must be 255 characters or less.'),

    body('headInstructorName')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 200 }).withMessage('Instructor name must be 200 characters or less.'),

    body('description')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 2000 }).withMessage('Description must be 2,000 characters or less.'),

    body('address')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 255 }).withMessage('Address must be 255 characters or less.'),

    body('city')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 100 }).withMessage('City must be 100 characters or less.'),

    body('state')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 100 }).withMessage('State must be 100 characters or less.'),

    body('country')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 100 }).withMessage('Country must be 100 characters or less.'),

    body('postalCode')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 20 }).withMessage('Postal code must be 20 characters or less.'),

    body('phone')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 30 }).withMessage('Phone must be 30 characters or less.'),

    body('email')
        .optional({ checkFalsy: true }).trim()
        .isEmail().withMessage('Please enter a valid email address.')
        .normalizeEmail(),

    body('websiteUrl')
        .optional({ checkFalsy: true }).trim()
        .isURL({ require_protocol: true }).withMessage('Please enter a valid URL including https://')
        .isLength({ max: 500 }).withMessage('Website URL must be 500 characters or less.')
];

// ── Event validation ───────────────────────────────────────────────────────

const eventValidation = [
    body('title')
        .trim().notEmpty().withMessage('Event title is required.')
        .isLength({ max: 255 }).withMessage('Title must be 255 characters or less.'),

    body('eventType')
        .notEmpty().withMessage('Event type is required.')
        .isIn(EVENT_TYPES.map(t => t.value)).withMessage('Invalid event type.'),

    body('description')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 2000 }).withMessage('Description must be 2,000 characters or less.'),

    body('startDatetime')
        .notEmpty().withMessage('Start date and time is required.')
        .isISO8601().withMessage('Invalid start date format.'),

    body('endDatetime')
        .notEmpty().withMessage('End date and time is required.')
        .isISO8601().withMessage('Invalid end date format.')
        .custom((val, { req }) => {
            if (new Date(val) <= new Date(req.body.startDatetime)) {
                throw new Error('End date must be after the start date.');
            }
            return true;
        }),

    body('maxParticipants')
        .optional({ checkFalsy: true })
        .isInt({ min: 1, max: 9999 }).withMessage('Max participants must be between 1 and 9,999.')
        .toInt(),

    body('registrationDeadline')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Invalid registration deadline format.'),

    body(['locationName', 'address', 'city', 'state', 'country', 'postalCode'])
        .optional({ checkFalsy: true }).trim(),

    body('status')
        .optional({ checkFalsy: true })
        .isIn(['draft', 'published']).withMessage('Status must be draft or published.')
];

// ── Judge request validation ───────────────────────────────────────────────

const judgeRequestValidation = [
    body('instructorId')
        .notEmpty().withMessage('Instructor is required.')
        .isInt({ min: 1 }).withMessage('Invalid instructor.')
        .toInt(),

    body('requestedDate')
        .notEmpty().withMessage('Requested date is required.')
        .isISO8601().withMessage('Invalid date format.')
        .custom((val) => {
            if (new Date(val) < new Date().setHours(0, 0, 0, 0)) {
                throw new Error('Requested date cannot be in the past.');
            }
            return true;
        }),

    body('eventId')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Invalid event selected.')
        .toInt(),

    body('message')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 1000 }).withMessage('Message must be 1,000 characters or less.')
];

// ── Public routes ─────────────────────────────────────────────────────────
router.get('/schools', SchoolController.index);

// ── Owner school management — /schools/mine/* ──────────────────────────────
// ORDERING: exact paths (mine, mine/new) must come before /:slug
router.get('/schools/mine',          ...ownerGuard, SchoolController.mine);
router.get('/schools/mine/new',      ...ownerGuard, SchoolController.newForm);
router.post('/schools/mine',         ...ownerGuard, handleLogoUpload, schoolValidation, SchoolController.createSchool);
router.get('/schools/mine/:id/edit', ...ownerGuard, SchoolController.editForm);
router.post('/schools/mine/:id',     ...ownerGuard, handleLogoUpload, schoolValidation, SchoolController.update);
router.get('/schools/mine/:id/manage',                     ...ownerGuard, SchoolController.manage);
router.post('/schools/mine/:id/roster',                    ...ownerGuard, SchoolController.addInstructor);
router.post('/schools/mine/:id/roster/:instructorId/remove', ...ownerGuard, SchoolController.removeInstructor);

// ── Backward-compat redirects ─────────────────────────────────────────────
// These keep existing links in views/emails working.
router.get('/profile/school',  ...ownerGuard, (req, res) => res.redirect('/schools/mine'));
router.get('/schools/manage',  ...ownerGuard, SchoolController.manage);   // resolves to first school

// ── Public school profile page ─────────────────────────────────────────────
router.get('/schools/:slug', SchoolController.show);

// ── Events ────────────────────────────────────────────────────────────────
// ORDERING MATTERS: exact paths must come before param paths.
//   /events          → public listing
//   /events/create   → owner form  (must be before /:id or 'create' is treated as an id)
//   /events/:id      → public detail
router.get('/events',        EventController.index);
router.get('/events/create', ...ownerGuard, EventController.createForm);
router.post('/events',       ...ownerGuard, eventValidation, EventController.create);
router.get('/events/:id',    EventController.show);

// ── Judge requests (owner) ────────────────────────────────────────────────
router.get('/judge-requests/create', ...ownerGuard, JudgeRequestController.createForm);
router.post('/judge-requests',       ...ownerGuard, judgeRequestValidation, JudgeRequestController.create);

module.exports = router;
