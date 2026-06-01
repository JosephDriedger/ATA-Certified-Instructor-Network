
// ── Privilege levels ──────────────────────────────────────────────────────────
// Roles are privilege levels, not separate buckets.
// A higher roleId includes all capabilities of lower levels:
//
//   INSTRUCTOR (1)    → profile, availability, receive judge requests, messages
//   SCHOOL_OWNER (2)  → everything above + school, post events, send requests
//   ADMINISTRATOR (3) → everything above + user management, cert verification
//
// Use requireMinRole(Roles.X) in route guards — it passes for X and above.
// IDs must match the `roles` table in database/seed.sql.

const Roles = {
    INSTRUCTOR:    1,
    SCHOOL_OWNER:  2,
    ADMINISTRATOR: 3
};

const RoleLabels = {
    1: 'Instructor',
    2: 'School Owner',
    3: 'Administrator'
};

// Roles available on the self-registration form.
// Administrators are created via seed data or CLI only.
const SELF_REGISTER_ROLES = [Roles.SCHOOL_OWNER, Roles.INSTRUCTOR];

module.exports = { Roles, RoleLabels, SELF_REGISTER_ROLES };
