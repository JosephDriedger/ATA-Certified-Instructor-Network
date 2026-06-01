
const pool = require('../modules/pool');

// All queries run in parallel via Promise.all so the dashboard renders in a
// single round-trip time regardless of how many queries are involved.
class AdminStats {

    static async getSummary() {
        const [
            [userRows],
            [eventRows],
            [schoolRows],
            [certRows],
            [reqRows],
            [recentUserRows],
            [recentEventRows],
            [roleBreakRows]
        ] = await Promise.all([

            // ── User totals ────────────────────────────────────────────────
            pool.query(`
                SELECT
                    COUNT(*)                                                           AS total,
                    SUM(CASE WHEN is_active   = 1 THEN 1 ELSE 0 END)                  AS active,
                    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                              THEN 1 ELSE 0 END)                                       AS new_30d
                FROM users WHERE deleted_at IS NULL
            `),

            // ── Event totals ───────────────────────────────────────────────
            pool.query(`
                SELECT
                    COUNT(*)                                                           AS total,
                    SUM(CASE WHEN status = 'published'
                              AND start_datetime >= NOW() THEN 1 ELSE 0 END)           AS upcoming,
                    SUM(CASE WHEN status = 'published'  THEN 1 ELSE 0 END)             AS published,
                    SUM(CASE WHEN status = 'draft'      THEN 1 ELSE 0 END)             AS drafts,
                    SUM(CASE WHEN status = 'completed'  THEN 1 ELSE 0 END)             AS completed,
                    SUM(CASE WHEN status = 'cancelled'  THEN 1 ELSE 0 END)             AS cancelled
                FROM events WHERE deleted_at IS NULL
            `),

            // ── School totals ──────────────────────────────────────────────
            pool.query(`
                SELECT
                    COUNT(*)                                                           AS total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)                    AS active
                FROM schools WHERE deleted_at IS NULL
            `),

            // ── Pending certifications needing review ──────────────────────
            pool.query(`
                SELECT COUNT(*) AS count
                FROM certifications
                WHERE is_verified = 0 AND deleted_at IS NULL
            `),

            // ── Open (pending) judge requests ──────────────────────────────
            pool.query(`
                SELECT COUNT(*) AS count
                FROM judge_requests
                WHERE status = 'pending' AND deleted_at IS NULL
            `),

            // ── 8 most recently registered users ──────────────────────────
            pool.query(`
                SELECT u.id, u.first_name, u.last_name, u.email,
                       u.is_active, u.created_at,
                       r.label AS role_label,
                       r.name  AS role_name
                FROM users u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE u.deleted_at IS NULL
                ORDER BY u.created_at DESC
                LIMIT 8
            `),

            // ── 8 most recently created events ────────────────────────────
            pool.query(`
                SELECT e.id, e.title, e.event_type, e.status,
                       e.start_datetime, e.created_at,
                       s.name AS school_name
                FROM events e
                LEFT JOIN schools s ON e.school_id = s.id AND s.deleted_at IS NULL
                WHERE e.deleted_at IS NULL
                ORDER BY e.created_at DESC
                LIMIT 8
            `),

            // ── User count per role ────────────────────────────────────────
            pool.query(`
                SELECT r.label, r.name, COUNT(u.id) AS count
                FROM roles r
                LEFT JOIN users u
                       ON u.role_id    = r.id
                      AND u.deleted_at IS NULL
                      AND u.is_active  = 1
                GROUP BY r.id, r.label, r.name
                ORDER BY r.id
            `)
        ]);

        // Build a { roleName: count } map for easy access in the view
        const byRole = {};
        roleBreakRows.forEach(r => { byRole[r.name] = r.count; });

        return {
            users: {
                ...userRows[0],
                byRole
            },
            events:         eventRows[0],
            schools:        schoolRows[0],
            pendingCerts:   certRows[0].count,
            pendingRequests: reqRows[0].count,
            recentUsers:    recentUserRows,
            recentEvents:   recentEventRows
        };
    }
}

module.exports = AdminStats;
