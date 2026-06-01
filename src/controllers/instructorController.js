
const { validationResult } = require('express-validator');

const InstructorProfile  = require('../models/InstructorProfile');
const Availability       = require('../models/Availability');
const School             = require('../models/School');
const pool               = require('../modules/pool');
const { RANKS, CERTIFICATION_LEVELS, CERT_MIN_RANK, CERT_MIN_AGE, SPECIALTIES } = require('../constants/instructor');
const { Roles }          = require('../constants/roles');
const StatusCodes        = require('../constants/statusCodes');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const FORM_CONSTANTS = { RANKS, CERTIFICATION_LEVELS, CERT_MIN_RANK, SPECIALTIES };

// Build a { field: firstMessage } map from express-validator's result.
const buildErrors = (result) => {
    const map = {};
    result.array().forEach(e => { if (!map[e.path]) map[e.path] = e.msg; });
    return map;
};

class InstructorController {

    // ── GET /instructors ──────────────────────────────────────────────────────
    // When ?date=YYYY-MM-DD is present, delegates to the availability-aware
    // search so only instructors available on that date are returned.
    static async index(req, res, next) {
        try {
            const page      = Math.max(1, parseInt(req.query.page      || '1',  10));
            const search    = (req.query.search    || '').trim().slice(0, 100);
            const specialty = (req.query.specialty || '').trim();
            const date      = (req.query.date      || '').trim();
            const state     = (req.query.state     || '').trim();

            const isDateSearch = date && DATE_RE.test(date);

            let data;
            if (isDateSearch) {
                data = await Availability.searchOnDate({ date, state, specialty, page, limit: 12 });
            } else {
                data = await InstructorProfile.findAll({ page, limit: 12, search, specialty });
            }

            res.render('pages/instructor/index', {
                title:             isDateSearch
                    ? `Instructors Available — ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}`
                    : 'Instructor Directory',
                ...data,
                search,
                selectedSpecialty: specialty,
                selectedDate:      date,
                selectedState:     state,
                isDateSearch,
                SPECIALTIES
            });
        } catch (err) {
            next(err);
        }
    }

    // ── GET /instructors/:id ──────────────────────────────────────────────────
    static async show(req, res, next) {
        try {
            const instructor = await InstructorProfile.findById(parseInt(req.params.id, 10));

            if (!instructor) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'Instructor Not Found'
                });
            }

            // Non-public profiles visible only to the owner and admins
            const isOwner = req.session.userId === instructor.user_id;
            const isAdmin = req.session.roleId  === Roles.ADMINISTRATOR;

            if (!instructor.is_public && !isOwner && !isAdmin) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'Instructor Not Found'
                });
            }

            // Fetch the most recent verified certification to show the
            // Certified Instructor Number to signed-in users.
            let certifiedInstructorNumber = null;
            if (req.session.userId) {
                const [[cert]] = await pool.query(
                    `SELECT certification_number
                     FROM certifications
                     WHERE instructor_id = ?
                       AND is_verified   = 1
                       AND deleted_at    IS NULL
                     ORDER BY issued_date DESC
                     LIMIT 1`,
                    [instructor.id]
                );
                certifiedInstructorNumber = cert?.certification_number ?? null;
            }

            // For school owners: load their schools and check roster status
            let ownedSchools = [];
            let rosterSchoolIds = new Set(); // school IDs where this instructor is already on roster
            if (req.session.userId && req.session.roleId >= Roles.SCHOOL_OWNER) {
                ownedSchools = await School.findAllByOwner(req.session.userId);
                await Promise.all(ownedSchools.map(async s => {
                    const roster = await School.getRoster(s.id);
                    if (roster.some(m => m.instructor_id === instructor.id)) {
                        rosterSchoolIds.add(s.id);
                    }
                }));
            }

            res.render('pages/instructor/show', {
                title:    `${instructor.first_name} ${instructor.last_name} — Instructor Profile`,
                instructor,
                isOwner,
                certifiedInstructorNumber,
                ownedSchools,
                rosterSchoolIds: [...rosterSchoolIds],
                canRequest: req.session.userId && req.session.roleId >= Roles.SCHOOL_OWNER
            });
        } catch (err) {
            next(err);
        }
    }

    // ── GET /profile/instructor ───────────────────────────────────────────────
    static async editForm(req, res, next) {
        try {
            const profile = await InstructorProfile.findByUserId(req.session.userId);

            res.render('pages/instructor/edit', {
                title:    'Edit Instructor Profile',
                errors:   {},
                profile,                  // null on first visit
                formData: profile ?? {},
                ...FORM_CONSTANTS
            });
        } catch (err) {
            next(err);
        }
    }

    // ── POST /profile/instructor ──────────────────────────────────────────────
    static async update(req, res, next) {
        try {
            // Surface multer upload errors as a form error
            if (req.uploadError) {
                const profile = await InstructorProfile.findByUserId(req.session.userId);
                return res.render('pages/instructor/edit', {
                    title:    'Edit Instructor Profile',
                    errors:   { profilePhoto: req.uploadError },
                    profile,
                    formData: req.body,
                    ...FORM_CONSTANTS
                });
            }

            const result = validationResult(req);
            if (!result.isEmpty()) {
                const profile = await InstructorProfile.findByUserId(req.session.userId);
                return res.render('pages/instructor/edit', {
                    title:    'Edit Instructor Profile',
                    errors:   buildErrors(result),
                    profile,
                    formData: req.body,
                    ...FORM_CONSTANTS
                });
            }

            const {
                firstName, lastName, phone,
                ataMemberNumber, rank, certificationLevel,
                yearsExperience, bio, city, state, country,
                travelRadiusMiles
            } = req.body;

            // Checkboxes: absent from req.body when unchecked
            const isPublic               = req.body.isPublic               === 'on';
            const isAvailableForEvents   = req.body.isAvailableForEvents   === 'on';
            const isAvailableForTesting  = req.body.isAvailableForTesting  === 'on';
            const isAvailableForSeminars = req.body.isAvailableForSeminars === 'on';

            // specialties[] comes as array or single string; normalise and whitelist
            const rawSpecialties = [].concat(req.body['specialties[]'] || req.body.specialties || []);
            const specialties    = rawSpecialties.filter(s => SPECIALTIES.includes(s));

            // Profile photo: use new upload path, or keep existing
            const photoUrl = req.file ? `/uploads/profiles/${req.file.filename}` : null;

            await InstructorProfile.updateUserInfo(req.session.userId, {
                firstName,
                lastName,
                phone,
                profilePhotoUrl: photoUrl
            });

            await InstructorProfile.upsert(
                req.session.userId,
                {
                    ataMemberNumber, rank, certificationLevel,
                    yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null,
                    bio, city, state, country,
                    isPublic, isAvailableForEvents, isAvailableForTesting, isAvailableForSeminars,
                    travelRadiusMiles: travelRadiusMiles ? parseInt(travelRadiusMiles, 10) : null
                },
                specialties
            );

            // Sync displayName in session if name changed
            req.session.displayName = `${firstName} ${lastName}`;

            req.session.flash = { type: 'success', message: 'Your instructor profile has been saved.' };
            res.redirect('/profile/instructor');

        } catch (err) {
            next(err);
        }
    }
}

module.exports = InstructorController;
