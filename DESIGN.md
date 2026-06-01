# ATA Certified Instructor Network (ACIN) — Software Design Document

**Version:** 1.0  
**Date:** 2026-05-31  
**Author:** Joseph Driedger  
**Stack:** Node.js · Express · EJS · MySQL · Bootstrap 5

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Feature Breakdown](#4-feature-breakdown)
5. [Database Schema](#5-database-schema)
6. [MVC Folder Structure](#6-mvc-folder-structure)
7. [Route Map](#7-route-map)
8. [Development Roadmap](#8-development-roadmap)

---

## 1. Executive Summary

ACIN is a web platform that connects American Taekwondo Association (ATA) certified instructors, martial arts schools, and event organizers. It provides a centralized hub where instructors can publish verified profiles and availability calendars, schools can manage their roster and post events, and event organizers can discover and book qualified guest judges or seminar instructors.

### Core Value Propositions

| Stakeholder | Value |
|---|---|
| Instructor | Verified public profile, booking management, availability control |
| School | Staff directory, event publishing, networking with other schools |
| Event Organizer | Searchable instructor pool, structured booking workflow |
| Platform Admin | Trust through verified credentials, moderated content |

---

## 2. System Architecture

### 2.1 High-Level Overview

```
┌────────────────────────────────────────────────────────┐
│                      Client (Browser)                  │
│             Bootstrap 5 + Vanilla JS + EJS             │
└────────────────────────┬───────────────────────────────┘
                         │ HTTP / HTTPS
┌────────────────────────▼───────────────────────────────┐
│                   Express.js Server                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Routes  │→ │ Controllers  │→ │     Models       │ │
│  └──────────┘  └──────────────┘  └────────┬─────────┘ │
│  ┌──────────────────────────────┐          │           │
│  │         Middleware           │          │           │
│  │  Auth · Role · Validation    │          │           │
│  │  Rate-limit · Session        │          │           │
│  └──────────────────────────────┘          │           │
└────────────────────────────────────────────┼───────────┘
                                             │
┌────────────────────────────────────────────▼───────────┐
│                     MySQL Database                     │
│            Connection Pool (mysql2/promise)            │
└────────────────────────────────────────────────────────┘
```

### 2.2 Request Lifecycle

```
Browser Request
  → Express Router (matches URL + HTTP method)
  → Middleware Stack (session check → role check → input validation)
  → Controller (orchestrates logic, calls Model methods)
  → Model (executes parameterized SQL query from /queries directory)
  → Controller (formats data, handles errors)
  → EJS View (renders HTML with layout.ejs wrapper)
  → Browser Response
```

### 2.3 Session Strategy

- **Library:** `express-session` + `connect-mysql2` session store
- Sessions are stored server-side in the `sessions` table
- Session cookie is `HttpOnly`, `Secure` (in production), `SameSite=Strict`
- Session payload carries: `userId`, `roleId`, `displayName`
- Session is destroyed on logout and expired sessions are purged via cron

### 2.4 Security Layers

| Layer | Mechanism |
|---|---|
| Authentication | bcrypt password hashing, server-side sessions |
| Authorization | Role middleware on every protected route |
| Input | Server-side validation + parameterized SQL (no raw interpolation) |
| Rate Limiting | existing `rate-limit.js` module on auth and booking routes |
| CORS | existing origin allowlist in `server.js` |
| CSRF | `csurf` token on all state-changing forms |

---

## 3. User Roles & Permissions

### 3.1 Role Definitions

| Role ID | Name | Description |
|---|---|---|
| 0 | Guest | Unauthenticated visitor. Read-only access to public profiles and events. |
| 1 | Instructor | Registered ATA instructor. Manages own profile, availability, bookings. |
| 2 | School Admin | Manages a school profile. Posts events. Requests guest judges. |
| 3 | Event Organizer | Not affiliated with a school. Creates events, requests instructors. |
| 4 | Platform Admin | Full access. Verifies accounts, moderates content, manages all data. |

### 3.2 Permission Matrix

| Feature | Guest | Instructor | School Admin | Organizer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Browse public profiles | ✓ | ✓ | ✓ | ✓ | ✓ |
| Browse public events | ✓ | ✓ | ✓ | ✓ | ✓ |
| Register / Login | ✓ | — | — | — | — |
| Manage own instructor profile | — | ✓ | — | — | ✓ |
| Manage own school profile | — | — | ✓ | — | ✓ |
| Set availability calendar | — | ✓ | — | — | ✓ |
| Create events | — | — | ✓ | ✓ | ✓ |
| Send booking request | — | — | ✓ | ✓ | ✓ |
| Accept / decline booking | — | ✓ | — | — | ✓ |
| Send direct messages | — | ✓ | ✓ | ✓ | ✓ |
| Verify instructor credentials | — | — | — | — | ✓ |
| Deactivate any account | — | — | — | — | ✓ |

---

## 4. Feature Breakdown

### 4.1 Authentication

- **Register:** Email + password (hashed), role selection (Instructor / School Admin / Organizer), email verification link
- **Login:** Credential check, session creation, redirect by role to dashboard
- **Logout:** Session destruction, redirect to home
- **Forgot Password:** Time-limited reset token sent to email
- **Email Verification:** Token link sent on register; account locked until verified

### 4.2 Instructor Profiles

- **Profile Fields:** Name, rank (belt level), ATA certification number, certification expiry date, bio, specialties (multi-select), profile photo, city/state/country, phone, website URL
- **Visibility:** Instructor toggles profile between public and private
- **Verification Badge:** Admin marks certification as verified; badge appears on public profile
- **Profile Card:** Compact display used in search results and school rosters

### 4.3 School Profiles

- **Profile Fields:** School name, description, address, city/state/country, phone, email, website, logo
- **Instructor Roster:** School admin links/unlinks instructors; designates a head instructor
- **Programs:** Tags for offered programs (e.g., Little Ninjas, Adult, Leadership)
- **Public Page:** Lists school info, roster, and upcoming events

### 4.4 Event Management

- **Event Types:** Tournament, Seminar, Belt Testing, Camp, Other
- **Fields:** Title, description, type, start/end datetime, location, max participants, public/private toggle
- **Status Lifecycle:** `draft` → `published` → `completed` / `cancelled`
- **Event Registration:** Users can register interest; organizer sees attendee list
- **Event Calendar:** Monthly calendar view filterable by type, location, school

### 4.5 Guest Judge Booking System

- **Discovery:** Organizer searches instructors by rank, specialty, location, availability
- **Request:** Organizer sends booking request with event reference, date, and message
- **Notification:** Instructor receives in-app and optional email notification
- **Response Flow:** Instructor accepts or declines with optional response message
- **Status Lifecycle:** `pending` → `accepted` / `declined` / `cancelled` / `completed`
- **History:** Both parties see full booking history on their dashboards

### 4.6 Availability Calendar

- **Instructor sets:** Available date ranges (or individual dates), optionally with a time window
- **Blocked dates:** Instructor can block out unavailable dates
- **Read access:** Organizers and school admins see availability when viewing a profile or composing a booking request
- **Conflict check:** System warns if a booking request date overlaps an unavailable period

### 4.7 Messaging System

- **Threads:** Conversations are threaded (reply-to parent message)
- **Inbox / Sent / Archived:** Three views per user
- **Unread count:** Shown in navbar badge
- **Permissions:** Users can only message after at least one party has a completed or pending booking, OR is affiliated with the same school (prevents cold spam)

### 4.8 Notifications

- **Triggers:** New booking request, booking status change, new message, account verified, event reminder
- **In-App:** Bell icon in navbar with dropdown; notification center page
- **Email:** Optional per-user setting for each notification type
- **Mark Read:** Individual or mark-all-read actions

---

## 5. Database Schema

### 5.1 Entity Relationship Overview

```
users ──< instructor_profiles ──< instructor_specialties
     │                        ──< availability
     │                        ──< booking_requests (as instructor)
     │
     ├──< school_profiles ──< school_instructors >── instructor_profiles
     │                    ──< events
     │
     ├──< booking_requests (as requester)
     ├──< event_registrations
     ├──< messages (sender / recipient)
     ├──< notifications
     └──< sessions

roles ──< users
event_types ──< events
```

### 5.2 DDL — Full Schema

```sql
-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
    id          TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)         NOT NULL UNIQUE,
    description VARCHAR(255)        NOT NULL DEFAULT '',
    PRIMARY KEY (id)
);

INSERT INTO roles (name, description) VALUES
    ('guest',      'Unauthenticated visitor'),
    ('instructor', 'ATA certified instructor'),
    ('school',     'School administrator'),
    ('organizer',  'Independent event organizer'),
    ('admin',      'Platform administrator');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id                  INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    email               VARCHAR(255)        NOT NULL UNIQUE,
    password_hash       VARCHAR(255)        NOT NULL,
    role_id             TINYINT UNSIGNED    NOT NULL DEFAULT 1,
    is_verified         TINYINT(1)          NOT NULL DEFAULT 0,
    is_active           TINYINT(1)          NOT NULL DEFAULT 1,
    verify_token        VARCHAR(128)                 DEFAULT NULL,
    verify_token_expiry DATETIME                     DEFAULT NULL,
    reset_token         VARCHAR(128)                 DEFAULT NULL,
    reset_token_expiry  DATETIME                     DEFAULT NULL,
    created_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (role_id) REFERENCES roles (id)
);

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE sessions (
    session_id  VARCHAR(128)    NOT NULL,
    user_id     INT UNSIGNED            DEFAULT NULL,
    expires     INT UNSIGNED    NOT NULL,
    data        TEXT                    DEFAULT NULL,
    PRIMARY KEY (session_id),
    INDEX idx_sessions_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================
-- INSTRUCTOR PROFILES
-- ============================================================
CREATE TABLE instructor_profiles (
    id                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id               INT UNSIGNED    NOT NULL UNIQUE,
    first_name            VARCHAR(100)    NOT NULL,
    last_name             VARCHAR(100)    NOT NULL,
    rank                  VARCHAR(100)             DEFAULT NULL,  -- e.g. "4th Degree Black Belt"
    certification_number  VARCHAR(100)             DEFAULT NULL,
    certification_expiry  DATE                     DEFAULT NULL,
    is_credential_verified TINYINT(1)     NOT NULL DEFAULT 0,
    bio                   TEXT                     DEFAULT NULL,
    profile_photo_url     VARCHAR(500)             DEFAULT NULL,
    is_public             TINYINT(1)      NOT NULL DEFAULT 1,
    city                  VARCHAR(100)             DEFAULT NULL,
    state                 VARCHAR(100)             DEFAULT NULL,
    country               VARCHAR(100)             DEFAULT NULL,
    phone                 VARCHAR(30)              DEFAULT NULL,
    website_url           VARCHAR(500)             DEFAULT NULL,
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_instructor_public (is_public),
    INDEX idx_instructor_location (country, state, city)
);

-- ============================================================
-- INSTRUCTOR SPECIALTIES  (many per instructor)
-- ============================================================
CREATE TABLE instructor_specialties (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    instructor_id INT UNSIGNED    NOT NULL,
    specialty     VARCHAR(100)    NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (instructor_id) REFERENCES instructor_profiles (id) ON DELETE CASCADE,
    UNIQUE KEY uq_instructor_specialty (instructor_id, specialty)
);

-- ============================================================
-- SCHOOL PROFILES
-- ============================================================
CREATE TABLE school_profiles (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED    NOT NULL UNIQUE,
    name        VARCHAR(255)    NOT NULL,
    description TEXT                     DEFAULT NULL,
    address     VARCHAR(255)             DEFAULT NULL,
    city        VARCHAR(100)             DEFAULT NULL,
    state       VARCHAR(100)             DEFAULT NULL,
    country     VARCHAR(100)             DEFAULT NULL,
    phone       VARCHAR(30)              DEFAULT NULL,
    email       VARCHAR(255)             DEFAULT NULL,
    website_url VARCHAR(500)             DEFAULT NULL,
    logo_url    VARCHAR(500)             DEFAULT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_school_location (country, state, city)
);

-- ============================================================
-- SCHOOL PROGRAMS  (tags per school, e.g. "Little Ninjas")
-- ============================================================
CREATE TABLE school_programs (
    id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    school_id  INT UNSIGNED    NOT NULL,
    program    VARCHAR(100)    NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (school_id) REFERENCES school_profiles (id) ON DELETE CASCADE,
    UNIQUE KEY uq_school_program (school_id, program)
);

-- ============================================================
-- SCHOOL ↔ INSTRUCTOR ROSTER  (many-to-many)
-- ============================================================
CREATE TABLE school_instructors (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    school_id     INT UNSIGNED    NOT NULL,
    instructor_id INT UNSIGNED    NOT NULL,
    role_title    VARCHAR(100)             DEFAULT NULL,  -- e.g. "Head Instructor"
    is_primary    TINYINT(1)      NOT NULL DEFAULT 0,
    joined_at     DATE                     DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_school_instructor (school_id, instructor_id),
    FOREIGN KEY (school_id)     REFERENCES school_profiles (id)     ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES instructor_profiles (id) ON DELETE CASCADE
);

-- ============================================================
-- EVENT TYPES
-- ============================================================
CREATE TABLE event_types (
    id   TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name VARCHAR(100)        NOT NULL UNIQUE,
    PRIMARY KEY (id)
);

INSERT INTO event_types (name) VALUES
    ('Tournament'), ('Seminar'), ('Belt Testing'), ('Camp'), ('Other');

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
    id               INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    organizer_id     INT UNSIGNED        NOT NULL,
    school_id        INT UNSIGNED                 DEFAULT NULL,
    event_type_id    TINYINT UNSIGNED    NOT NULL,
    title            VARCHAR(255)        NOT NULL,
    description      TEXT                         DEFAULT NULL,
    location_name    VARCHAR(255)                 DEFAULT NULL,
    address          VARCHAR(255)                 DEFAULT NULL,
    city             VARCHAR(100)                 DEFAULT NULL,
    state            VARCHAR(100)                 DEFAULT NULL,
    country          VARCHAR(100)                 DEFAULT NULL,
    start_datetime   DATETIME            NOT NULL,
    end_datetime     DATETIME            NOT NULL,
    max_participants SMALLINT UNSIGNED            DEFAULT NULL,
    is_public        TINYINT(1)          NOT NULL DEFAULT 1,
    status           ENUM('draft','published','completed','cancelled') NOT NULL DEFAULT 'draft',
    created_at       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (organizer_id)  REFERENCES users (id)         ON DELETE CASCADE,
    FOREIGN KEY (school_id)     REFERENCES school_profiles (id) ON DELETE SET NULL,
    FOREIGN KEY (event_type_id) REFERENCES event_types (id),
    INDEX idx_events_start (start_datetime),
    INDEX idx_events_status (status),
    INDEX idx_events_public (is_public)
);

-- ============================================================
-- EVENT REGISTRATIONS
-- ============================================================
CREATE TABLE event_registrations (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    event_id      INT UNSIGNED    NOT NULL,
    user_id       INT UNSIGNED    NOT NULL,
    status        ENUM('registered','waitlisted','cancelled') NOT NULL DEFAULT 'registered',
    registered_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_user (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE
);

-- ============================================================
-- AVAILABILITY  (instructor sets available / unavailable blocks)
-- ============================================================
CREATE TABLE availability (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    instructor_id INT UNSIGNED    NOT NULL,
    date          DATE            NOT NULL,
    start_time    TIME                     DEFAULT NULL,
    end_time      TIME                     DEFAULT NULL,
    is_available  TINYINT(1)      NOT NULL DEFAULT 1,
    notes         VARCHAR(255)             DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (instructor_id) REFERENCES instructor_profiles (id) ON DELETE CASCADE,
    UNIQUE KEY uq_availability_date (instructor_id, date),
    INDEX idx_availability_date (date)
);

-- ============================================================
-- BOOKING REQUESTS
-- ============================================================
CREATE TABLE booking_requests (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    requester_id     INT UNSIGNED    NOT NULL,
    instructor_id    INT UNSIGNED    NOT NULL,
    event_id         INT UNSIGNED             DEFAULT NULL,
    requested_date   DATE            NOT NULL,
    message          TEXT                     DEFAULT NULL,
    status           ENUM('pending','accepted','declined','cancelled','completed') NOT NULL DEFAULT 'pending',
    response_message TEXT                     DEFAULT NULL,
    responded_at     DATETIME                 DEFAULT NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (requester_id)  REFERENCES users (id)               ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES instructor_profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (event_id)      REFERENCES events (id)              ON DELETE SET NULL,
    INDEX idx_booking_instructor (instructor_id),
    INDEX idx_booking_status (status)
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    sender_id        INT UNSIGNED    NOT NULL,
    recipient_id     INT UNSIGNED    NOT NULL,
    subject          VARCHAR(255)    NOT NULL DEFAULT '',
    body             TEXT            NOT NULL,
    is_read          TINYINT(1)      NOT NULL DEFAULT 0,
    parent_id        INT UNSIGNED             DEFAULT NULL,
    sender_deleted   TINYINT(1)      NOT NULL DEFAULT 0,
    recipient_deleted TINYINT(1)     NOT NULL DEFAULT 0,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (sender_id)    REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id)    REFERENCES messages (id) ON DELETE SET NULL,
    INDEX idx_messages_recipient (recipient_id, is_read),
    INDEX idx_messages_sender (sender_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id        INT UNSIGNED    NOT NULL,
    type           VARCHAR(50)     NOT NULL,  -- 'booking_request', 'booking_accepted', 'new_message', etc.
    title          VARCHAR(255)    NOT NULL,
    body           TEXT                     DEFAULT NULL,
    is_read        TINYINT(1)      NOT NULL DEFAULT 0,
    reference_type VARCHAR(50)              DEFAULT NULL,  -- 'booking', 'message', 'event'
    reference_id   INT UNSIGNED             DEFAULT NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id, is_read)
);
```

---

## 6. MVC Folder Structure

```
D:\ATA-Certified-Instructor-Network\
├── package.json
├── .env
├── .env.example
├── DESIGN.md
│
└── src/
    ├── index.js                        ← Entry point
    ├── server.js                       ← Express app bootstrap (singleton)
    │
    ├── constants/
    │   ├── pagePaths.js                ← EJS view path strings
    │   ├── statusCodes.js              ← HTTP status code constants
    │   ├── roles.js                    ← Role ID constants (GUEST=0, INSTRUCTOR=1 …)
    │   └── bookingStatuses.js          ← Booking lifecycle constants
    │
    ├── controllers/
    │   ├── authController.js           ← register, login, logout, verify, resetPassword
    │   ├── dashboardController.js      ← Role-specific dashboard views
    │   ├── instructorController.js     ← Profile CRUD, specialties, public profile
    │   ├── schoolController.js         ← School CRUD, roster management, programs
    │   ├── eventController.js          ← Event CRUD, registrations, calendar data
    │   ├── bookingController.js        ← Send request, accept/decline, history
    │   ├── availabilityController.js   ← Get/set/delete availability blocks
    │   ├── messageController.js        ← Inbox, compose, reply, delete, thread view
    │   ├── notificationController.js   ← List, mark-read, mark-all-read
    │   └── adminController.js          ← User management, verification, moderation
    │
    ├── middleware/
    │   ├── authMiddleware.js           ← requireLogin: redirects to /login if no session
    │   ├── roleMiddleware.js           ← requireRole(roleId): 403 if role insufficient
    │   ├── csrfMiddleware.js           ← csurf token injection for all POST/PUT/DELETE
    │   ├── validationMiddleware.js     ← express-validator chains per route
    │   └── uploadMiddleware.js         ← multer config for profile/logo photo uploads
    │
    ├── models/
    │   ├── User.js                     ← findByEmail, findById, create, updatePassword
    │   ├── InstructorProfile.js        ← find, findPublic, create, update, search
    │   ├── SchoolProfile.js            ← find, create, update, getRoster
    │   ├── Event.js                    ← find, findPublic, create, update, getRegistrants
    │   ├── BookingRequest.js           ← create, findByInstructor, findByRequester, updateStatus
    │   ├── Availability.js             ← getByMonth, setDate, deleteDate
    │   ├── Message.js                  ← getInbox, getThread, send, markRead, softDelete
    │   └── Notification.js             ← create, getByUser, markRead, markAllRead
    │
    ├── modules/
    │   ├── database.js                 ← DatabaseHandler (existing, connection pool)
    │   ├── rate-limit.js               ← Rate-limit config (existing)
    │   ├── utils.js                    ← format(), httpResponse() (existing)
    │   ├── swaggerui.js                ← Swagger docs (existing)
    │   ├── mailer.js                   ← Nodemailer wrapper for verify/reset/notify emails
    │   └── notifier.js                 ← createNotification() helper (writes DB + optionally emails)
    │
    ├── queries/
    │   ├── auth/
    │   │   ├── findUserByEmail.sql
    │   │   ├── findUserById.sql
    │   │   ├── createUser.sql
    │   │   ├── updatePasswordHash.sql
    │   │   ├── setVerifyToken.sql
    │   │   └── setResetToken.sql
    │   ├── instructors/
    │   │   ├── findProfileByUserId.sql
    │   │   ├── findPublicProfiles.sql
    │   │   ├── searchInstructors.sql
    │   │   ├── createProfile.sql
    │   │   ├── updateProfile.sql
    │   │   ├── getSpecialties.sql
    │   │   ├── setSpecialties.sql
    │   │   └── verifyCredential.sql
    │   ├── schools/
    │   │   ├── findProfileByUserId.sql
    │   │   ├── findPublicProfiles.sql
    │   │   ├── createProfile.sql
    │   │   ├── updateProfile.sql
    │   │   ├── getRoster.sql
    │   │   ├── addInstructorToRoster.sql
    │   │   └── removeInstructorFromRoster.sql
    │   ├── events/
    │   │   ├── findById.sql
    │   │   ├── findPublished.sql
    │   │   ├── findByOrganizer.sql
    │   │   ├── findBySchool.sql
    │   │   ├── createEvent.sql
    │   │   ├── updateEvent.sql
    │   │   ├── updateStatus.sql
    │   │   └── getRegistrants.sql
    │   ├── bookings/
    │   │   ├── createRequest.sql
    │   │   ├── findByInstructor.sql
    │   │   ├── findByRequester.sql
    │   │   ├── findById.sql
    │   │   └── updateStatus.sql
    │   ├── availability/
    │   │   ├── getByMonth.sql
    │   │   ├── getByDateRange.sql
    │   │   ├── upsertDate.sql
    │   │   └── deleteDate.sql
    │   ├── messages/
    │   │   ├── getInbox.sql
    │   │   ├── getSent.sql
    │   │   ├── getThread.sql
    │   │   ├── createMessage.sql
    │   │   ├── markRead.sql
    │   │   └── softDelete.sql
    │   └── notifications/
    │       ├── getByUser.sql
    │       ├── getUnreadCount.sql
    │       ├── createNotification.sql
    │       ├── markRead.sql
    │       └── markAllRead.sql
    │
    ├── public/
    │   ├── css/
    │   │   └── main.css                ← Custom styles on top of Bootstrap 5
    │   ├── js/
    │   │   ├── calendar.js             ← Availability calendar UI logic
    │   │   └── notifications.js        ← Polling for unread count badge
    │   └── images/
    │       └── placeholder-avatar.png
    │
    ├── routes/
    │   ├── routes-home.js              ← GET / (landing page)
    │   ├── routes-auth.js              ← /register /login /logout /verify /reset-password
    │   ├── routes-dashboard.js         ← /dashboard (role-aware redirect)
    │   ├── routes-instructor.js        ← /instructors /instructors/:id /profile/instructor/*
    │   ├── routes-school.js            ← /schools /schools/:id /profile/school/*
    │   ├── routes-event.js             ← /events /events/:id /events/create /events/:id/edit
    │   ├── routes-booking.js           ← /bookings /bookings/:id /bookings/create
    │   ├── routes-availability.js      ← /availability (AJAX endpoints for calendar)
    │   ├── routes-messages.js          ← /messages /messages/:id /messages/compose
    │   ├── routes-notifications.js     ← /notifications /notifications/read
    │   ├── routes-admin.js             ← /admin/* (admin panel)
    │   └── routes-not-found.js         ← 404 catch-all (existing)
    │
    ├── views/
    │   ├── layout.ejs                  ← Base layout (navbar, flash, footer, scripts)
    │   ├── partials/
    │   │   ├── navbar.ejs
    │   │   ├── footer.ejs
    │   │   ├── flash.ejs               ← Success / error alert banners
    │   │   ├── notification-bell.ejs   ← Unread badge + dropdown
    │   │   ├── instructor-card.ejs     ← Reusable profile card partial
    │   │   ├── event-card.ejs          ← Reusable event card partial
    │   │   └── pagination.ejs          ← Reusable page links
    │   └── pages/
    │       ├── home.ejs
    │       ├── auth/
    │       │   ├── register.ejs
    │       │   ├── login.ejs
    │       │   ├── verify-email.ejs
    │       │   └── reset-password.ejs
    │       ├── dashboard/
    │       │   ├── instructor.ejs
    │       │   ├── school.ejs
    │       │   ├── organizer.ejs
    │       │   └── admin.ejs
    │       ├── instructor/
    │       │   ├── index.ejs           ← Search / browse instructors
    │       │   ├── show.ejs            ← Public instructor profile
    │       │   └── edit.ejs            ← Edit own profile
    │       ├── school/
    │       │   ├── index.ejs           ← Browse schools
    │       │   ├── show.ejs            ← Public school page
    │       │   └── edit.ejs            ← Edit school profile
    │       ├── event/
    │       │   ├── index.ejs           ← Event listing + calendar
    │       │   ├── show.ejs            ← Event detail page
    │       │   ├── create.ejs
    │       │   └── edit.ejs
    │       ├── booking/
    │       │   ├── index.ejs           ← Booking history / dashboard
    │       │   ├── show.ejs            ← Booking detail
    │       │   └── create.ejs          ← Booking request form
    │       ├── availability/
    │       │   └── index.ejs           ← Calendar UI for managing availability
    │       ├── messages/
    │       │   ├── inbox.ejs
    │       │   ├── thread.ejs
    │       │   └── compose.ejs
    │       ├── notifications/
    │       │   └── index.ejs
    │       ├── admin/
    │       │   ├── users.ejs
    │       │   ├── instructors.ejs     ← Verify credentials
    │       │   └── reports.ejs
    │       └── errors/
    │           ├── 404.ejs
    │           └── 500.ejs
    │
    └── lang/
        └── en/
            ├── serverMessages.js       ← (existing)
            ├── errorMessages.js        ← (existing)
            └── validationMessages.js   ← Form field validation strings
```

---

## 7. Route Map

### Public Routes (no auth required)

| Method | Path | Controller Action |
|---|---|---|
| GET | `/` | `home.index` |
| GET | `/register` | `auth.showRegister` |
| POST | `/register` | `auth.register` |
| GET | `/login` | `auth.showLogin` |
| POST | `/login` | `auth.login` |
| GET | `/verify-email/:token` | `auth.verifyEmail` |
| GET | `/reset-password` | `auth.showReset` |
| POST | `/reset-password` | `auth.resetPassword` |
| GET | `/instructors` | `instructor.index` |
| GET | `/instructors/:id` | `instructor.show` |
| GET | `/schools` | `school.index` |
| GET | `/schools/:id` | `school.show` |
| GET | `/events` | `event.index` |
| GET | `/events/:id` | `event.show` |

### Authenticated Routes (role ≥ instructor / school / organizer)

| Method | Path | Controller Action | Min Role |
|---|---|---|---|
| GET | `/logout` | `auth.logout` | any |
| GET | `/dashboard` | `dashboard.index` | any |
| GET | `/profile/instructor` | `instructor.editForm` | instructor |
| POST | `/profile/instructor` | `instructor.update` | instructor |
| GET | `/availability` | `availability.index` | instructor |
| GET | `/availability/data` | `availability.getData` (AJAX) | instructor |
| POST | `/availability` | `availability.upsert` (AJAX) | instructor |
| DELETE | `/availability/:date` | `availability.remove` (AJAX) | instructor |
| GET | `/profile/school` | `school.editForm` | school |
| POST | `/profile/school` | `school.update` | school |
| POST | `/schools/:id/roster` | `school.addInstructor` | school |
| DELETE | `/schools/:id/roster/:instructorId` | `school.removeInstructor` | school |
| GET | `/events/create` | `event.createForm` | school, organizer |
| POST | `/events` | `event.create` | school, organizer |
| GET | `/events/:id/edit` | `event.editForm` | school, organizer |
| POST | `/events/:id` | `event.update` | school, organizer |
| DELETE | `/events/:id` | `event.delete` | school, organizer |
| GET | `/bookings` | `booking.index` | any |
| GET | `/bookings/create` | `booking.createForm` | school, organizer |
| POST | `/bookings` | `booking.create` | school, organizer |
| GET | `/bookings/:id` | `booking.show` | any (own) |
| POST | `/bookings/:id/accept` | `booking.accept` | instructor |
| POST | `/bookings/:id/decline` | `booking.decline` | instructor |
| POST | `/bookings/:id/cancel` | `booking.cancel` | requester |
| GET | `/messages` | `message.inbox` | any |
| GET | `/messages/compose` | `message.composeForm` | any |
| POST | `/messages` | `message.send` | any |
| GET | `/messages/:id` | `message.thread` | any (own) |
| POST | `/messages/:id/reply` | `message.reply` | any (own) |
| DELETE | `/messages/:id` | `message.delete` | any (own) |
| GET | `/notifications` | `notification.index` | any |
| POST | `/notifications/:id/read` | `notification.markRead` | any (own) |
| POST | `/notifications/read-all` | `notification.markAllRead` | any |

### Admin Routes (role = admin)

| Method | Path | Controller Action |
|---|---|---|
| GET | `/admin` | `admin.dashboard` |
| GET | `/admin/users` | `admin.listUsers` |
| POST | `/admin/users/:id/deactivate` | `admin.deactivateUser` |
| POST | `/admin/instructors/:id/verify` | `admin.verifyCredential` |
| GET | `/admin/reports` | `admin.reports` |

---

## 8. Development Roadmap

### Phase 1 — Foundation (Weeks 1–2)

Goal: Running server with auth and database fully wired.

- [ ] Update `.env.example` with all required variables (DB credentials, session secret, mailer config)
- [ ] Create all MySQL tables using DDL from Section 5
- [ ] Seed `roles` and `event_types` tables
- [ ] Install new dependencies: `express-session`, `connect-mysql2`, `bcrypt`, `csurf`, `express-validator`, `nodemailer`, `multer`
- [ ] Implement `authController`: register, login, logout
- [ ] Implement `authMiddleware` and `roleMiddleware`
- [ ] Build `layout.ejs` with Bootstrap 5 navbar, flash messages, and footer
- [ ] Build `register.ejs`, `login.ejs` pages
- [ ] Add role constants to `constants/roles.js`

**Milestone:** Users can register, log in, and be redirected to a role-specific dashboard stub.

---

### Phase 2 — Instructor & School Profiles (Weeks 3–4)

Goal: Core profile pages with CRUD and public views.

- [ ] `instructorController`: create, read, update profile + specialties
- [ ] `schoolController`: create, read, update profile + programs
- [ ] Photo upload via `multer` (store in `public/uploads/`, serve statically)
- [ ] Public search pages: `/instructors` with filter by rank, specialty, location
- [ ] Public profile pages: `/instructors/:id`, `/schools/:id`
- [ ] Roster management: add/remove instructors from school
- [ ] `instructor-card.ejs` and `school-card.ejs` partials

**Milestone:** Fully browsable public instructor and school directory.

---

### Phase 3 — Events & Availability Calendar (Weeks 5–6)

Goal: Events live on site; instructors control their schedule.

- [ ] `eventController`: full CRUD, status lifecycle
- [ ] Event listing page with calendar and list toggle views
- [ ] `availabilityController`: month-view calendar, AJAX upsert/delete
- [ ] `calendar.js`: interactive monthly availability grid (vanilla JS)
- [ ] Conflict check when composing a booking request (reads availability via AJAX)
- [ ] Event registration (user registers interest in an event)

**Milestone:** Events published; instructors have interactive availability calendars.

---

### Phase 4 — Booking System (Weeks 7–8)

Goal: Full booking request workflow end-to-end.

- [ ] `bookingController`: create, show, accept, decline, cancel, complete
- [ ] Booking request form (links to an event, selects an instructor, picks a date)
- [ ] Instructor booking dashboard: pending requests with accept/decline actions
- [ ] Requester booking dashboard: sent requests with status tracking
- [ ] `notifier.js`: create in-app notification on booking status change
- [ ] `Notification` model + `notificationController`
- [ ] Notification bell in navbar with unread badge

**Milestone:** Booking requests flow between organizers and instructors with notifications.

---

### Phase 5 — Messaging (Weeks 9–10)

Goal: Direct, threaded in-platform messaging.

- [ ] `messageController`: inbox, compose, reply, soft-delete
- [ ] `Message` model with thread/parent support
- [ ] Inbox, thread view, and compose pages
- [ ] Unread message count in navbar
- [ ] Notification created on new message received
- [ ] Messaging permission enforcement (booking-gated or same-school)

**Milestone:** Users communicate in-platform without leaving the site.

---

### Phase 6 — Admin Panel & Hardening (Weeks 11–12)

Goal: Platform is production-ready with operator controls.

- [ ] `adminController`: user list, deactivate, credential verification
- [ ] Admin dashboard with key metrics (user count, pending verifications, active bookings)
- [ ] Email notifications via `mailer.js` (verification email, password reset, booking updates)
- [ ] Per-user email notification preferences (stored as JSON column on users table or separate table)
- [ ] Comprehensive server-side validation on all forms
- [ ] CSRF tokens on all state-changing forms
- [ ] Rate limiting on `/login`, `/register`, `/bookings` routes
- [ ] Error pages (`404.ejs`, `500.ejs`)
- [ ] Environment-based logging (write to `logs/` directory)
- [ ] Final security audit: input sanitization, SQL injection check, session config

**Milestone:** Platform is secure, fully functional, and ready for staging deployment.

---

### Dependency Additions

The following packages need to be added to `package.json`:

```bash
npm install express-session connect-mysql2 bcrypt csurf express-validator nodemailer multer
```

| Package | Purpose |
|---|---|
| `express-session` | Server-side session management |
| `connect-mysql2` | Session store backed by MySQL `sessions` table |
| `bcrypt` | Password hashing |
| `csurf` | CSRF token generation and validation |
| `express-validator` | Request body/param validation chains |
| `nodemailer` | Transactional email (verify, reset, notify) |
| `multer` | Multipart form handling for photo uploads |

---

*End of Document*
