
const Event                  = require('../models/Event');
const School                 = require('../models/School');
const JudgeRequest           = require('../models/JudgeRequest');
const RecommendationService  = require('../services/RecommendationService');
const StatusCodes             = require('../constants/statusCodes');
const { Roles }               = require('../constants/roles');
const pool                    = require('../modules/pool');

class RecommendationController {

    // ── GET /events/:id/recommendations ──────────────────────────────────────
    static async index(req, res, next) {
        try {
            const eventId = parseInt(req.params.id, 10);
            const limit   = Math.min(parseInt(req.query.limit || '20', 10), 50);

            const event = await Event.findById(eventId);
            if (!event) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'Event Not Found'
                });
            }

            const ownedSchools = await School.findAllByOwner(req.session.userId);
            const school = ownedSchools.find(s => s.id === event.school_id);
            if (!school) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', {
                    title: 'Access Denied'
                });
            }

            // Load recommendations + roster in parallel
            const [result, rawRoster] = await Promise.all([
                RecommendationService.recommend(eventId, { limit }),
                School.getRoster(school.id)
            ]);

            const eventDate = event.start_datetime
                ? new Date(event.start_datetime).toISOString().split('T')[0]
                : null;

            // For each rostered instructor, check if a pending request already exists
            // for this event date, and if they're double-booked.
            const rosterWithStatus = await Promise.all(
                rawRoster.map(async member => {
                    const [alreadySent, alreadyBooked] = await Promise.all([
                        JudgeRequest.pendingExists(req.session.userId, member.instructor_id, eventDate || '9999-12-31'),
                        eventDate ? JudgeRequest.acceptedOnDate(member.instructor_id, eventDate) : Promise.resolve(false)
                    ]);
                    return { ...member, alreadySent, alreadyBooked };
                })
            );

            res.render('pages/recommendations/index', {
                title: `Judge Recommendations — ${event.title}`,
                ...result,
                roster:    rosterWithStatus,
                eventDate
            });
        } catch (err) { next(err); }
    }
}

module.exports = RecommendationController;
