
const { validationResult } = require('express-validator');

const School      = require('../models/School');
const Event       = require('../models/Event');
const StatusCodes = require('../constants/statusCodes');
const { EVENT_TYPES, EVENT_STATUSES } = require('../constants/event');
const { RANKS }                        = require('../constants/instructor');

const buildErrors = (result) => {
    const map = {};
    result.array().forEach(e => { if (!map[e.path]) map[e.path] = e.msg; });
    return map;
};

const FORM_CONSTANTS = { EVENT_TYPES, EVENT_STATUSES, RANKS };

class EventController {

    // ── GET /events ───────────────────────────────────────────────────────────
    static async index(req, res, next) {
        try {
            const page      = Math.max(1, parseInt(req.query.page      || '1', 10));
            const eventType = (req.query.type || '').trim();

            const data = await Event.findPublished({ page, limit: 12, eventType });

            res.render('pages/event/index', {
                title:             'Events',
                ...data,
                selectedType:      eventType,
                EVENT_TYPES
            });
        } catch (err) { next(err); }
    }

    // ── GET /events/:id ───────────────────────────────────────────────────────
    static async show(req, res, next) {
        try {
            const event = await Event.findById(parseInt(req.params.id, 10));

            if (!event || (event.status !== 'published' && !event.is_public)) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'Event Not Found'
                });
            }

            const isOwner = req.session.userId && event.school_id
                ? (await School.findAllByOwner(req.session.userId)).some(s => s.id === event.school_id)
                : false;

            res.render('pages/event/show', {
                title:   event.title,
                event,
                isOwner
            });
        } catch (err) { next(err); }
    }

    // ── GET /events/create ────────────────────────────────────────────────────
    static async createForm(req, res, next) {
        try {
            const ownedSchools = await School.findAllByOwner(req.session.userId);
            if (!ownedSchools.length) {
                req.session.flash = { type: 'warning', message: 'Create a school profile before posting events.' };
                return res.redirect('/schools/mine');
            }

            // Use ?school=ID to pre-select, otherwise default to first
            const schoolId = parseInt(req.query.school || '0', 10);
            const school   = schoolId
                ? ownedSchools.find(s => s.id === schoolId) ?? ownedSchools[0]
                : ownedSchools[0];

            res.render('pages/event/create', {
                title:    'Create Event',
                errors:   {},
                formData: {},
                school,
                ownedSchools,
                ...FORM_CONSTANTS
            });
        } catch (err) { next(err); }
    }

    // ── POST /events ──────────────────────────────────────────────────────────
    static async create(req, res, next) {
        try {
            const ownedSchools = await School.findAllByOwner(req.session.userId);
            const schoolId     = parseInt(req.body.schoolId || '0', 10);
            const school       = schoolId
                ? ownedSchools.find(s => s.id === schoolId) ?? ownedSchools[0]
                : ownedSchools[0];
            if (!school) return res.redirect('/schools/mine');

            const result = validationResult(req);
            if (!result.isEmpty()) {
                return res.render('pages/event/create', {
                    title:    'Create Event',
                    errors:   buildErrors(result),
                    formData: req.body,
                    school,
                    ownedSchools,
                    ...FORM_CONSTANTS
                });
            }

            const eventId = await Event.create(school.id, req.session.userId, {
                title:               req.body.title,
                description:         req.body.description,
                eventType:           req.body.eventType,
                locationName:        req.body.locationName,
                address:             req.body.address,
                city:                req.body.city,
                state:               req.body.state,
                country:             req.body.country,
                postalCode:          req.body.postalCode,
                startDatetime:       req.body.startDatetime,
                endDatetime:         req.body.endDatetime,
                maxParticipants:     req.body.maxParticipants || null,
                judgesNeeded:        req.body.judgesNeeded    ? parseInt(req.body.judgesNeeded, 10) : null,
                requiredJudgeRank:   req.body.requiredJudgeRank || null,
                registrationDeadline: req.body.registrationDeadline || null,
                isPublic:            req.body.isPublic === 'on',
                status:              req.body.status || 'draft'
            });

            // For event types that typically need judges, go straight to recommendations.
            const judgeableTypes = new Set(['belt_testing', 'tournament', 'seminar']);
            const isJudgeable    = judgeableTypes.has(req.body.eventType);

            req.session.flash = {
                type:    'success',
                message: isJudgeable
                    ? 'Event created. Here are your recommended judges.'
                    : 'Event created successfully.'
            };

            res.redirect(isJudgeable
                ? `/events/${eventId}/recommendations`
                : `/schools/mine/${school.id}/manage`
            );
        } catch (err) { next(err); }
    }
}

module.exports = EventController;
