
const { validationResult } = require('express-validator');

const JudgeRequest      = require('../models/JudgeRequest');
const InstructorProfile = require('../models/InstructorProfile');
const StatusCodes       = require('../constants/statusCodes');
const { Roles }         = require('../constants/roles');
const notifier          = require('../modules/notifier');
const pool              = require('../modules/pool');

const buildErrors = (result) => {
    const map = {};
    result.array().forEach(e => { if (!map[e.path]) map[e.path] = e.msg; });
    return map;
};

// Status → Bootstrap badge class mapping (shared by index and show views)
const STATUS_BADGE = {
    pending:   'bg-warning text-dark',
    accepted:  'bg-success',
    declined:  'bg-danger',
    cancelled: 'bg-secondary',
    completed: 'bg-primary'
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Verify the current user is a party to the request (requester OR instructor owner).
// Role-agnostic: a school owner with an instructor profile is a valid party.
async function isParty(req, request) {
    if (!request) return false;
    if (req.session.userId === request.requester_id) return true;
    if (req.session.roleId >= Roles.ADMINISTRATOR) return true;

    // Check if the user owns the instructor profile referenced in this request
    const profile = await InstructorProfile.findByUserId(req.session.userId);
    return !!(profile && profile.id === request.instructor_id);
}

class BookingController {

    // ── GET /bookings ─────────────────────────────────────────────────────────
    // Routing logic:
    //   ?view=received  → show judge requests received (instructor side)
    //   ?view=sent      → show judge requests sent (school owner side)
    //   default         → school owners default to "sent"; instructors to "received"
    //
    // School owners with an instructor profile can toggle between both views.
    static async index(req, res, next) {
        try {
            const page   = Math.max(1, parseInt(req.query.page   || '1', 10));
            const status = req.query.status || '';

            const instructorProfile  = await InstructorProfile.findByUserId(req.session.userId);
            const hasInstructorProfile = !!instructorProfile;
            const isSchoolOwner      = req.session.roleId >= Roles.SCHOOL_OWNER;

            // Determine which view to show
            // School owners default to "sent"; pure instructors default to "received"
            const defaultView = isSchoolOwner ? 'sent' : 'received';
            const view        = ['sent', 'received'].includes(req.query.view)
                ? req.query.view
                : defaultView;

            const isInstructorView = view === 'received';

            let data;
            if (isInstructorView && hasInstructorProfile) {
                data = await JudgeRequest.findByInstructor(
                    instructorProfile.id, { page, limit: 15, status }
                );
            } else {
                data = await JudgeRequest.findByRequester(
                    req.session.userId, { page, limit: 15, status }
                );
            }

            res.render('pages/booking/index', {
                title:             'My Bookings',
                ...data,
                statusFilter:      status,
                currentView:       view,
                isInstructor:      isInstructorView,
                canToggleView:     isSchoolOwner && hasInstructorProfile,
                STATUS_BADGE
            });
        } catch (err) { next(err); }
    }

    // ── GET /bookings/:id ─────────────────────────────────────────────────────
    static async show(req, res, next) {
        try {
            const request = await JudgeRequest.findById(parseInt(req.params.id, 10));

            if (!request || !(await isParty(req, request))) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'Booking Not Found'
                });
            }

            const isInstructor  = req.session.roleId === Roles.INSTRUCTOR;
            const isSchoolOwner = req.session.userId === request.requester_id;

            res.render('pages/booking/show', {
                title:        `Booking #${request.id}`,
                request,
                STATUS_BADGE,
                isInstructor,
                isSchoolOwner
            });
        } catch (err) { next(err); }
    }

    // ── POST /bookings/:id/accept ─────────────────────────────────────────────
    static async accept(req, res, next) {
        try {
            const id      = parseInt(req.params.id, 10);
            const request = await JudgeRequest.findById(id);

            if (!request) return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', { title: 'Not Found' });

            // Ownership: caller must be the instructor named in the request
            const profile = await InstructorProfile.findByUserId(req.session.userId);
            if (!profile || profile.id !== request.instructor_id) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Access Denied' });
            }

            if (request.status !== 'pending') {
                req.session.flash = { type: 'warning', message: 'This request is no longer pending and cannot be accepted.' };
                return res.redirect(`/bookings/${id}`);
            }

            // ── Double-booking guard ──────────────────────────────────────────
            const alreadyBooked = await JudgeRequest.acceptedOnDate(profile.id, request.requested_date, id);
            if (alreadyBooked) {
                req.session.flash = {
                    type:    'error',
                    message: `You already have an accepted booking on ${new Date(request.requested_date).toLocaleDateString('en-US', { dateStyle: 'long' })}. Please decline this request or contact the school to change the date.`
                };
                return res.redirect(`/bookings/${id}`);
            }

            // ── Persist acceptance ────────────────────────────────────────────
            await JudgeRequest.updateStatus(id, 'accepted');

            // When linked to an event, add the instructor to event_staff
            if (request.event_id) {
                await pool.query(
                    `INSERT INTO event_staff (event_id, instructor_id, staff_role, status)
                     VALUES (?, ?, 'judge', 'confirmed')
                     ON DUPLICATE KEY UPDATE status = 'confirmed'`,
                    [request.event_id, profile.id]
                );
            }

            // ── Notify school owner ───────────────────────────────────────────
            await notifier.judgeRequestAccepted(
                request.requester_id,
                id,
                `${profile.first_name} ${profile.last_name}`
            );

            req.session.flash = { type: 'success', message: 'You have accepted this judge request. The school has been notified.' };
            res.redirect(`/bookings/${id}`);
        } catch (err) { next(err); }
    }

    // ── POST /bookings/:id/decline ────────────────────────────────────────────
    static async decline(req, res, next) {
        try {
            const id      = parseInt(req.params.id, 10);
            const request = await JudgeRequest.findById(id);

            if (!request) return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', { title: 'Not Found' });

            const profile = await InstructorProfile.findByUserId(req.session.userId);
            if (!profile || profile.id !== request.instructor_id) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Access Denied' });
            }

            if (request.status !== 'pending') {
                req.session.flash = { type: 'warning', message: 'This request cannot be declined in its current status.' };
                return res.redirect(`/bookings/${id}`);
            }

            const responseMessage = (req.body.responseMessage || '').trim().slice(0, 1000) || null;
            await JudgeRequest.updateStatus(id, 'declined', responseMessage);

            await notifier.judgeRequestDeclined(
                request.requester_id,
                id,
                `${profile.first_name} ${profile.last_name}`
            );

            req.session.flash = { type: 'success', message: 'You have declined this request. The school has been notified.' };
            res.redirect(`/bookings/${id}`);
        } catch (err) { next(err); }
    }

    // ── POST /bookings/:id/cancel ─────────────────────────────────────────────
    static async cancel(req, res, next) {
        try {
            const id      = parseInt(req.params.id, 10);
            const request = await JudgeRequest.findById(id);

            if (!request) return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', { title: 'Not Found' });
            if (req.session.userId !== request.requester_id) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Access Denied' });
            }

            if (!['pending', 'accepted'].includes(request.status)) {
                req.session.flash = { type: 'warning', message: 'This request cannot be cancelled in its current status.' };
                return res.redirect(`/bookings/${id}`);
            }

            const wasAccepted = request.status === 'accepted';
            await JudgeRequest.updateStatus(id, 'cancelled');

            // Remove from event_staff if it was accepted
            if (wasAccepted && request.event_id) {
                await pool.query(
                    'DELETE FROM event_staff WHERE event_id = ? AND instructor_id = ?',
                    [request.event_id, request.instructor_id]
                );
            }

            // Only notify the instructor if they had already accepted
            if (wasAccepted) {
                await notifier.judgeRequestCancelled(
                    request.instructor_user_id,
                    id,
                    request.school_name || `${request.requester_first_name} ${request.requester_last_name}`
                );
            }

            req.session.flash = { type: 'success', message: 'The booking request has been cancelled.' };
            res.redirect('/bookings');
        } catch (err) { next(err); }
    }

    // ── POST /bookings/:id/complete ───────────────────────────────────────────
    static async complete(req, res, next) {
        try {
            const id      = parseInt(req.params.id, 10);
            const request = await JudgeRequest.findById(id);

            if (!request) return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', { title: 'Not Found' });

            const isOwner = req.session.userId === request.requester_id;
            const isAdmin = req.session.roleId  === Roles.ADMINISTRATOR;
            if (!isOwner && !isAdmin) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Access Denied' });
            }

            if (request.status !== 'accepted') {
                req.session.flash = { type: 'warning', message: 'Only accepted bookings can be marked complete.' };
                return res.redirect(`/bookings/${id}`);
            }

            await JudgeRequest.updateStatus(id, 'completed');

            // Update event_staff to completed as well
            if (request.event_id) {
                await pool.query(
                    `UPDATE event_staff SET status = 'completed'
                     WHERE event_id = ? AND instructor_id = ?`,
                    [request.event_id, request.instructor_id]
                );
            }

            req.session.flash = { type: 'success', message: 'Booking marked as completed.' };
            res.redirect(`/bookings/${id}`);
        } catch (err) { next(err); }
    }
}

module.exports = BookingController;
