
/**
 * RecommendationQuery — single SQL query that fetches all instructor candidates
 * for an event, pre-computing every signal the Scorer needs in one round-trip.
 *
 * Filters applied in SQL (non-negotiable disqualifiers):
 *   • Instructor is explicitly blocked on the event date  (availability.is_available = 0)
 *   • Instructor has an ACCEPTED booking on the event date (double-booking)
 *   • Instructor belongs to the requesting school  (conflict of interest)
 *   • Instructor profile is not public / user is inactive
 */

const pool = require('../modules/pool');

class RecommendationQuery {

    static async getCandidates(event, { maxCandidates = 150 } = {}) {
        // Derive the event date (DATE portion of start_datetime).
        // If no start_datetime, use a far-future date so the availability join
        // matches nothing — availability signal will fall back to profile flags.
        const eventDate = event.start_datetime
            ? new Date(event.start_datetime).toISOString().split('T')[0]
            : '9999-12-31';

        const eventType  = event.event_type   || 'other';
        const schoolId   = event.school_id    || 0;

        const [rows] = await pool.query(
            `SELECT
                i.id,
                i.rank,
                i.certification_level,
                i.years_experience,
                i.city               AS instructor_city,
                i.state              AS instructor_state,
                i.country            AS instructor_country,
                i.travel_radius_miles,
                i.is_available_for_events,
                i.is_available_for_testing,
                i.is_available_for_seminars,

                u.first_name,
                u.last_name,
                u.profile_photo_url,

                sch.name             AS school_name,
                sch.slug             AS school_slug,
                sch.city             AS school_city,
                sch.state            AS school_state,

                -- Per-date availability from the calendar (NULL = no explicit entry)
                a.is_available       AS explicit_availability,
                a.start_time         AS avail_start,
                a.end_time           AS avail_end,

                -- Total completed judging assignments (all event types)
                (
                    SELECT COUNT(*)
                    FROM   judge_requests jh
                    WHERE  jh.instructor_id = i.id
                      AND  jh.status        = 'completed'
                      AND  jh.deleted_at    IS NULL
                )                    AS judging_total,

                -- Completed assignments matching this event type
                -- event_id is nullable; only count when linked event matches
                (
                    SELECT COUNT(*)
                    FROM   judge_requests jh2
                    LEFT JOIN events ev2
                          ON ev2.id          = jh2.event_id
                         AND ev2.deleted_at  IS NULL
                    WHERE  jh2.instructor_id = i.id
                      AND  jh2.status        = 'completed'
                      AND  jh2.deleted_at    IS NULL
                      AND  ev2.event_type    = ?
                )                    AS judging_type_match,

                -- Specialties concatenated for display
                GROUP_CONCAT(
                    sp.specialty
                    ORDER BY sp.specialty
                    SEPARATOR '||'
                )                    AS specialties_raw

             FROM  instructors i
             INNER JOIN users u
                     ON u.id         = i.user_id
                    AND u.deleted_at IS NULL
                    AND u.is_active  = 1

             LEFT  JOIN schools sch
                     ON sch.id       = i.school_id
                    AND sch.deleted_at IS NULL

             -- Availability for the event date
             LEFT  JOIN availability a
                     ON a.instructor_id  = i.id
                    AND a.available_date = ?

             LEFT  JOIN instructor_specialties sp
                     ON sp.instructor_id = i.id

             WHERE i.is_public    = 1
               AND i.deleted_at   IS NULL

               -- Hard exclude: instructor is explicitly blocked that day
               AND (a.id IS NULL OR a.is_available = 1)

               -- Hard exclude: instructor already has an accepted booking that day
               AND NOT EXISTS (
                   SELECT 1
                   FROM   judge_requests jex
                   WHERE  jex.instructor_id  = i.id
                     AND  jex.requested_date = ?
                     AND  jex.status         = 'accepted'
                     AND  jex.deleted_at     IS NULL
               )

               -- Hard exclude: instructor affiliated with requesting school
               AND (i.school_id IS NULL OR i.school_id != ?)

             GROUP BY i.id
             LIMIT ?`,
            [eventType, eventDate, eventDate, schoolId, maxCandidates]
        );

        return rows.map(r => ({
            ...r,
            specialties:         r.specialties_raw ? r.specialties_raw.split('||') : [],
            judging_total:       Number(r.judging_total      ?? 0),
            judging_type_match:  Number(r.judging_type_match ?? 0)
        }));
    }
}

module.exports = RecommendationQuery;
