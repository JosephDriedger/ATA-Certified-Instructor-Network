
const express            = require('express');
const { body }           = require('express-validator');

const AuthController     = require('../controllers/authController');
const { Roles, SELF_REGISTER_ROLES } = require('../constants/roles');
const { RANKS }          = require('../constants/instructor');
const ValidationMessages = require('../lang/en/validationMessages');

const router = express.Router();

// ── Validation chains ──────────────────────────────────────────────────────

const registerValidation = [
    // ── Identity ──────────────────────────────────────────────────────────────
    body('firstName')
        .trim().notEmpty().withMessage(ValidationMessages.firstNameRequired)
        .isLength({ max: 100 }).withMessage('First name must be 100 characters or less.'),

    body('lastName')
        .trim().notEmpty().withMessage(ValidationMessages.lastNameRequired)
        .isLength({ max: 100 }).withMessage('Last name must be 100 characters or less.'),

    body('email')
        .trim().notEmpty().withMessage(ValidationMessages.emailRequired)
        .isEmail().withMessage(ValidationMessages.emailInvalid)
        .normalizeEmail(),

    body('phone')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 30 }).withMessage('Phone number must be 30 characters or less.'),

    // ── Account type ──────────────────────────────────────────────────────────
    body('roleId')
        .notEmpty().withMessage(ValidationMessages.roleRequired)
        .isInt().toInt()
        .custom((value) => {
            if (!SELF_REGISTER_ROLES.includes(value)) throw new Error(ValidationMessages.roleInvalid);
            return true;
        }),

    // ── ATA credentials ───────────────────────────────────────────────────────
    body('ataMemberNumber')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 50 }).withMessage('ATA member number must be 50 characters or less.'),

    body('rank')
        .optional({ checkFalsy: true })
        .isIn(['', ...RANKS]).withMessage('Invalid rank selected.'),

    // ── Location ──────────────────────────────────────────────────────────────
    body('city')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 100 }).withMessage('City must be 100 characters or less.'),

    body('province')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 100 }).withMessage('Province / State must be 100 characters or less.'),

    body('country')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 100 }).withMessage('Country must be 100 characters or less.'),

    // ── School (School Owners only — optional, creates school on register) ────
    body('schoolName')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 255 }).withMessage('School name must be 255 characters or less.'),

    // ── Password ──────────────────────────────────────────────────────────────
    body('password')
        .notEmpty().withMessage(ValidationMessages.passwordRequired)
        .isLength({ min: 8 }).withMessage(ValidationMessages.passwordTooShort)
        .matches(/^(?=.*[A-Z])(?=.*\d)/).withMessage(ValidationMessages.passwordTooWeak),

    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) throw new Error(ValidationMessages.passwordMismatch);
            return true;
        })
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage(ValidationMessages.emailRequired),

    body('password')
        .notEmpty().withMessage(ValidationMessages.passwordRequired)
];

// ── Routes ─────────────────────────────────────────────────────────────────

router.get('/register', AuthController.showRegister);
router.post('/register', registerValidation, AuthController.register);

router.get('/login',  AuthController.showLogin);
router.post('/login', loginValidation, AuthController.login);

router.get('/logout', AuthController.logout);

module.exports = router;
