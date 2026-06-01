
const pool = require('../modules/pool');

const SELECT_EVENT = `
    SELECT
        e.id,
        e.school_id,
        e.created_by,
        e.title,
        e.description,
        e.event_type,
        e.location_name,
        e.address,
        e.city,
        e.state,
        e.country,
        e.postal_code,
        e.start_datetime,
        e.end_datetime,
        e.max_participants,
        e.judges_needed,
        e.required_judge_rank,
        e.registration_deadline,
        e.is_public,
        e.status,
        e.created_at,
        e.updated_at,
        s.name AS school_name,
        s.slug AS school_slug
    FROM events e
    LEFT JOIN schools s ON e.school_id = s.id AND s.deleted_at IS NULL
`;

class Event {

    // ── Lookups ───────────────────────────────────────────────────────────────

    static async findById(id) {
        const [rows] = await pool.query(
            `${SELECT_EVENT} WHERE e.id = ? AND e.deleted_at IS NULL LIMIT 1`,
            [id]
        );
        return rows[0] ?? null;
    }

    static async findBySchool(schoolId, { page = 1, limit = 10 } = {}) {
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query(
            'SELECT COUNT(*) AS total FROM events WHERE school_id = ? AND deleted_at IS NULL',
            [schoolId]
        );

        const [rows] = await pool.query(
            `${SELECT_EVENT}
             WHERE e.school_id = ? AND e.deleted_at IS NULL
             ORDER BY e.start_datetime DESC
             LIMIT ? OFFSET ?`,
            [schoolId, limit, offset]
        );

        return { events: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // Upcoming published events (for public school page)
    static async findUpcomingBySchool(schoolId, limit = 5) {
        const [rows] = await pool.query(
            `${SELECT_EVENT}
             WHERE e.school_id = ? AND e.deleted_at IS NULL
               AND e.status = 'published' AND e.start_datetime >= NOW()
             ORDER BY e.start_datetime ASC
             LIMIT ?`,
            [schoolId, limit]
        );
        return rows;
    }

    // Public calendar: all schools, published, upcoming
    static async findPublished({ page = 1, limit = 12, eventType = '' } = {}) {
        const offset = (page - 1) * limit;
        const where  = `
            WHERE e.is_public = 1 AND e.status = 'published'
              AND e.start_datetime >= NOW()
              AND e.deleted_at IS NULL
              AND (? = '' OR e.event_type = ?)
        `;
        const params = [eventType, eventType];

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM events e ${where}`, params
        );
        const [rows] = await pool.query(
            `${SELECT_EVENT} ${where} ORDER BY e.start_datetime ASC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { events: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    static async create(schoolId, createdBy, data) {
        const {
            title, description, eventType,
            locationName, address, city, state, country, postalCode,
            startDatetime, endDatetime, maxParticipants,
            judgesNeeded, requiredJudgeRank,
            registrationDeadline, isPublic, status
        } = data;

        const [result] = await pool.query(
            `INSERT INTO events
                (school_id, created_by, title, description, event_type,
                 location_name, address, city, state, country, postal_code,
                 start_datetime, end_datetime, max_participants,
                 judges_needed, required_judge_rank,
                 registration_deadline, is_public, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                schoolId, createdBy,
                title, description || null, eventType,
                locationName || null, address || null,
                city || null, state || null,
                country || 'CA', postalCode || null,
                startDatetime, endDatetime,
                maxParticipants || null,
                judgesNeeded || null, requiredJudgeRank || null,
                registrationDeadline || null,
                isPublic ? 1 : 0,
                status || 'draft'
            ]
        );
        return result.insertId;
    }

    static async update(id, data) {
        const {
            title, description, eventType,
            locationName, address, city, state, country, postalCode,
            startDatetime, endDatetime, maxParticipants,
            judgesNeeded, requiredJudgeRank,
            registrationDeadline, isPublic, status
        } = data;

        await pool.query(
            `UPDATE events
             SET title = ?, description = ?, event_type = ?,
                 location_name = ?, address = ?, city = ?, state = ?,
                 country = ?, postal_code = ?,
                 start_datetime = ?, end_datetime = ?,
                 max_participants = ?, judges_needed = ?, required_judge_rank = ?,
                 registration_deadline = ?,
                 is_public = ?, status = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [
                title, description || null, eventType,
                locationName || null, address || null,
                city || null, state || null,
                country || 'CA', postalCode || null,
                startDatetime, endDatetime,
                maxParticipants || null,
                judgesNeeded || null, requiredJudgeRank || null,
                registrationDeadline || null,
                isPublic ? 1 : 0, status,
                id
            ]
        );
    }

    static async updateStatus(id, status) {
        await pool.query(
            'UPDATE events SET status = ? WHERE id = ? AND deleted_at IS NULL',
            [status, id]
        );
    }
}

module.exports = Event;
