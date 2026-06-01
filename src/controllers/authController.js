
const bcrypt              = require('bcryptjs');
const { validationResult } = require('express-validator');

const User               = require('../models/User');
const InstructorProfile  = require('../models/InstructorProfile');
const School             = require('../models/School');
const { Roles }          = require('../constants/roles');
const { RANKS }          = require('../constants/instructor');
const ValidationMessages = require('../lang/en/validationMessages');

const BCRYPT_ROUNDS = 12;

// Converts express-validator's error array into a { field: message } map
// so EJS templates can look up errors by field name.
const buildErrorMap = (result) => {
    const map = {};
    result.array().forEach((e) => {
        if (!map[e.path]) map[e.path] = e.msg;
    });
    return map;
};

class AuthController {

    // ── GET /register ─────────────────────────────────────────────────────────
    static showRegister(req, res) {
        if (req.session.userId) return res.redirect('/dashboard');
        res.render('pages/auth/register', {
            title:    'Create Account',
            errors:   {},
            formData: {},
            RANKS
        });
    }

    // ── POST /register ────────────────────────────────────────────────────────
    static async register(req, res, next) {
        try {
            const result = validationResult(req);

            const formData = {
                firstName:      req.body.firstName,
                lastName:       req.body.lastName,
                email:          req.body.email,
                phone:          req.body.phone,
                roleId:         req.body.roleId,
                ataMemberNumber: req.body.ataMemberNumber,
                rank:           req.body.rank,
                city:           req.body.city,
                province:       req.body.province,
                country:        req.body.country,
                schoolName:     req.body.schoolName
            };

            if (!result.isEmpty()) {
                return res.render('pages/auth/register', {
                    title:    'Create Account',
                    errors:   buildErrorMap(result),
                    formData,
                    RANKS
                });
            }

            const {
                firstName, lastName, email, password, roleId,
                phone, ataMemberNumber, rank, city, province, country, schoolName
            } = req.body;

            if (await User.emailExists(email)) {
                return res.render('pages/auth/register', {
                    title:    'Create Account',
                    errors:   { email: ValidationMessages.emailTaken },
                    formData,
                    RANKS
                });
            }

            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            const parsedRoleId = parseInt(roleId, 10);

            const newId = await User.create({
                roleId:       parsedRoleId,
                email,
                passwordHash,
                firstName,
                lastName,
                phone: phone || null
            });

            // Auto-create instructor profile for all non-admin users.
            // School owners are active instructors by default (public = true).
            // Pure instructors start private until they complete their profile.
            if (parsedRoleId < Roles.ADMINISTRATOR) {
                const isSchoolOwner = parsedRoleId >= Roles.SCHOOL_OWNER;
                await InstructorProfile.upsert(newId, {
                    ataMemberNumber:        ataMemberNumber  || null,
                    rank:                   RANKS.includes(rank) ? rank : null,
                    isPublic:               isSchoolOwner,   // school owners public by default
                    isAvailableForEvents:   true,
                    isAvailableForTesting:  false,
                    isAvailableForSeminars: false,
                    city:    city     || null,
                    state:   province || null,
                    country: country  || 'CA'
                }, []);
            }

            // Auto-create school profile for school owners who provided a school name.
            if (parsedRoleId === Roles.SCHOOL_OWNER && schoolName && schoolName.trim()) {
                await School.create(newId, {
                    name:    schoolName.trim(),
                    city:    city     || null,
                    state:   province || null,
                    country: country  || 'CA',
                    isActive: true
                });
            }

            const user = await User.findById(newId);

            // Regenerate the session to prevent session-fixation attacks.
            req.session.regenerate((err) => {
                if (err) return next(err);
                AuthController.#writeSession(req, user);
                req.session.flash = {
                    type:    'success',
                    message: `Welcome, ${user.first_name}! Your account has been created.`
                };
                res.redirect('/dashboard');
            });

        } catch (err) {
            next(err);
        }
    }

    // ── GET /login ────────────────────────────────────────────────────────────
    static showLogin(req, res) {
        if (req.session.userId) return res.redirect('/dashboard');
        res.render('pages/auth/login', {
            title:    'Sign In',
            errors:   {},
            formData: {}
        });
    }

    // ── POST /login ───────────────────────────────────────────────────────────
    static async login(req, res, next) {
        try {
            const result = validationResult(req);

            if (!result.isEmpty()) {
                return res.render('pages/auth/login', {
                    title:    'Sign In',
                    errors:   buildErrorMap(result),
                    formData: { email: req.body.email }
                });
            }

            const { email, password } = req.body;
            const user = await User.findByEmail(email);

            // Intentionally identical error for bad email or bad password
            // to prevent user-enumeration attacks.
            const credentialsInvalid =
                !user || !(await bcrypt.compare(password, user.password_hash));

            if (credentialsInvalid) {
                return res.render('pages/auth/login', {
                    title:    'Sign In',
                    errors:   { general: ValidationMessages.invalidCredentials },
                    formData: { email }
                });
            }

            if (!user.is_active) {
                return res.render('pages/auth/login', {
                    title:    'Sign In',
                    errors:   { general: ValidationMessages.accountInactive },
                    formData: { email }
                });
            }

            await User.updateLastLogin(user.id);

            // Regenerate session to prevent session-fixation attacks.
            req.session.regenerate((err) => {
                if (err) return next(err);
                AuthController.#writeSession(req, user);
                req.session.flash = {
                    type:    'success',
                    message: `Welcome back, ${user.first_name}!`
                };
                const returnTo = req.session.returnTo || '/dashboard';
                delete req.session.returnTo;
                res.redirect(returnTo);
            });

        } catch (err) {
            next(err);
        }
    }

    // ── GET /logout ───────────────────────────────────────────────────────────
    static logout(req, res, next) {
        req.session.destroy((err) => {
            if (err) return next(err);
            res.clearCookie('acin.sid');
            res.redirect('/login');
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    // Writes user identity into the session after login or register.
    static #writeSession(req, user) {
        req.session.userId      = user.id;
        req.session.roleId      = user.role_id;
        req.session.roleName    = user.role_name;
        req.session.roleLabel   = user.role_label;
        req.session.displayName = `${user.first_name} ${user.last_name}`;
    }
}

module.exports = AuthController;
