
const { validationResult } = require('express-validator');

const School            = require('../models/School');
const Event             = require('../models/Event');
const InstructorProfile = require('../models/InstructorProfile');
const JudgeRequest      = require('../models/JudgeRequest');
const StatusCodes       = require('../constants/statusCodes');
const notifier          = require('../modules/notifier');
const { RANKS }         = require('../constants/instructor');

const buildErrors = (result) => {
    const map = {};
    result.array().forEach(e => { if (!map[e.path]) map[e.path] = e.msg; });
    return map;
};

class JudgeRequestController {

    // ── GET /judge-requests/create?instructorId=X ─────────────────────────────
    static async createForm(req, res, next) {
        try {
            const ownedSchools = await School.findAllByOwner(req.session.userId);
            if (!ownedSchools.length) {
                req.session.flash = { type: 'warning', message: 'Create a school profile before sending judge requests.' };
                return res.redirect('/schools/mine');
            }
            const schoolId = parseInt(req.query.school || '0', 10);
            const school   = schoolId
                ? ownedSchools.find(s => s.id === schoolId) ?? ownedSchools[0]
                : ownedSchools[0];

            const instructorId = parseInt(req.query.instructorId || '0', 10);
            if (!instructorId) {
                req.session.flash = { type: 'info', message: 'Select an instructor from the directory to send a request.' };
                return res.redirect('/instructors');
            }

            const [instructor, schoolEvents] = await Promise.all([
                InstructorProfile.findById(instructorId),
                Event.findBySchool(school.id, { page: 1, limit: 50 })
            ]);

            if (!instructor) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', { title: 'Instructor Not Found' });
            }

            // Pre-fill from event if coming via ?eventId=X (recommendations page)
            const prefilledEventId = parseInt(req.query.eventId || '0', 10) || null;
            let formData = { eventId: prefilledEventId };

            if (prefilledEventId) {
                const linkedEvent = await Event.findById(prefilledEventId);
                if (linkedEvent && linkedEvent.school_id === school.id) {
                    formData = {
                        eventId:       prefilledEventId,
                        requiredRank:  linkedEvent.required_judge_rank || '',
                        judgesNeeded:  linkedEvent.judges_needed || 1,
                        requestedDate: linkedEvent.start_datetime
                            ? new Date(linkedEvent.start_datetime).toISOString().split('T')[0]
                            : ''
                    };
                }
            }

            res.render('pages/judge-request/create', {
                title:        'Send Judge Request',
                errors:       {},
                formData,
                school,
                ownedSchools,
                instructor,
                schoolEvents: schoolEvents.events,
                RANKS
            });
        } catch (err) { next(err); }
    }

    // ── POST /judge-requests ──────────────────────────────────────────────────
    static async create(req, res, next) {
        try {
            const ownedSchools = await School.findAllByOwner(req.session.userId);
            const schoolIdPost = parseInt(req.body.schoolId || '0', 10);
            const school       = schoolIdPost
                ? ownedSchools.find(s => s.id === schoolIdPost) ?? ownedSchools[0]
                : ownedSchools[0];
            if (!school) return res.redirect('/schools/mine');

            const result       = validationResult(req);
            const instructorId = parseInt(req.body.instructorId || '0', 10);

            const rerender = async (errors) => {
                const [instructor, schoolEvents] = await Promise.all([
                    InstructorProfile.findById(instructorId),
                    Event.findBySchool(school.id, { page: 1, limit: 50 })
                ]);
                return res.render('pages/judge-request/create', {
                    title:        'Send Judge Request',
                    errors,
                    formData:     req.body,
                    school,
                    ownedSchools,
                    instructor,
                    schoolEvents: schoolEvents.events,
                    RANKS
                });
            };

            if (!result.isEmpty()) return rerender(buildErrors(result));

            const alreadyPending = await JudgeRequest.pendingExists(
                req.session.userId, instructorId, req.body.requestedDate
            );
            if (alreadyPending) {
                return rerender({ requestedDate: 'A pending request already exists for this instructor on that date.' });
            }

            const requestId = await JudgeRequest.create({
                requesterId:   req.session.userId,
                instructorId,
                eventId:       req.body.eventId       ? parseInt(req.body.eventId, 10) : null,
                requestedDate: req.body.requestedDate,
                requestedTime: req.body.requestedTime || null,
                locationName:  req.body.locationName  || null,
                requiredRank:  req.body.requiredRank  || null,
                judgesNeeded:  req.body.judgesNeeded  ? parseInt(req.body.judgesNeeded, 10) : 1,
                message:       req.body.message       || null
            });

            // Notify the instructor
            const instructor = await InstructorProfile.findById(instructorId);
            if (instructor) {
                await notifier.judgeRequestReceived(instructor.user_id, requestId, school.name);
            }

            req.session.flash = { type: 'success', message: 'Judge request sent. The instructor has been notified.' };
            res.redirect(`/schools/mine/${school.id}/manage`);
        } catch (err) { next(err); }
    }
}

module.exports = JudgeRequestController;
