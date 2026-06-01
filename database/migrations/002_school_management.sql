-- ============================================================
--  Migration 002 — School Management
--  Run against an existing database after 001_instructor_profile.sql.
--  Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- Add head instructor display name to schools
ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS head_instructor_name VARCHAR(200) DEFAULT NULL AFTER name;

-- ── school_instructors ────────────────────────────────────────────────────
-- Junction: which instructors are formally affiliated with a school.
-- Instructors self-affiliate by setting their school_id; this table tracks
-- the formal roster with role titles and primary flag.
CREATE TABLE IF NOT EXISTS school_instructors (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    school_id       INT UNSIGNED    NOT NULL,
    instructor_id   INT UNSIGNED    NOT NULL,
    role_title      VARCHAR(100)             DEFAULT NULL,   -- e.g. "Head Instructor"
    is_primary      TINYINT(1)      NOT NULL DEFAULT 0,
    joined_at       DATE                     DEFAULT NULL,

    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_school_instructor          (school_id, instructor_id),
    KEY        idx_si_school                 (school_id),
    KEY        idx_si_instructor             (instructor_id),

    CONSTRAINT fk_si_school     FOREIGN KEY (school_id)     REFERENCES schools     (id) ON DELETE CASCADE,
    CONSTRAINT fk_si_instructor FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
