
const express                = require('express');
const { body }               = require('express-validator');

const InstructorController   = require('../controllers/instructorController');
const { handleProfileUpload } = require('../middleware/uploadMiddleware');
const { requireAuth }        = require('../middleware/authMiddleware');
const { requireMinRole }     = require('../middleware/roleMiddleware');
const { Roles }              = require('../constants/roles');
const { RANKS, CERTIFICATION_LEVELS, CERT_MIN_RANK, SPECIALTIES } = require('../constants/instructor');

const router = express.Router();

// ── Validation chain for profile save ─────────────────────────────────────

const profileValidation = [
    body('firstName')
        .trim().notEmpty().withMessage('First name is required.')
        .isLength({ max: 100 }).withMessage('First name must be 100 characters or less.'),

    body('lastName')
        .trim().notEmpty().withMessage('Last name is required.')
        .isLength({ max: 100 }).withMessage('Last name must be 100 characters or less.'),

    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 30 }).withMessage('Phone number must be 30 characters or less.'),

    body('ataMemberNumber')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 50 }).withMessage('ATA member number must be 50 characters or less.')
        .matches(/^[A-Za-z0-9\-]+$/).withMessage('ATA member number may only contain letters, numbers, and hyphens.'),

    body('rank')
        .optional({ checkFalsy: true })
        .isIn(['', ...RANKS]).withMessage('Invalid rank selected.'),

    body('certificationLevel')
        .optional({ checkFalsy: true })
        .isIn(['', ...CERTIFICATION_LEVELS]).withMessage('Invalid certification level selected.')
        .custom((certLevel, { req }) => {
            if (!certLevel) return true;
            const minRankIdx = CERT_MIN_RANK[certLevel];
            if (minRankIdx === undefined) return true;
            const rankIdx = RANKS.indexOf(req.body.rank || '');
            if (rankIdx === -1) return true; // rank not set — allow, admin verifies
            if (rankIdx < minRankIdx) {
                throw new Error(
                    `${certLevel} requires at least ${RANKS[minRankIdx]}. ` +
                    `Your selected rank is ${req.body.rank}.`
                );
            }
            return true;
        }),

    body('yearsExperience')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 70 }).withMessage('Years teaching must be a number between 0 and 70.')
        .toInt(),

    body('bio')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 2000 }).withMessage('Biography must be 2,000 characters or less.'),

    body('city')
        .optional({ checkFalsy: true })
        .trim().isLength({ max: 100 }).withMessage('City must be 100 characters or less.'),

    body('state')
        .optional({ checkFalsy: true })
        .trim().isLength({ max: 100 }).withMessage('State must be 100 characters or less.'),

    body('country')
        .optional({ checkFalsy: true })
        .trim().isLength({ max: 100 }).withMessage('Country must be 100 characters or less.'),

    body('travelRadiusMiles')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 5000 }).withMessage('Travel radius must be between 0 and 5,000 miles.')
        .toInt(),

    body('specialties').optional(),
    body('specialties[]').optional()
];

// ── Public routes ──────────────────────────────────────────────────────────
router.get('/instructors',    InstructorController.index);
router.get('/instructors/:id', InstructorController.show);

// ── Protected: any authenticated user can have an instructor profile ──────
// School owners are also instructors — requireMinRole(1) passes for everyone.
router.get(
    '/profile/instructor',
    requireAuth,
    requireMinRole(Roles.INSTRUCTOR),
    InstructorController.editForm
);

router.post(
    '/profile/instructor',
    requireAuth,
    requireMinRole(Roles.INSTRUCTOR),
    handleProfileUpload,
    profileValidation,
    InstructorController.update
);

module.exports = router;
