
const pool = require('../modules/pool');

// All queries join roles so callers always get role_name and role_label
// without a second round-trip.
const SELECT_USER = `
    SELECT
        u.id,
        u.role_id,
        u.email,
        u.password_hash,
        u.first_name,
        u.last_name,
        u.phone,
        u.profile_photo_url,
        u.is_email_verified,
        u.is_active,
        u.last_login_at,
        u.created_at,
        r.name  AS role_name,
        r.label AS role_label
    FROM users u
    INNER JOIN roles r ON u.role_id = r.id
`;

class User {
    static async findByEmail(email) {
        const [rows] = await pool.query(
            `${SELECT_USER} WHERE u.email = ? AND u.deleted_at IS NULL LIMIT 1`,
            [email]
        );
        return rows[0] ?? null;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `${SELECT_USER} WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
            [id]
        );
        return rows[0] ?? null;
    }

    static async emailExists(email) {
        const [rows] = await pool.query(
            'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
            [email]
        );
        return rows.length > 0;
    }

    static async create({ roleId, email, passwordHash, firstName, lastName, phone = null }) {
        const [result] = await pool.query(
            `INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [roleId, email, passwordHash, firstName, lastName, phone]
        );
        return result.insertId;
    }

    static async updateLastLogin(id) {
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = ?',
            [id]
        );
    }
}

module.exports = User;
