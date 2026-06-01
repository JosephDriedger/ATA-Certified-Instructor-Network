
const pool = require('../modules/pool');

class Notification {

    static async create({ userId, type, title, body = null, referenceType = null, referenceId = null }) {
        const [result] = await pool.query(
            `INSERT INTO notifications
                (user_id, type, title, body, reference_type, reference_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, type, title, body, referenceType, referenceId]
        );
        return result.insertId;
    }

    static async getByUser(userId, { page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query(
            'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?',
            [userId]
        );
        const [rows] = await pool.query(
            `SELECT id, type, title, body, is_read, read_at,
                    reference_type, reference_id, created_at
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return { notifications: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    static async getUnreadCount(userId) {
        const [[{ count }]] = await pool.query(
            'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        return count;
    }

    static async markRead(id, userId) {
        await pool.query(
            `UPDATE notifications
             SET is_read = 1, read_at = NOW()
             WHERE id = ? AND user_id = ? AND is_read = 0`,
            [id, userId]
        );
    }

    static async markAllRead(userId) {
        await pool.query(
            `UPDATE notifications SET is_read = 1, read_at = NOW()
             WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
    }
}

module.exports = Notification;
