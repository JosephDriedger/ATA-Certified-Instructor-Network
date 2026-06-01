-- ============================================================
--  ACIN — ATA Certified Instructor Network
--  Complete Database Schema  (single source of truth)
--
--  Engine  : InnoDB
--  Charset : utf8mb4 / utf8mb4_unicode_ci
--
--  Usage
--  ─────
--  Fresh install:
--    mysql -u <user> -p <database> < database/schema.sql
--    mysql -u <user> -p <database> < database/seed.sql   (dev only)
--
--  Reset (drops everything and recreates):
--    mysql -u <user> -p <database> < database/schema.sql
--
--  This file incorporates all migrations.  Do not run the files in
--  database/migrations/ against a database built from this schema —
--  they are kept for historical reference only.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- Drop all tables in safe reverse-dependency order
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS availability;
DROP TABLE IF EXISTS certifications;
DROP TABLE IF EXISTS judge_requests;
DROP TABLE IF EXISTS event_staff;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS instructor_specialties;
DROP TABLE IF EXISTS school_instructors;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS schools;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
--  ROLES
--  Lookup table for the three platform roles.
--  Role ID is a TINYINT — it is stored in every session and
--  checked by roleMiddleware on every request.
-- ============================================================
CREATE TABLE roles (
    id          TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)         NOT NULL,        -- machine key  e.g. 'administrator'
    label       VARCHAR(100)        NOT NULL,        -- display text e.g. 'Administrator'
    description VARCHAR(255)        NOT NULL DEFAULT '',

    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  USERS
--  Central auth record shared by all three roles.
--  Personal name lives here so every role has a display name
--  without an extra profile join.
--  Soft-deleted via deleted_at.
-- ============================================================
CREATE TABLE users (
    id                        INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    role_id                   TINYINT UNSIGNED    NOT NULL,
    email                     VARCHAR(255)        NOT NULL,
    password_hash             VARCHAR(255)        NOT NULL,
    first_name                VARCHAR(100)        NOT NULL,
    last_name                 VARCHAR(100)        NOT NULL,
    phone                     VARCHAR(30)                  DEFAULT NULL,
    profile_photo_url         VARCHAR(500)                 DEFAULT NULL,

    -- Email verification
    is_email_verified         TINYINT(1)          NOT NULL DEFAULT 0,
    email_verify_token        VARCHAR(128)                 DEFAULT NULL,
    email_verify_expires_at   DATETIME                     DEFAULT NULL,

    -- Password reset
    password_reset_token      VARCHAR(128)                 DEFAULT NULL,
    password_reset_expires_at DATETIME                     DEFAULT NULL,

    -- Account state
    is_active                 TINYINT(1)          NOT NULL DEFAULT 1,
    last_login_at             DATETIME                     DEFAULT NULL,

    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME               DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role        (role_id),
    KEY idx_users_active      (is_active),
    KEY idx_users_deleted     (deleted_at),

    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  SCHOOLS
--  Owned by exactly one School Owner user.
--  Slug is a URL-safe unique identifier.
--  Soft-deleted so historical event/instructor references stay intact.
-- ============================================================
CREATE TABLE schools (
    id                   INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    owner_id             INT UNSIGNED    NOT NULL,
    name                 VARCHAR(255)    NOT NULL,
    slug                 VARCHAR(255)    NOT NULL,
    head_instructor_name VARCHAR(200)             DEFAULT NULL,
    description          TEXT                     DEFAULT NULL,
    address              VARCHAR(255)             DEFAULT NULL,
    city                 VARCHAR(100)             DEFAULT NULL,
    state                VARCHAR(100)             DEFAULT NULL,
    country              VARCHAR(100)    NOT NULL DEFAULT 'US',
    postal_code          VARCHAR(20)              DEFAULT NULL,
    phone                VARCHAR(30)              DEFAULT NULL,
    email                VARCHAR(255)             DEFAULT NULL,
    website_url          VARCHAR(500)             DEFAULT NULL,
    logo_url             VARCHAR(500)             DEFAULT NULL,
    is_active            TINYINT(1)      NOT NULL DEFAULT 1,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME           DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_schools_slug      (slug),
    KEY idx_schools_owner           (owner_id),
    KEY idx_schools_location        (country, state, city),
    KEY idx_schools_active_deleted  (is_active, deleted_at),

    CONSTRAINT fk_schools_owner FOREIGN KEY (owner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  INSTRUCTORS
--  Extended profile for users with role = 'instructor'.
--  One row per user (uq_instructors_user enforces this).
--  school_id is the primary affiliation; NULL = independent.
-- ============================================================
CREATE TABLE instructors (
    id                        INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id                   INT UNSIGNED      NOT NULL,
    school_id                 INT UNSIGNED               DEFAULT NULL,
    ata_member_number         VARCHAR(50)                DEFAULT NULL,
    bio                       TEXT                       DEFAULT NULL,
    `rank`                    VARCHAR(100)               DEFAULT NULL,
    certification_level       VARCHAR(100)               DEFAULT NULL,
    years_experience          SMALLINT UNSIGNED          DEFAULT NULL,
    city                      VARCHAR(100)               DEFAULT NULL,
    state                     VARCHAR(100)               DEFAULT NULL,
    country                   VARCHAR(100)      NOT NULL DEFAULT 'US',
    is_public                 TINYINT(1)        NOT NULL DEFAULT 1,
    is_available_for_events   TINYINT(1)        NOT NULL DEFAULT 1,
    is_available_for_testing  TINYINT(1)        NOT NULL DEFAULT 0,
    is_available_for_seminars TINYINT(1)        NOT NULL DEFAULT 0,
    travel_radius_miles       SMALLINT UNSIGNED          DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME           DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_instructors_user             (user_id),
    KEY idx_instructors_school                 (school_id),
    KEY idx_instructors_location               (country, state, city),
    KEY idx_instructors_public                 (is_public),
    KEY idx_instructors_available_events       (is_available_for_events),
    KEY idx_instructors_available_testing      (is_available_for_testing),
    KEY idx_instructors_available_seminars     (is_available_for_seminars),
    KEY idx_instructors_deleted                (deleted_at),

    CONSTRAINT fk_instructors_user   FOREIGN KEY (user_id)   REFERENCES users   (id),
    CONSTRAINT fk_instructors_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  INSTRUCTOR_SPECIALTIES
--  Many specialties per instructor (e.g. "Forms", "Sparring").
-- ============================================================
CREATE TABLE instructor_specialties (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    instructor_id INT UNSIGNED  NOT NULL,
    specialty     VARCHAR(100)  NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_instructor_specialty (instructor_id, specialty),
    KEY        idx_specialty_name      (specialty),

    CONSTRAINT fk_specialties_instructor
        FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  SCHOOL_INSTRUCTORS
--  Roster junction: formal affiliation between schools and instructors.
--  Instructors also self-affiliate via instructors.school_id;
--  this table tracks role titles and the primary flag.
-- ============================================================
CREATE TABLE school_instructors (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    school_id     INT UNSIGNED  NOT NULL,
    instructor_id INT UNSIGNED  NOT NULL,
    role_title    VARCHAR(100)           DEFAULT NULL,  -- e.g. "Head Instructor"
    is_primary    TINYINT(1)    NOT NULL DEFAULT 0,
    joined_at     DATE                   DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_school_instructor (school_id, instructor_id),
    KEY idx_si_school               (school_id),
    KEY idx_si_instructor           (instructor_id),

    CONSTRAINT fk_si_school     FOREIGN KEY (school_id)     REFERENCES schools     (id) ON DELETE CASCADE,
    CONSTRAINT fk_si_instructor FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  EVENTS
--  Created by a School Owner or Administrator.
--  school_id is nullable so admins can create platform-wide events.
--  Lifecycle: draft → published → completed | cancelled
-- ============================================================
CREATE TABLE events (
    id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    school_id             INT UNSIGNED           DEFAULT NULL,
    created_by            INT UNSIGNED  NOT NULL,
    title                 VARCHAR(255)  NOT NULL,
    description           TEXT                   DEFAULT NULL,
    event_type            ENUM('tournament','seminar','belt_testing','camp','other')
                                        NOT NULL DEFAULT 'other',
    location_name         VARCHAR(255)           DEFAULT NULL,
    address               VARCHAR(255)           DEFAULT NULL,
    city                  VARCHAR(100)           DEFAULT NULL,
    state                 VARCHAR(100)           DEFAULT NULL,
    country               VARCHAR(100)  NOT NULL DEFAULT 'US',
    postal_code           VARCHAR(20)            DEFAULT NULL,
    start_datetime        DATETIME      NOT NULL,
    end_datetime          DATETIME      NOT NULL,
    max_participants      SMALLINT UNSIGNED      DEFAULT NULL,
    judges_needed         TINYINT UNSIGNED       DEFAULT NULL,
    required_judge_rank   VARCHAR(100)           DEFAULT NULL,
    registration_deadline DATETIME               DEFAULT NULL,
    is_public             TINYINT(1)    NOT NULL DEFAULT 1,
    status                ENUM('draft','published','completed','cancelled')
                                        NOT NULL DEFAULT 'draft',

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME           DEFAULT NULL,

    PRIMARY KEY (id),
    KEY idx_events_school     (school_id),
    KEY idx_events_created_by (created_by),
    KEY idx_events_start      (start_datetime),
    KEY idx_events_status     (status),
    KEY idx_events_public     (is_public),
    KEY idx_events_deleted    (deleted_at),

    CONSTRAINT fk_events_school     FOREIGN KEY (school_id)  REFERENCES schools (id) ON DELETE SET NULL,
    CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES users   (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  EVENT_STAFF
--  Which instructors are assigned to which events and in what role.
--  An accepted judge_request upserts a row here.
--  No soft-delete — rows cascade when the parent event is deleted.
-- ============================================================
CREATE TABLE event_staff (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    event_id      INT UNSIGNED  NOT NULL,
    instructor_id INT UNSIGNED  NOT NULL,
    staff_role    ENUM('head_judge','judge','ring_official','instructor','staff')
                                NOT NULL DEFAULT 'staff',
    status        ENUM('pending','confirmed','declined','completed')
                                NOT NULL DEFAULT 'pending',
    notes         VARCHAR(255)           DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_event_staff           (event_id, instructor_id),
    KEY idx_event_staff_instructor      (instructor_id),
    KEY idx_event_staff_status          (status),

    CONSTRAINT fk_event_staff_event      FOREIGN KEY (event_id)      REFERENCES events      (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_staff_instructor FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  JUDGE_REQUESTS
--  A School Owner or Administrator requests an Instructor to serve
--  as a guest judge or seminar instructor for an event.
--  Soft-deleted to preserve history and audit trail.
--  On acceptance a row is upserted into event_staff.
-- ============================================================
CREATE TABLE judge_requests (
    id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    requester_id     INT UNSIGNED      NOT NULL,   -- users.id (school owner)
    instructor_id    INT UNSIGNED      NOT NULL,   -- instructors.id
    event_id         INT UNSIGNED               DEFAULT NULL,
    requested_date   DATE              NOT NULL,
    requested_time   TIME                       DEFAULT NULL,
    location_name    VARCHAR(255)               DEFAULT NULL,
    required_rank    VARCHAR(100)               DEFAULT NULL,
    judges_needed    TINYINT UNSIGNED  NOT NULL DEFAULT 1,
    message          TEXT                       DEFAULT NULL,
    status           ENUM('pending','accepted','declined','cancelled','completed')
                                       NOT NULL DEFAULT 'pending',
    response_message TEXT                       DEFAULT NULL,
    responded_at     DATETIME                   DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME           DEFAULT NULL,

    PRIMARY KEY (id),
    KEY idx_judge_requests_requester  (requester_id),
    KEY idx_judge_requests_instructor (instructor_id),
    KEY idx_judge_requests_event      (event_id),
    KEY idx_judge_requests_status     (status),
    KEY idx_judge_requests_date       (requested_date),
    KEY idx_judge_requests_deleted    (deleted_at),

    CONSTRAINT fk_judge_requests_requester  FOREIGN KEY (requester_id)  REFERENCES users       (id),
    CONSTRAINT fk_judge_requests_instructor FOREIGN KEY (instructor_id) REFERENCES instructors (id),
    CONSTRAINT fk_judge_requests_event      FOREIGN KEY (event_id)      REFERENCES events      (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  CERTIFICATIONS
--  ATA credentials belonging to an Instructor.
--  is_verified is set only by an Administrator.
--  verified_by records which admin performed the verification.
--  Soft-deleted to preserve verification history.
-- ============================================================
CREATE TABLE certifications (
    id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    instructor_id        INT UNSIGNED  NOT NULL,
    certification_name   VARCHAR(255)  NOT NULL,
    issuing_organization VARCHAR(255)  NOT NULL DEFAULT 'ATA',
    certification_number VARCHAR(100)           DEFAULT NULL,
    rank_level           VARCHAR(100)           DEFAULT NULL,
    issued_date          DATE                   DEFAULT NULL,
    expiry_date          DATE                   DEFAULT NULL,
    document_url         VARCHAR(500)           DEFAULT NULL,

    is_verified TINYINT(1)   NOT NULL DEFAULT 0,
    verified_by INT UNSIGNED          DEFAULT NULL,   -- users.id (admin)
    verified_at DATETIME              DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME           DEFAULT NULL,

    PRIMARY KEY (id),
    KEY idx_certifications_instructor (instructor_id),
    KEY idx_certifications_verified   (is_verified),
    KEY idx_certifications_expiry     (expiry_date),
    KEY idx_certifications_deleted    (deleted_at),

    CONSTRAINT fk_certifications_instructor  FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE,
    CONSTRAINT fk_certifications_verified_by FOREIGN KEY (verified_by)   REFERENCES users       (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  CONVERSATIONS
--  Container for a direct-message thread between two users.
--  last_message_at is denormalized for fast inbox sorting.
--  reference_type/reference_id links to the triggering context
--  (e.g. a judge_request) so the UI can show it inline.
-- ============================================================
CREATE TABLE conversations (
    id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    subject            VARCHAR(255)  NOT NULL DEFAULT '',
    participant_one_id INT UNSIGNED  NOT NULL,
    participant_two_id INT UNSIGNED  NOT NULL,
    reference_type     VARCHAR(50)            DEFAULT NULL,  -- 'judge_request' | 'event' | NULL
    reference_id       INT UNSIGNED            DEFAULT NULL,
    last_message_at    DATETIME               DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME           DEFAULT NULL,

    PRIMARY KEY (id),
    KEY idx_conversations_p1           (participant_one_id),
    KEY idx_conversations_p2           (participant_two_id),
    KEY idx_conversations_last_message (last_message_at),
    KEY idx_conversations_deleted      (deleted_at),

    CONSTRAINT fk_conversations_p1 FOREIGN KEY (participant_one_id) REFERENCES users (id),
    CONSTRAINT fk_conversations_p2 FOREIGN KEY (participant_two_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  MESSAGES
--  Individual messages within a conversation thread.
--  Per-party soft-delete (sender_deleted / recipient_deleted)
--  lets each side archive independently without losing the other
--  party's copy.  A cron job can purge rows where both are set.
-- ============================================================
CREATE TABLE messages (
    id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    conversation_id   INT UNSIGNED  NOT NULL,
    sender_id         INT UNSIGNED  NOT NULL,
    body              TEXT          NOT NULL,
    is_read           TINYINT(1)    NOT NULL DEFAULT 0,
    read_at           DATETIME               DEFAULT NULL,
    sender_deleted    TINYINT(1)    NOT NULL DEFAULT 0,
    recipient_deleted TINYINT(1)    NOT NULL DEFAULT 0,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_messages_conversation (conversation_id),
    KEY idx_messages_sender       (sender_id),
    KEY idx_messages_unread       (conversation_id, is_read),

    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender       FOREIGN KEY (sender_id)       REFERENCES users         (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  NOTIFICATIONS
--  In-app notification queue.  No soft-delete — rows are read
--  or purged on a schedule (e.g. retain 90 days).
--  reference_type/reference_id is a polymorphic pointer to the
--  triggering object so the UI can deep-link directly to it.
-- ============================================================
CREATE TABLE notifications (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id        INT UNSIGNED  NOT NULL,
    type           VARCHAR(50)   NOT NULL,   -- 'judge_request_received' | 'new_message' | etc.
    title          VARCHAR(255)  NOT NULL,
    body           TEXT                   DEFAULT NULL,
    is_read        TINYINT(1)    NOT NULL DEFAULT 0,
    read_at        DATETIME               DEFAULT NULL,
    reference_type VARCHAR(50)            DEFAULT NULL,  -- 'judge_request' | 'message' | 'event'
    reference_id   INT UNSIGNED           DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_notifications_user    (user_id, is_read),
    KEY idx_notifications_created (created_at),

    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  AVAILABILITY
--  Instructor-managed calendar of available / blocked dates.
--  is_available = 1  →  explicitly available on this date.
--  is_available = 0  →  explicitly blocked.
--  No row           →  falls back to profile-level flags.
--  UNIQUE (instructor_id, available_date): one row per day.
--  Use INSERT … ON DUPLICATE KEY UPDATE (UPSERT) to change a day.
-- ============================================================
CREATE TABLE availability (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    instructor_id  INT UNSIGNED  NOT NULL,
    available_date DATE          NOT NULL,
    start_time     TIME                   DEFAULT NULL,   -- NULL = all-day
    end_time       TIME                   DEFAULT NULL,
    is_available   TINYINT(1)    NOT NULL DEFAULT 1,
    notes          VARCHAR(255)           DEFAULT NULL,

    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_availability  (instructor_id, available_date),
    KEY idx_availability_date   (available_date),

    CONSTRAINT fk_availability_instructor FOREIGN KEY (instructor_id) REFERENCES instructors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
