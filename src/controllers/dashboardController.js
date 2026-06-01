
const pool              = require('../modules/pool');
const { Roles }         = require('../constants/roles');
const InstructorProfile = require('../models/InstructorProfile');
const School            = require('../models/School');
const Event             = require('../models/Event');
const AdminStats        = require('../models/AdminStats');
const { STATUS_BADGE }  = require('../constants/event');

class DashboardController {

    // Route entry-point — dispatches to the correct role-specific handler.
    static async index(req, res, next) {
        const { roleId } = req.session;

        if (roleId === Roles.ADMINISTRATOR) return DashboardController.#adminDash(req, res, next);
        if (roleId === Roles.SCHOOL_OWNER)  return DashboardController.#schoolDash(req, res, next);
        if (roleId === Roles.INSTRUCTOR)    return DashboardController.#instructorDash(req, res, next);

        res.redirect('/login');
    }

    // ── Admin dashboard ───────────────────────────────────────────────────────
    static async #adminDash(req, res, next) {
        try {
            const stats = await AdminStats.getSummary();
            res.render('pages/dashboard/admin', {
                title: 'Admin Dashboard',
                stats,
                STATUS_BADGE
            });
        } catch (err) { next(err); }
    }

    // ── School Owner dashboard ────────────────────────────────────────────────
    static async #schoolDash(req, res, next) {
        try {
            const ownedSchools = await School.findAllByOwner(req.session.userId);
            // Use query param ?school=ID to switch between schools, else first
            const schoolId = parseInt(req.query.school || '0', 10);
            const school   = schoolId
                ? ownedSchools.find(s => s.id === schoolId) ?? ownedSchools[0] ?? null
                : ownedSchools[0] ?? null;

            if (!school) {
                return res.render('pages/dashboard/school', {
                    title:           'School Dashboard',
                    school:          null,
                    ownedSchools,
                    stats:           null,
                    upcomingEvents:  [],
                    roster:          [],
                    pendingRequests: [],
                    totalEvents:     0,
                    totalRequests:   0
                });
            }

            const [
                [reqStats],
                [evtStats],
                roster,
                upcomingEvents,
                [pendingRows]
            ] = await Promise.all([

                // Judge request summary for this school owner
                pool.query(`
                    SELECT
                        SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END)                               AS pending,
                        SUM(CASE WHEN status = 'accepted' AND requested_date >= CURDATE()
                                  THEN 1 ELSE 0 END)                                                        AS upcoming_accepted,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)                              AS completed
                    FROM judge_requests
                    WHERE requester_id = ? AND deleted_at IS NULL
                `, [req.session.userId]),

                // Event summary for this school
                pool.query(`
                    SELECT
                        COUNT(*)                                                                             AS total,
                        SUM(CASE WHEN status IN ('published','draft')
                                  AND start_datetime >= NOW() THEN 1 ELSE 0 END)                            AS upcoming,
                        SUM(CASE WHEN event_type = 'belt_testing'
                                  AND status != 'cancelled'
                                  AND start_datetime >= NOW() THEN 1 ELSE 0 END)                            AS upcoming_tests
                    FROM events
                    WHERE school_id = ? AND deleted_at IS NULL
                `, [school.id]),

                School.getRoster(school.id),
                Event.findUpcomingBySchool(school.id, 5),

                // Pending judge requests with instructor details (for the action table)
                pool.query(`
                    SELECT jr.id,
                           jr.requested_date, jr.requested_time, jr.status,
                           jr.required_rank, jr.created_at,
                           iu.first_name        AS instructor_first,
                           iu.last_name         AS instructor_last,
                           iu.profile_photo_url AS instructor_photo,
                           i.rank               AS instructor_rank,
                           e.title              AS event_title,
                           e.event_type
                    FROM judge_requests jr
                    INNER JOIN instructors i  ON jr.instructor_id = i.id
                    INNER JOIN users       iu ON i.user_id         = iu.id
                    LEFT  JOIN events      e  ON jr.event_id        = e.id
                    WHERE jr.requester_id = ?
                      AND jr.status       = 'pending'
                      AND jr.deleted_at   IS NULL
                    ORDER BY jr.requested_date ASC
                    LIMIT 6
                `, [req.session.userId])
            ]);

            res.render('pages/dashboard/school', {
                title: 'School Dashboard',
                school,
                ownedSchools,
                stats: {
                    pending:          reqStats[0].pending          ?? 0,
                    upcomingAccepted: reqStats[0].upcoming_accepted ?? 0,
                    completed:        reqStats[0].completed         ?? 0,
                    totalEvents:      evtStats[0].total             ?? 0,
                    upcomingEvents:   evtStats[0].upcoming          ?? 0,
                    upcomingTests:    evtStats[0].upcoming_tests    ?? 0,
                    rosterCount:      roster.length
                },
                upcomingEvents,
                roster:          roster.slice(0, 5),
                pendingRequests: pendingRows
            });
        } catch (err) { next(err); }
    }

    // ── Instructor dashboard ──────────────────────────────────────────────────
    static async #instructorDash(req, res, next) {
        try {
            const profile = await InstructorProfile.findByUserId(req.session.userId);

            if (!profile) {
                return res.render('pages/dashboard/instructor', {
                    title:   'Dashboard',
                    profile: null,
                    stats:   null,
                    upcomingAssignments: [],
                    pendingRequests:     [],
                    recentNotifications: [],
                    profileChecks:       {},
                    profileCompleteness: 0
                });
            }

            const today = new Date().toISOString().split('T')[0];
            const in30d = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

            const [
                [reqStats],
                [availStats],
                [assignments],
                [pending],
                [notifs]
            ] = await Promise.all([

                // Booking request summary (as instructor)
                pool.query(`
                    SELECT
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)                                AS pending,
                        SUM(CASE WHEN status = 'accepted' AND requested_date >= CURDATE()
                                  THEN 1 ELSE 0 END)                                                        AS upcoming,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)                              AS completed
                    FROM judge_requests
                    WHERE instructor_id = ? AND deleted_at IS NULL
                `, [profile.id]),

                // Availability breakdown for next 30 days
                pool.query(`
                    SELECT
                        SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) AS available_days,
                        SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END) AS blocked_days
                    FROM availability
                    WHERE instructor_id   = ?
                      AND available_date BETWEEN ? AND ?
                `, [profile.id, today, in30d]),

                // Upcoming confirmed assignments
                pool.query(`
                    SELECT jr.id, jr.requested_date, jr.requested_time,
                           jr.location_name, jr.required_rank, jr.judges_needed,
                           ru.first_name AS requester_first,
                           ru.last_name  AS requester_last,
                           s.name        AS school_name,
                           s.slug        AS school_slug,
                           e.title       AS event_title,
                           e.event_type,
                           e.start_datetime
                    FROM judge_requests jr
                    INNER JOIN users   ru ON jr.requester_id = ru.id
                    LEFT  JOIN schools s  ON s.owner_id      = jr.requester_id AND s.deleted_at IS NULL
                    LEFT  JOIN events  e  ON jr.event_id     = e.id            AND e.deleted_at IS NULL
                    WHERE jr.instructor_id   = ?
                      AND jr.status          = 'accepted'
                      AND jr.requested_date >= CURDATE()
                      AND jr.deleted_at      IS NULL
                    ORDER BY jr.requested_date ASC
                    LIMIT 5
                `, [profile.id]),

                // Incoming pending requests
                pool.query(`
                    SELECT jr.id, jr.requested_date, jr.requested_time,
                           jr.message, jr.required_rank, jr.judges_needed,
                           jr.created_at,
                           ru.first_name        AS requester_first,
                           ru.last_name         AS requester_last,
                           ru.profile_photo_url AS requester_photo,
                           s.name               AS school_name,
                           e.title              AS event_title,
                           e.event_type
                    FROM judge_requests jr
                    INNER JOIN users   ru ON jr.requester_id = ru.id
                    LEFT  JOIN schools s  ON s.owner_id      = jr.requester_id AND s.deleted_at IS NULL
                    LEFT  JOIN events  e  ON jr.event_id     = e.id
                    WHERE jr.instructor_id = ?
                      AND jr.status        = 'pending'
                      AND jr.deleted_at    IS NULL
                    ORDER BY jr.created_at DESC
                    LIMIT 5
                `, [profile.id]),

                // 5 most recent notifications
                pool.query(`
                    SELECT id, type, title, body, is_read,
                           reference_type, reference_id, created_at
                    FROM notifications
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 5
                `, [req.session.userId])
            ]);

            // Profile completeness check
            const checks = {
                photo:       !!profile.profile_photo_url,
                bio:         !!(profile.bio && profile.bio.length > 20),
                rank:        !!profile.rank,
                specialties: !!(profile.specialties && profile.specialties.length > 0),
                ata:         !!profile.ata_member_number,
                public:      !!profile.is_public
            };
            const completeness = Math.round(
                (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
            );

            res.render('pages/dashboard/instructor', {
                title:   'Dashboard',
                profile,
                stats: {
                    pending:             reqStats[0].pending        ?? 0,
                    upcoming:            reqStats[0].upcoming        ?? 0,
                    completed:           reqStats[0].completed       ?? 0,
                    availableDays:       availStats[0].available_days ?? 0,
                    blockedDays:         availStats[0].blocked_days   ?? 0,
                    unreadMessages:      res.locals.unreadMessageCount,
                    unreadNotifications: res.locals.unreadNotificationCount
                },
                upcomingAssignments: assignments,
                pendingRequests:     pending,
                recentNotifications: notifs,
                profileChecks:       checks,
                profileCompleteness: completeness
            });
        } catch (err) { next(err); }
    }
}

module.exports = DashboardController;
