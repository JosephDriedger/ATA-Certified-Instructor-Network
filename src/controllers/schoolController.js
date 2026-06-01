
const { validationResult } = require('express-validator');

const School            = require('../models/School');
const Event             = require('../models/Event');
const JudgeRequest      = require('../models/JudgeRequest');
const InstructorProfile = require('../models/InstructorProfile');
const StatusCodes       = require('../constants/statusCodes');
const { STATUS_BADGE }  = require('../constants/event');

const buildErrors = (result) => {
    const map = {};
    result.array().forEach(e => { if (!map[e.path]) map[e.path] = e.msg; });
    return map;
};

class SchoolController {

    // ── GET /schools ──────────────────────────────────────────────────────────
    static async index(req, res, next) {
        try {
            const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
            const search = (req.query.search || '').trim().slice(0, 100);

            const data = await School.findAll({ page, limit: 12, search });

            res.render('pages/school/index', {
                title: 'School Directory',
                ...data,
                search
            });
        } catch (err) { next(err); }
    }

    // ── GET /schools/:slug ────────────────────────────────────────────────────
    static async show(req, res, next) {
        try {
            const school = await School.findBySlug(req.params.slug);
            if (!school) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'School Not Found'
                });
            }

            const [roster, upcomingEvents] = await Promise.all([
                School.getRoster(school.id),
                Event.findUpcomingBySchool(school.id, 5)
            ]);

            const isOwner = req.session.userId === school.owner_id;

            res.render('pages/school/show', {
                title:  `${school.name} — School Profile`,
                school,
                roster,
                upcomingEvents,
                isOwner
            });
        } catch (err) { next(err); }
    }

    // ── GET /schools/mine ─────────────────────────────────────────────────────
    // Lists all schools owned by the current user.
    static async mine(req, res, next) {
        try {
            const schools = await School.findAllByOwner(req.session.userId);
            res.render('pages/school/mine', {
                title:   'My Schools',
                schools
            });
        } catch (err) { next(err); }
    }

    // ── GET /schools/mine/new ─────────────────────────────────────────────────
    static async newForm(req, res, next) {
        try {
            res.render('pages/school/edit', {
                title:    'Create School',
                errors:   {},
                school:   null,
                formData: {}
            });
        } catch (err) { next(err); }
    }

    // ── POST /schools/mine ────────────────────────────────────────────────────
    static async createSchool(req, res, next) {
        try {
            if (req.uploadError) {
                return res.render('pages/school/edit', {
                    title: 'Create School', errors: { logo: req.uploadError },
                    school: null, formData: req.body
                });
            }

            const result = validationResult(req);
            if (!result.isEmpty()) {
                return res.render('pages/school/edit', {
                    title: 'Create School', errors: buildErrors(result),
                    school: null, formData: req.body
                });
            }

            const logoUrl  = req.file ? `/uploads/logos/${req.file.filename}` : null;
            const schoolId = await School.create(req.session.userId, {
                ...SchoolController.#extractFields(req.body),
                logoUrl,
                isActive: req.body.isActive === 'on'
            });

            req.session.flash = { type: 'success', message: 'School created.' };
            res.redirect(`/schools/mine/${schoolId}/manage`);
        } catch (err) { next(err); }
    }

    // ── GET /schools/mine/:id/edit ────────────────────────────────────────────
    static async editForm(req, res, next) {
        try {
            const schoolId = parseInt(req.params.id, 10);
            const school   = await School.findById(schoolId);

            if (!school || school.owner_id !== req.session.userId) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'School Not Found'
                });
            }

            res.render('pages/school/edit', {
                title:    `Edit — ${school.name}`,
                errors:   {},
                school,
                formData: school ?? {}
            });
        } catch (err) { next(err); }
    }

    // ── POST /schools/mine/:id ────────────────────────────────────────────────
    static async update(req, res, next) {
        try {
            const schoolId = parseInt(req.params.id, 10);

            if (req.uploadError) {
                const school = await School.findById(schoolId);
                return res.render('pages/school/edit', {
                    title: `Edit — ${school?.name}`, errors: { logo: req.uploadError },
                    school, formData: req.body
                });
            }

            const result = validationResult(req);
            if (!result.isEmpty()) {
                const school = await School.findById(schoolId);
                return res.render('pages/school/edit', {
                    title: `Edit — ${school?.name}`, errors: buildErrors(result),
                    school, formData: req.body
                });
            }

            const logoUrl = req.file ? `/uploads/logos/${req.file.filename}` : null;
            await School.updateById(schoolId, req.session.userId, {
                ...SchoolController.#extractFields(req.body),
                logoUrl,
                isActive: req.body.isActive === 'on'
            });

            req.session.flash = { type: 'success', message: 'School profile saved.' };
            res.redirect(`/schools/mine/${schoolId}/manage`);
        } catch (err) { next(err); }
    }

    // ── GET /schools/mine/:id/manage ──────────────────────────────────────────
    static async manage(req, res, next) {
        try {
            const schoolId = req.params.id
                ? parseInt(req.params.id, 10)
                : null;

            // Resolve which school to show
            const school = schoolId
                ? await School.findById(schoolId)
                : await School.findByOwnerId(req.session.userId);

            // If accessing /schools/manage (no ID), redirect to first school
            if (!schoolId && school) {
                return res.redirect(`/schools/mine/${school.id}/manage`);
            }

            if (!school || school.owner_id !== req.session.userId) {
                req.session.flash = {
                    type:    'info',
                    message: 'Create your first school to access management features.'
                };
                return res.redirect('/schools/mine');
            }

            // Roster search — ?rosterSearch=name to find instructors to add
            const rosterSearch = (req.query.rosterSearch || '').trim().slice(0, 100);

            const [ownedSchools, roster, eventsData, requestsData] = await Promise.all([
                School.findAllByOwner(req.session.userId),
                School.getRoster(school.id),
                Event.findBySchool(school.id, { page: 1, limit: 5 }),
                JudgeRequest.findByRequester(req.session.userId, { page: 1, limit: 5 })
            ]);

            // Find instructors matching the search that are NOT already on the roster
            let rosterSearchResults = [];
            if (rosterSearch) {
                const rosterIds = new Set(roster.map(m => m.instructor_id));
                const found = await InstructorProfile.findAll({ search: rosterSearch, page: 1, limit: 10 });
                rosterSearchResults = found.instructors.filter(i => !rosterIds.has(i.id));
            }

            res.render('pages/school/manage', {
                title:               `Manage — ${school.name}`,
                school,
                ownedSchools,
                roster,
                rosterSearch,
                rosterSearchResults,
                recentEvents:        eventsData.events,
                totalEvents:         eventsData.total,
                recentRequests:      requestsData.requests,
                totalRequests:       requestsData.total,
                STATUS_BADGE
            });
        } catch (err) { next(err); }
    }

    // ── POST /schools/mine/:id/roster ─────────────────────────────────────────
    static async addInstructor(req, res, next) {
        try {
            const schoolId     = parseInt(req.params.id, 10);
            const instructorId = parseInt(req.body.instructorId, 10);
            const roleTitle    = (req.body.roleTitle || '').trim() || null;

            const school = await School.findById(schoolId);
            if (!school || school.owner_id !== req.session.userId) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Access Denied' });
            }
            if (!instructorId) {
                req.session.flash = { type: 'error', message: 'Invalid instructor.' };
                return res.redirect(`/schools/mine/${schoolId}/manage`);
            }

            await School.addToRoster(schoolId, instructorId, roleTitle, false);
            req.session.flash = { type: 'success', message: 'Instructor added to roster.' };
            res.redirect(`/schools/mine/${schoolId}/manage?tab=roster`);
        } catch (err) { next(err); }
    }

    // ── POST /schools/mine/:id/roster/:instructorId/remove ────────────────────
    static async removeInstructor(req, res, next) {
        try {
            const schoolId     = parseInt(req.params.id, 10);
            const instructorId = parseInt(req.params.instructorId, 10);

            const school = await School.findById(schoolId);
            if (!school || school.owner_id !== req.session.userId) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Access Denied' });
            }

            await School.removeFromRoster(schoolId, instructorId);
            req.session.flash = { type: 'success', message: 'Instructor removed from roster.' };
            res.redirect(`/schools/mine/${schoolId}/manage?tab=roster`);
        } catch (err) { next(err); }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    static #extractFields(body) {
        return {
            name:               body.name,
            headInstructorName: body.headInstructorName,
            description:        body.description,
            address:            body.address,
            city:               body.city,
            state:              body.state,
            country:            body.country,
            postalCode:         body.postalCode,
            phone:              body.phone,
            email:              body.email,
            websiteUrl:         body.websiteUrl
        };
    }
}

module.exports = SchoolController;
