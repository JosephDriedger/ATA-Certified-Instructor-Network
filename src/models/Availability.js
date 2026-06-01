
const pool = require('../modules/pool');

class Availability {

    // ── Read ──────────────────────────────────────────────────────────────────

    // Returns an object keyed by 'YYYY-MM-DD' for O(1) lookup in the calendar view.
    // Only rows for the requested month are fetched — the calendar only ever
    // needs one month at a time.
    static async getMonthEntries(instructorId, year, month) {
        const [rows] = await pool.query(
            `SELECT available_date, is_available, start_time, end_time, notes
             FROM availability
             WHERE instructor_id = ?
               AND YEAR(available_date)  = ?
               AND MONTH(available_date) = ?
             ORDER BY available_date`,
            [instructorId, year, month]
        );

        const map = {};
        rows.forEach(r => {
            // mysql2 returns DATE columns as JS Date objects; normalise to string
            const key = r.available_date instanceof Date
                ? r.available_date.toISOString().split('T')[0]
                : String(r.available_date);
            map[key] = r;
        });
        return map;
    }

    // ── Write — single date ───────────────────────────────────────────────────

    static async setDate(instructorId, date, isAvailable, { startTime = null, endTime = null, notes = null } = {}) {
        await pool.query(
            `INSERT INTO availability (instructor_id, available_date, is_available, start_time, end_time, notes)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 is_available = VALUES(is_available),
                 start_time   = VALUES(start_time),
                 end_time     = VALUES(end_time),
                 notes        = VALUES(notes)`,
            [instructorId, date, isAvailable ? 1 : 0, startTime || null, endTime || null, notes || null]
        );
    }

    static async clearDate(instructorId, date) {
        await pool.query(
            'DELETE FROM availability WHERE instructor_id = ? AND available_date = ?',
            [instructorId, date]
        );
    }

    // ── Write — bulk ──────────────────────────────────────────────────────────

    static async setDates(instructorId, dates, isAvailable, notes = null) {
        if (!dates.length) return;
        const isAv = isAvailable ? 1 : 0;
        const values = dates.map(d => [instructorId, d, isAv, notes]);
        await pool.query(
            `INSERT INTO availability (instructor_id, available_date, is_available, notes)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                 is_available = VALUES(is_available),
                 notes        = VALUES(notes)`,
            [values]
        );
    }

    static async clearDates(instructorId, dates) {
        if (!dates.length) return;
        const placeholders = dates.map(() => '?').join(',');
        await pool.query(
            `DELETE FROM availability
             WHERE instructor_id = ? AND available_date IN (${placeholders})`,
            [instructorId, ...dates]
        );
    }

    // ── Search — available instructors on a specific date ────────────────────
    //
    // An instructor is available on `date` when:
    //   1. They have an explicit is_available=1 row for that date, OR
    //   2. They have no explicit row AND their profile's is_available_for_events=1
    //
    // An instructor is NOT available when:
    //   • They have an explicit is_available=0 (blocked) row, OR
    //   • They have an accepted judge_request on that date (double-booking guard)
    static async searchOnDate({ date, state = '', specialty = '', page = 1, limit = 12 } = {}) {
        const offset = (page - 1) * limit;

        // Shared WHERE block — params: [date(NOT EXISTS), state, state, specialty, specialty]
        const WHERE = `
            WHERE i.is_public    = 1
              AND i.deleted_at   IS NULL
              AND u.is_active    = 1
              AND u.deleted_at   IS NULL
              AND (
                  a.is_available = 1
                  OR (a.id IS NULL AND i.is_available_for_events = 1)
              )
              AND NOT EXISTS (
                  SELECT 1 FROM judge_requests jr
                  WHERE jr.instructor_id = i.id
                    AND jr.requested_date = ?
                    AND jr.status = 'accepted'
                    AND jr.deleted_at IS NULL
              )
              AND (? = '' OR i.state = ?)
              AND (? = '' OR EXISTS (
                  SELECT 1 FROM instructor_specialties
                  WHERE instructor_id = i.id AND specialty = ?
              ))
        `;

        // date for LEFT JOIN + 5 WHERE params
        const countParams = [date, date, state, state, specialty, specialty];
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(DISTINCT i.id) AS total
             FROM instructors i
             INNER JOIN users u ON i.user_id = u.id AND u.deleted_at IS NULL
             LEFT  JOIN availability a
                     ON a.instructor_id = i.id AND a.available_date = ?
             ${WHERE}`,
            countParams
        );

        const rowParams = [date, date, state, state, specialty, specialty, limit, offset];
        const [rows] = await pool.query(
            `SELECT
                i.id,
                i.rank,
                i.certification_level,
                i.travel_radius_miles,
                i.city,
                i.state,
                i.country,
                i.is_available_for_events,
                i.is_available_for_testing,
                i.is_available_for_seminars,
                u.first_name,
                u.last_name,
                u.profile_photo_url,
                s.name AS school_name,
                s.slug AS school_slug,
                a.is_available  AS explicit_available,
                a.start_time,
                a.end_time,
                a.notes         AS availability_notes,
                GROUP_CONCAT(sp.specialty ORDER BY sp.specialty SEPARATOR '||') AS specialties_raw
             FROM instructors i
             INNER JOIN users   u  ON i.user_id   = u.id  AND u.deleted_at IS NULL
             LEFT  JOIN schools s  ON i.school_id = s.id  AND s.deleted_at IS NULL
             LEFT  JOIN availability a
                             ON a.instructor_id = i.id AND a.available_date = ?
             LEFT  JOIN instructor_specialties sp ON sp.instructor_id = i.id
             ${WHERE}
             GROUP BY i.id
             ORDER BY
                 -- Explicitly available first, then default-available
                 CASE WHEN a.is_available = 1 THEN 0 ELSE 1 END,
                 u.last_name ASC, u.first_name ASC
             LIMIT ? OFFSET ?`,
            rowParams
        );

        const instructors = rows.map(r => ({
            ...r,
            specialties: r.specialties_raw ? r.specialties_raw.split('||') : []
        }));

        return { instructors, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}

module.exports = Availability;
