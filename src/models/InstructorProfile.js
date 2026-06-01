
const pool = require('../modules/pool');

// Full column list used by both findByUserId and findById.
// Joins users + instructors + schools so one query returns everything needed
// to render any profile view.
const SELECT_PROFILE = `
    SELECT
        i.id,
        i.user_id,
        i.school_id,
        i.ata_member_number,
        i.rank,
        i.certification_level,
        i.years_experience,
        i.bio,
        i.city,
        i.state,
        i.country,
        i.is_public,
        i.is_available_for_events,
        i.is_available_for_testing,
        i.is_available_for_seminars,
        i.travel_radius_miles,
        i.created_at,
        i.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.profile_photo_url,
        s.name AS school_name,
        s.slug AS school_slug
    FROM instructors i
    INNER JOIN users   u ON i.user_id   = u.id AND u.deleted_at IS NULL
    LEFT  JOIN schools s ON i.school_id = s.id AND s.deleted_at IS NULL
`;

class InstructorProfile {

    // ── Lookups ───────────────────────────────────────────────────────────────

    static async findByUserId(userId) {
        const [rows] = await pool.query(
            `${SELECT_PROFILE} WHERE i.user_id = ? AND i.deleted_at IS NULL LIMIT 1`,
            [userId]
        );
        if (!rows[0]) return null;
        rows[0].specialties = await InstructorProfile.getSpecialties(rows[0].id);
        return rows[0];
    }

    static async findById(instructorId) {
        const [rows] = await pool.query(
            `${SELECT_PROFILE} WHERE i.id = ? AND i.deleted_at IS NULL LIMIT 1`,
            [instructorId]
        );
        if (!rows[0]) return null;
        rows[0].specialties = await InstructorProfile.getSpecialties(rows[0].id);
        return rows[0];
    }

    static async existsByUserId(userId) {
        const [rows] = await pool.query(
            'SELECT id FROM instructors WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
            [userId]
        );
        return rows.length > 0;
    }

    // ── Directory (public browse) ─────────────────────────────────────────────

    static async findAll({ page = 1, limit = 12, search = '', specialty = '' } = {}) {
        const offset = (page - 1) * limit;
        const searchParam = search ? `%${search}%` : '';

        const baseWhere = `
            WHERE i.is_public = 1
              AND i.deleted_at IS NULL
              AND u.is_active = 1
              AND (? = '' OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)
              AND (? = '' OR EXISTS (
                      SELECT 1 FROM instructor_specialties
                      WHERE instructor_id = i.id AND specialty = ?
                  ))
        `;

        const params = [searchParam, searchParam, specialty, specialty];

        const [countRows] = await pool.query(
            `SELECT COUNT(DISTINCT i.id) AS total
             FROM instructors i
             INNER JOIN users u ON i.user_id = u.id AND u.deleted_at IS NULL
             ${baseWhere}`,
            params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT
                i.id,
                i.rank,
                i.certification_level,
                i.years_experience,
                i.city,
                i.state,
                i.country,
                i.is_available_for_events,
                i.is_available_for_testing,
                i.is_available_for_seminars,
                i.travel_radius_miles,
                u.first_name,
                u.last_name,
                u.profile_photo_url,
                s.name AS school_name,
                s.slug AS school_slug,
                GROUP_CONCAT(sp.specialty ORDER BY sp.specialty SEPARATOR '||') AS specialties_raw
             FROM instructors i
             INNER JOIN users u ON i.user_id = u.id AND u.deleted_at IS NULL
             LEFT  JOIN schools s ON i.school_id = s.id AND s.deleted_at IS NULL
             LEFT  JOIN instructor_specialties sp ON i.id = sp.instructor_id
             ${baseWhere}
             GROUP BY i.id
             ORDER BY u.last_name ASC, u.first_name ASC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Parse the concatenated specialties string into an array
        const instructors = rows.map(r => ({
            ...r,
            specialties: r.specialties_raw ? r.specialties_raw.split('||') : []
        }));

        return { instructors, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    // Creates or updates the instructor profile row (single operation thanks to
    // UNIQUE KEY uq_instructors_user) and replaces all specialties atomically.
    static async upsert(userId, data, specialties = []) {
        const {
            ataMemberNumber,
            rank,
            certificationLevel,
            yearsExperience,
            bio,
            city,
            state,
            country,
            isPublic,
            isAvailableForEvents,
            isAvailableForTesting,
            isAvailableForSeminars,
            travelRadiusMiles
        } = data;

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Upsert the instructor row
            await conn.query(
                `INSERT INTO instructors
                    (user_id, ata_member_number, \`rank\`, certification_level,
                     years_experience, bio, city, state, country,
                     is_public, is_available_for_events,
                     is_available_for_testing, is_available_for_seminars,
                     travel_radius_miles)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    ata_member_number         = VALUES(ata_member_number),
                    \`rank\`                  = VALUES(\`rank\`),
                    certification_level       = VALUES(certification_level),
                    years_experience          = VALUES(years_experience),
                    bio                       = VALUES(bio),
                    city                      = VALUES(city),
                    state                     = VALUES(state),
                    country                   = VALUES(country),
                    is_public                 = VALUES(is_public),
                    is_available_for_events   = VALUES(is_available_for_events),
                    is_available_for_testing  = VALUES(is_available_for_testing),
                    is_available_for_seminars = VALUES(is_available_for_seminars),
                    travel_radius_miles       = VALUES(travel_radius_miles)`,
                [
                    userId,
                    ataMemberNumber   || null,
                    rank              || null,
                    certificationLevel || null,
                    yearsExperience   || null,
                    bio               || null,
                    city              || null,
                    state             || null,
                    country           || 'US',
                    isPublic   ? 1 : 0,
                    isAvailableForEvents   ? 1 : 0,
                    isAvailableForTesting  ? 1 : 0,
                    isAvailableForSeminars ? 1 : 0,
                    travelRadiusMiles || null
                ]
            );

            // Get the instructor row id (needed for specialties FK)
            const [idRows] = await conn.query(
                'SELECT id FROM instructors WHERE user_id = ?',
                [userId]
            );
            const instructorId = idRows[0].id;

            // Replace specialties: delete all then insert selected
            await conn.query(
                'DELETE FROM instructor_specialties WHERE instructor_id = ?',
                [instructorId]
            );

            if (specialties.length > 0) {
                const values = specialties.map(s => [instructorId, s]);
                await conn.query(
                    'INSERT INTO instructor_specialties (instructor_id, specialty) VALUES ?',
                    [values]
                );
            }

            await conn.commit();
            return instructorId;

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    // Updates first_name, last_name, phone, and optionally profile_photo_url on users.
    static async updateUserInfo(userId, { firstName, lastName, phone, profilePhotoUrl }) {
        if (profilePhotoUrl) {
            await pool.query(
                `UPDATE users
                 SET first_name = ?, last_name = ?, phone = ?, profile_photo_url = ?
                 WHERE id = ?`,
                [firstName, lastName, phone || null, profilePhotoUrl, userId]
            );
        } else {
            await pool.query(
                `UPDATE users
                 SET first_name = ?, last_name = ?, phone = ?
                 WHERE id = ?`,
                [firstName, lastName, phone || null, userId]
            );
        }
    }

    // ── Specialties ───────────────────────────────────────────────────────────

    static async getSpecialties(instructorId) {
        const [rows] = await pool.query(
            'SELECT specialty FROM instructor_specialties WHERE instructor_id = ? ORDER BY specialty',
            [instructorId]
        );
        return rows.map(r => r.specialty);
    }
}

module.exports = InstructorProfile;
