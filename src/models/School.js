
const pool = require('../modules/pool');

// ── Slug helpers ──────────────────────────────────────────────────────────

function buildSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
}

async function uniqueSlug(base, ownerId) {
    let slug = base;
    let attempt = 0;
    while (true) {
        const [rows] = await pool.query(
            'SELECT id FROM schools WHERE slug = ? LIMIT 1', [slug]
        );
        if (!rows.length) return slug;
        attempt++;
        slug = attempt === 1 ? `${base}-${ownerId}` : `${base}-${ownerId}-${attempt}`;
    }
}

// ── Shared SELECT fragment ────────────────────────────────────────────────

const SELECT_SCHOOL = `
    SELECT
        s.id,
        s.owner_id,
        s.name,
        s.slug,
        s.head_instructor_name,
        s.description,
        s.address,
        s.city,
        s.state,
        s.country,
        s.postal_code,
        s.phone,
        s.email,
        s.website_url,
        s.logo_url,
        s.is_active,
        s.created_at,
        s.updated_at,
        u.first_name AS owner_first_name,
        u.last_name  AS owner_last_name,
        u.email      AS owner_email
    FROM schools s
    INNER JOIN users u ON s.owner_id = u.id AND u.deleted_at IS NULL
`;

class School {

    // ── Lookups ───────────────────────────────────────────────────────────────

    // Returns the first school for backward-compat callsites that still
    // assume a single school.  New code should use findAllByOwner().
    static async findByOwnerId(ownerId) {
        const [rows] = await pool.query(
            `${SELECT_SCHOOL} WHERE s.owner_id = ? AND s.deleted_at IS NULL
             ORDER BY s.created_at ASC LIMIT 1`,
            [ownerId]
        );
        return rows[0] ?? null;
    }

    // Returns ALL schools owned by this user, oldest first.
    static async findAllByOwner(ownerId) {
        const [rows] = await pool.query(
            `${SELECT_SCHOOL} WHERE s.owner_id = ? AND s.deleted_at IS NULL
             ORDER BY s.created_at ASC`,
            [ownerId]
        );
        return rows;
    }

    static async findBySlug(slug) {
        const [rows] = await pool.query(
            `${SELECT_SCHOOL} WHERE s.slug = ? AND s.deleted_at IS NULL LIMIT 1`,
            [slug]
        );
        return rows[0] ?? null;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `${SELECT_SCHOOL} WHERE s.id = ? AND s.deleted_at IS NULL LIMIT 1`,
            [id]
        );
        return rows[0] ?? null;
    }

    // ── Directory ─────────────────────────────────────────────────────────────

    static async findAll({ page = 1, limit = 12, search = '' } = {}) {
        const offset      = (page - 1) * limit;
        const searchParam = search ? `%${search}%` : '';

        const baseWhere = `
            WHERE s.is_active = 1 AND s.deleted_at IS NULL
              AND (? = '' OR s.name LIKE ? OR s.city LIKE ?)
        `;
        const params = [searchParam, searchParam, searchParam];

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM schools s ${baseWhere}`,
            params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT
                s.id, s.name, s.slug, s.head_instructor_name,
                s.city, s.state, s.country,
                s.phone, s.email, s.website_url, s.logo_url,
                COUNT(DISTINCT si.instructor_id) AS instructor_count
             FROM schools s
             LEFT JOIN school_instructors si ON si.school_id = s.id
             ${baseWhere}
             GROUP BY s.id
             ORDER BY s.name ASC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { schools: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    // Always creates a NEW school for this owner.
    // Used for second/subsequent schools and from the registration flow.
    static async create(ownerId, data) {
        const {
            name, headInstructorName, description,
            address, city, state, country, postalCode,
            phone, email, websiteUrl, logoUrl, isActive
        } = data;

        const slug = await uniqueSlug(buildSlug(name), ownerId);
        const [result] = await pool.query(
            `INSERT INTO schools
                (owner_id, name, slug, head_instructor_name, description,
                 address, city, state, country, postal_code,
                 phone, email, website_url, logo_url, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ownerId, name, slug,
                headInstructorName || null, description || null,
                address || null, city || null, state || null,
                country || 'CA', postalCode || null,
                phone || null, email || null,
                websiteUrl || null, logoUrl || null,
                isActive ? 1 : 0
            ]
        );
        return result.insertId;
    }

    // Updates a specific school by ID, verifying ownership before saving.
    static async updateById(id, ownerId, data) {
        const {
            name, headInstructorName, description,
            address, city, state, country, postalCode,
            phone, email, websiteUrl, logoUrl, isActive
        } = data;

        const base = [
            name, headInstructorName || null, description || null,
            address || null, city || null, state || null,
            country || 'CA', postalCode || null,
            phone || null, email || null, websiteUrl || null
        ];

        if (logoUrl) {
            await pool.query(
                `UPDATE schools
                 SET name=?, head_instructor_name=?, description=?,
                     address=?, city=?, state=?, country=?,
                     postal_code=?, phone=?, email=?, website_url=?,
                     logo_url=?, is_active=?
                 WHERE id=? AND owner_id=? AND deleted_at IS NULL`,
                [...base, logoUrl, isActive ? 1 : 0, id, ownerId]
            );
        } else {
            await pool.query(
                `UPDATE schools
                 SET name=?, head_instructor_name=?, description=?,
                     address=?, city=?, state=?, country=?,
                     postal_code=?, phone=?, email=?, website_url=?,
                     is_active=?
                 WHERE id=? AND owner_id=? AND deleted_at IS NULL`,
                [...base, isActive ? 1 : 0, id, ownerId]
            );
        }
    }

    // Legacy upsert — creates if no school exists, updates the first one found.
    // Kept for the registration flow's initial school creation.
    static async upsert(ownerId, data) {
        const {
            name, headInstructorName, description,
            address, city, state, country, postalCode,
            phone, email, websiteUrl, logoUrl, isActive
        } = data;

        const existing = await School.findByOwnerId(ownerId);

        if (existing) {
            const updateFields = [
                name, headInstructorName || null, description || null,
                address || null, city || null, state || null,
                country || 'US', postalCode || null,
                phone || null, email || null,
                websiteUrl || null, isActive ? 1 : 0
            ];
            if (logoUrl) {
                await pool.query(
                    `UPDATE schools
                     SET name = ?, head_instructor_name = ?, description = ?,
                         address = ?, city = ?, state = ?, country = ?,
                         postal_code = ?, phone = ?, email = ?,
                         website_url = ?, logo_url = ?, is_active = ?
                     WHERE id = ?`,
                    [...updateFields.slice(0, 12), logoUrl, isActive ? 1 : 0, existing.id]
                );
            } else {
                await pool.query(
                    `UPDATE schools
                     SET name = ?, head_instructor_name = ?, description = ?,
                         address = ?, city = ?, state = ?, country = ?,
                         postal_code = ?, phone = ?, email = ?,
                         website_url = ?, is_active = ?
                     WHERE id = ?`,
                    [...updateFields, existing.id]
                );
            }
            return existing.id;
        }

        // New school — generate a unique slug
        const slug = await uniqueSlug(buildSlug(name), ownerId);
        const [result] = await pool.query(
            `INSERT INTO schools
                (owner_id, name, slug, head_instructor_name, description,
                 address, city, state, country, postal_code,
                 phone, email, website_url, logo_url, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ownerId, name, slug,
                headInstructorName || null, description || null,
                address || null, city || null, state || null,
                country || 'US', postalCode || null,
                phone || null, email || null,
                websiteUrl || null, logoUrl || null,
                isActive ? 1 : 0
            ]
        );
        return result.insertId;
    }

    // ── Roster ────────────────────────────────────────────────────────────────

    static async getRoster(schoolId) {
        const [rows] = await pool.query(
            `SELECT
                i.id              AS instructor_id,
                i.rank,
                i.certification_level,
                si.role_title,
                si.is_primary,
                si.joined_at,
                u.first_name,
                u.last_name,
                u.profile_photo_url
             FROM school_instructors si
             INNER JOIN instructors i ON si.instructor_id = i.id AND i.deleted_at IS NULL
             INNER JOIN users       u ON i.user_id         = u.id AND u.deleted_at IS NULL
             WHERE si.school_id = ?
             ORDER BY si.is_primary DESC, u.last_name ASC`,
            [schoolId]
        );
        return rows;
    }

    static async addToRoster(schoolId, instructorId, roleTitle = null, isPrimary = false) {
        await pool.query(
            `INSERT INTO school_instructors (school_id, instructor_id, role_title, is_primary)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role_title = VALUES(role_title), is_primary = VALUES(is_primary)`,
            [schoolId, instructorId, roleTitle || null, isPrimary ? 1 : 0]
        );
    }

    static async removeFromRoster(schoolId, instructorId) {
        await pool.query(
            'DELETE FROM school_instructors WHERE school_id = ? AND instructor_id = ?',
            [schoolId, instructorId]
        );
    }
}

module.exports = School;
