-- ============================================================
--  Migration 001 — Instructor Profile Extended Fields
--  Run against an existing database that already has the base
--  schema from database/schema.sql.
--  Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- Add new profile columns to instructors
ALTER TABLE instructors
    ADD COLUMN IF NOT EXISTS ata_member_number         VARCHAR(50)     DEFAULT NULL AFTER user_id,
    ADD COLUMN IF NOT EXISTS certification_level       VARCHAR(100)    DEFAULT NULL AFTER rank,
    ADD COLUMN IF NOT EXISTS is_available_for_testing  TINYINT(1)  NOT NULL DEFAULT 0 AFTER is_available_for_events,
    ADD COLUMN IF NOT EXISTS is_available_for_seminars TINYINT(1)  NOT NULL DEFAULT 0 AFTER is_available_for_testing;

-- Specialties lookup (many per instructor)
CREATE TABLE IF NOT EXISTS instructor_specialties (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    instructor_id INT UNSIGNED    NOT NULL,
    specialty     VARCHAR(100)    NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_instructor_specialty (instructor_id, specialty),
    KEY        idx_specialty_name      (specialty),

    CONSTRAINT fk_specialties_instructor
        FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
