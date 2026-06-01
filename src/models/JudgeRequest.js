
const pool = require('../modules/pool');

// Enriched SELECT that exposes every field needed by views and the notifier.
// instructor_user_id lets notification code reach the instructor's auth record
// without a second query.
const SELECT_REQUEST = `
    SELECT
        jr.id,
        jr.requester_id,
        jr.instructor_id,
        jr.event_id,
        jr.requested_date,
        jr.requested_time,
        jr.location_name,
        jr.required_rank,
        jr.judges_needed,
        jr.message,
        jr.status,
        jr.response_message,
        jr.responded_at,
        jr.created_at,
        jr.updated_at,
        -- Instructor identity
        i.user_id           AS instructor_user_id,
        i.rank              AS instructor_rank,
        i.certification_level AS instructor_cert_level,
        iu.first_name       AS instructor_first_name,
        iu.last_name        AS instructor_last_name,
        iu.profile_photo_url AS instructor_photo,
        -- Requester identity
        ru.first_name       AS requester_first_name,
        ru.last_name        AS requester_last_name,
        -- Linked event (nullable)
        e.title             AS event_title,
        e.start_datetime    AS event_start,
        e.end_datetime      AS event_end,
        e.event_type        AS event_type,
        e.location_name     AS event_location,
        -- Requester's school (nullable — owner may not have created school yet)
        s.name              AS school_name,
        s.slug              AS school_slug
    FROM judge_requests jr
    INNER JOIN instructors i  ON jr.instructor_id = i.id
    INNER JOIN users       iu ON i.user_id         = iu.id
    INNER JOIN users       ru ON jr.requester_id   = ru.id
    LEFT  JOIN events      e  ON jr.event_id        = e.id  AND e.deleted_at IS NULL
    LEFT  JOIN schools     s  ON s.owner_id         = jr.requester_id AND s.deleted_at IS NULL
`;

class JudgeRequest {

    // ── Lookups ───────────────────────────────────────────────────────────────

    static async findById(id) {
        const [rows] = await pool.query(
            `${SELECT_REQUEST} WHERE jr.id = ? AND jr.deleted_at IS NULL LIMIT 1`,
            [id]
        );
        return rows[0] ?? null;
    }

    // Requests SENT by a school owner
    static async findByRequester(userId, { page = 1, limit = 10, status = '' } = {}) {
        const offset = (page - 1) * limit;
        const where  = status
            ? 'WHERE jr.requester_id = ? AND jr.status = ? AND jr.deleted_at IS NULL'
            : 'WHERE jr.requester_id = ? AND jr.deleted_at IS NULL';
        const params = status ? [userId, status] : [userId];

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM judge_requests jr ${where}`,
            params
        );
        const [rows] = await pool.query(
            `${SELECT_REQUEST} ${where}
             ORDER BY jr.created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        return { requests: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // Requests RECEIVED by an instructor
    static async findByInstructor(instructorId, { page = 1, limit = 10, status = '' } = {}) {
        const offset = (page - 1) * limit;
        const where  = status
            ? 'WHERE jr.instructor_id = ? AND jr.status = ? AND jr.deleted_at IS NULL'
            : 'WHERE jr.instructor_id = ? AND jr.deleted_at IS NULL';
        const params = status ? [instructorId, status] : [instructorId];

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM judge_requests jr ${where}`,
            params
        );
        const [rows] = await pool.query(
            `${SELECT_REQUEST} ${where}
             ORDER BY FIELD(jr.status,'pending','accepted','declined','cancelled','completed'),
                      jr.requested_date ASC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        return { requests: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    static async create({
        requesterId, instructorId, eventId,
        requestedDate, requestedTime, locationName,
        requiredRank, judgesNeeded, message
    }) {
        const [result] = await pool.query(
            `INSERT INTO judge_requests
                (requester_id, instructor_id, event_id,
                 requested_date, requested_time, location_name,
                 required_rank, judges_needed, message, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                requesterId,
                instructorId,
                eventId       || null,
                requestedDate,
                requestedTime || null,
                locationName  || null,
                requiredRank  || null,
                judgesNeeded  || 1,
                message       || null
            ]
        );
        return result.insertId;
    }

    static async updateStatus(id, status, responseMessage = null) {
        await pool.query(
            `UPDATE judge_requests
             SET status           = ?,
                 response_message = ?,
                 responded_at     = CASE
                     WHEN ? IN ('accepted','declined') THEN NOW()
                     ELSE responded_at
                 END
             WHERE id = ? AND deleted_at IS NULL`,
            [status, responseMessage || null, status, id]
        );
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    // Prevent duplicate pending requests for the same instructor on the same date.
    static async pendingExists(requesterId, instructorId, requestedDate) {
        const [rows] = await pool.query(
            `SELECT id FROM judge_requests
             WHERE requester_id = ? AND instructor_id = ?
               AND requested_date = ? AND status = 'pending'
               AND deleted_at IS NULL
             LIMIT 1`,
            [requesterId, instructorId, requestedDate]
        );
        return rows.length > 0;
    }

    // Prevent double-booking: returns true if the instructor already has an
    // accepted booking on the target date (excluding the request being acted on).
    static async acceptedOnDate(instructorId, requestedDate, excludeRequestId = null) {
        const [rows] = await pool.query(
            `SELECT id FROM judge_requests
             WHERE instructor_id = ? AND requested_date = ?
               AND status = 'accepted' AND deleted_at IS NULL
               AND (? IS NULL OR id != ?)
             LIMIT 1`,
            [instructorId, requestedDate, excludeRequestId, excludeRequestId]
        );
        return rows.length > 0;
    }
}

module.exports = JudgeRequest;
