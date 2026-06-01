
const pool = require('../modules/pool');

class Message {

    // ── Read ──────────────────────────────────────────────────────────────────

    // Returns all messages in a thread that are visible to the given user:
    //   • Messages the user sent and hasn't deleted (sender_deleted = 0)
    //   • Messages the user received and hasn't deleted (recipient_deleted = 0)
    static async getThread(conversationId, userId) {
        const [rows] = await pool.query(
            `SELECT
                m.id,
                m.sender_id,
                m.body,
                m.is_read,
                m.read_at,
                m.created_at,
                u.first_name        AS sender_first_name,
                u.last_name         AS sender_last_name,
                u.profile_photo_url AS sender_photo
             FROM messages m
             INNER JOIN users u ON m.sender_id = u.id AND u.deleted_at IS NULL
             WHERE m.conversation_id = ?
               AND (
                   (m.sender_id  = ? AND m.sender_deleted    = 0)
                   OR
                   (m.sender_id != ? AND m.recipient_deleted = 0)
               )
             ORDER BY m.created_at ASC`,
            [conversationId, userId, userId]
        );
        return rows;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    // Inserts a message and updates the conversation's last_message_at in one
    // transaction so the inbox sort is always consistent.
    static async send({ conversationId, senderId, body }) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.query(
                'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
                [conversationId, senderId, body]
            );

            await conn.query(
                'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
                [conversationId]
            );

            await conn.commit();
            return result.insertId;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    // Mark all messages received by userId in this conversation as read.
    static async markThreadRead(conversationId, userId) {
        await pool.query(
            `UPDATE messages
             SET is_read = 1, read_at = NOW()
             WHERE conversation_id  = ?
               AND sender_id        != ?
               AND is_read           = 0
               AND recipient_deleted = 0`,
            [conversationId, userId]
        );
    }

    // Per-party soft delete: each user can independently remove a message
    // from their view.  The message only disappears from the DB when both
    // sender_deleted and recipient_deleted are set (handled by a cron job).
    static async softDeleteForUser(messageId, userId) {
        // Determine whether this user is the sender or recipient
        const [[msg]] = await pool.query(
            'SELECT sender_id FROM messages WHERE id = ? LIMIT 1',
            [messageId]
        );
        if (!msg) return;

        if (msg.sender_id === userId) {
            await pool.query(
                'UPDATE messages SET sender_deleted = 1 WHERE id = ?',
                [messageId]
            );
        } else {
            await pool.query(
                'UPDATE messages SET recipient_deleted = 1 WHERE id = ?',
                [messageId]
            );
        }
    }
}

module.exports = Message;
