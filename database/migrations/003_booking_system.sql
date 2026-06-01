-- ============================================================
--  Migration 003 — Guest Judge Booking System
--  Extends judge_requests with time, location, rank requirement,
--  and judge count. No new tables — notifications already exists.
--  Safe to re-run: IF NOT EXISTS / IF EXISTS guards on every change.
-- ============================================================

ALTER TABLE judge_requests
    ADD COLUMN IF NOT EXISTS requested_time TIME           DEFAULT NULL
        COMMENT 'Specific start time required for the judging role'
        AFTER requested_date,

    ADD COLUMN IF NOT EXISTS location_name  VARCHAR(255)   DEFAULT NULL
        COMMENT 'Venue/location override when not linked to an event'
        AFTER requested_time,

    ADD COLUMN IF NOT EXISTS required_rank  VARCHAR(100)   DEFAULT NULL
        COMMENT 'Minimum ATA rank the instructor must hold'
        AFTER location_name,

    ADD COLUMN IF NOT EXISTS judges_needed  TINYINT UNSIGNED NOT NULL DEFAULT 1
        COMMENT 'Total number of judges needed at this event (informational)'
        AFTER required_rank;
