
const pool = require('../modules/pool');

class Conversation {

    // ── Inbox ─────────────────────────────────────────────────────────────────
    // Returns all conversations for a user, newest first.
    // Computes "other" participant and unread count in a single query.
    static async findByUser(userId, { page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM conversations c
             WHERE (c.participant_one_id = ? OR c.participant_two_id = ?)
               AND c.deleted_at IS NULL`,
            [userId, userId]
        );

        const [rows] = await pool.query(
            `SELECT
                c.id,
                c.subject,
                c.reference_type,
                c.reference_id,
                c.last_message_at,
                c.created_at,
                -- "Other" participant (not the current viewer)
                CASE WHEN c.participant_one_id = ? THEN p2.id               ELSE p1.id               END AS other_id,
                CASE WHEN c.participant_one_id = ? THEN p2.first_name        ELSE p1.first_name        END AS other_first_name,
                CASE WHEN c.participant_one_id = ? THEN p2.last_name         ELSE p1.last_name         END AS other_last_name,
                CASE WHEN c.participant_one_id = ? THEN p2.profile_photo_url ELSE p1.profile_photo_url END AS other_photo,
                -- Last visible message preview (100 chars)
                lm.sender_id         AS last_sender_id,
                LEFT(lm.body, 100)   AS last_preview,
                lm.created_at        AS last_message_time,
                -- Unread count: messages sent by the OTHER party, not yet read, not deleted by me
                (
                    SELECT COUNT(*) FROM messages m
                    WHERE m.conversation_id  = c.id
                      AND m.sender_id        != ?
                      AND m.is_read          = 0
                      AND m.recipient_deleted = 0
                ) AS unread_count
             FROM conversations c
             INNER JOIN users p1 ON c.participant_one_id = p1.id AND p1.deleted_at IS NULL
             INNER JOIN users p2 ON c.participant_two_id = p2.id AND p2.deleted_at IS NULL
             LEFT JOIN messages lm ON lm.id = (
                 SELECT id FROM messages
                 WHERE conversation_id  = c.id
                   AND sender_deleted    = 0
                   AND recipient_deleted = 0
                 ORDER BY created_at DESC
                 LIMIT 1
             )
             WHERE (c.participant_one_id = ? OR c.participant_two_id = ?)
               AND c.deleted_at IS NULL
             ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
             LIMIT ? OFFSET ?`,
            // userId repeated: 4× CASE, 1× unread subquery, 2× WHERE
            [userId, userId, userId, userId, userId, userId, userId, limit, offset]
        );

        return { conversations: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── Single conversation ───────────────────────────────────────────────────
    // Optionally computes "other_*" fields when viewerId is provided.
    static async findById(id, viewerId = null) {
        const [rows] = await pool.query(
            `SELECT
                c.id,
                c.subject,
                c.reference_type,
                c.reference_id,
                c.participant_one_id,
                c.participant_two_id,
                c.last_message_at,
                c.created_at,
                p1.first_name        AS p1_first_name,
                p1.last_name         AS p1_last_name,
                p1.profile_photo_url AS p1_photo,
                p2.first_name        AS p2_first_name,
                p2.last_name         AS p2_last_name,
                p2.profile_photo_url AS p2_photo
             FROM conversations c
             INNER JOIN users p1 ON c.participant_one_id = p1.id AND p1.deleted_at IS NULL
             INNER JOIN users p2 ON c.participant_two_id = p2.id AND p2.deleted_at IS NULL
             WHERE c.id = ? AND c.deleted_at IS NULL
             LIMIT 1`,
            [id]
        );

        if (!rows[0]) return null;
        const c = rows[0];

        if (viewerId !== null) {
            const isP1 = c.participant_one_id === viewerId;
            c.other_id    = isP1 ? c.participant_two_id : c.participant_one_id;
            c.other_first = isP1 ? c.p2_first_name : c.p1_first_name;
            c.other_last  = isP1 ? c.p2_last_name  : c.p1_last_name;
            c.other_photo = isP1 ? c.p2_photo       : c.p1_photo;
        }

        return c;
    }

    // ── Existence checks ──────────────────────────────────────────────────────

    // Returns the conversation ID if one already exists between two users,
    // null otherwise.  Order of IDs doesn't matter.
    static async findBetween(userId1, userId2) {
        const [rows] = await pool.query(
            `SELECT id FROM conversations
             WHERE deleted_at IS NULL AND (
                 (participant_one_id = ? AND participant_two_id = ?)
                 OR
                 (participant_one_id = ? AND participant_two_id = ?)
             )
             LIMIT 1`,
            [userId1, userId2, userId2, userId1]
        );
        return rows[0]?.id ?? null;
    }

    static async isParticipant(conversationId, userId) {
        const [rows] = await pool.query(
            `SELECT id FROM conversations
             WHERE id = ? AND deleted_at IS NULL
               AND (participant_one_id = ? OR participant_two_id = ?)
             LIMIT 1`,
            [conversationId, userId, userId]
        );
        return rows.length > 0;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    static async create({ participantOneId, participantTwoId, subject = '', referenceType = null, referenceId = null }) {
        const [result] = await pool.query(
            `INSERT INTO conversations
                (participant_one_id, participant_two_id, subject, reference_type, reference_id)
             VALUES (?, ?, ?, ?, ?)`,
            [participantOneId, participantTwoId, subject || '', referenceType || null, referenceId || null]
        );
        return result.insertId;
    }

    // ── Unread count (for navbar badge) ───────────────────────────────────────
    // Returns the number of CONVERSATIONS that have at least one unread message
    // for this user — not the total message count.
    static async getUnreadCount(userId) {
        const [[{ count }]] = await pool.query(
            `SELECT COUNT(DISTINCT m.conversation_id) AS count
             FROM messages m
             INNER JOIN conversations c
                     ON m.conversation_id = c.id
                    AND c.deleted_at IS NULL
                    AND (c.participant_one_id = ? OR c.participant_two_id = ?)
             WHERE m.sender_id         != ?
               AND m.is_read            = 0
               AND m.recipient_deleted  = 0`,
            [userId, userId, userId]
        );
        return count;
    }
}

module.exports = Conversation;
