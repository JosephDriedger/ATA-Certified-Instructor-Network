-- ============================================================
--  ACIN — British Columbia Test Dataset
--
--  Password for ALL accounts: DevPassword123!
--  (matches DB_PASSWORD in .env.development)
--
--  Test accounts
--  ─────────────────────────────────────────────────────────
--  admin@acin-bc.test          Administrator
--  owner.coastal@acin-bc.test  School Owner — Coastal ATA Vancouver
--  owner.okanagan@acin-bc.test School Owner — Okanagan ATA Kelowna
--  instructor.david@acin-bc.test   5th Degree — verified, history, available
--  instructor.sarah@acin-bc.test   4th Degree — verified, accepted booking
--  instructor.michael@acin-bc.test 3rd Degree — unverified cert, blocked dates
--  instructor.emma@acin-bc.test    1st Degree — new user, no availability set
--  instructor.robert@acin-bc.test  5th Degree — independent (Victoria)
--  owner.new@acin-bc.test      School Owner — no school profile yet (edge case)
--
--  Coverage map
--  ─────────────────────────────────────────────────────────
--  Auth          register · login · logout
--  Roles         all 3 privilege levels
--  Profiles      complete · partial · private stub
--  Schools       full profile · no-school edge case
--  Roster        primary + secondary affiliations
--  Events        all 5 types · all 4 statuses · upcoming + past
--  Judge Req     all 5 statuses · with/without event link
--  Availability  explicitly available · explicitly blocked · default
--  Double-book   Sarah accepted Aug 15 → excluded from that date
--  Recommend.    independent + cross-school instructors → results appear
--  Certs         verified · unverified (admin action) · expired
--  Messages      unread thread (badge) · fully-read thread
--  Notifications unread + read · all notification types
--  Dashboard     all 3 role-specific views with live data
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
--  ROLES  (privilege levels — higher id = more access)
-- ============================================================
INSERT INTO roles (id, name, label, description) VALUES
    (1, 'instructor',    'Instructor',    'Base level. Instructor profile, availability, receive judge requests.'),
    (2, 'school_owner',  'School Owner',  'All instructor capabilities + school profile, post events, send requests.'),
    (3, 'administrator', 'Administrator', 'All capabilities + user management, credential verification.');


-- ============================================================
--  USERS
--  id 1 = admin · id 2-3 = school owners · id 4-8 = instructors · id 9 = new owner
-- ============================================================
INSERT INTO users (id, role_id, email, password_hash, first_name, last_name, phone, is_email_verified, is_active) VALUES

    -- ── Administrator ──────────────────────────────────────────────────────
    (1, 3, 'admin@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Sarah', 'Mitchell', '604-555-0001', 1, 1),

    -- ── School Owners ──────────────────────────────────────────────────────
    -- James is also a public instructor (tests school-owner-as-instructor flow)
    (2, 2, 'owner.coastal@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'James', 'Park', '604-555-0100', 1, 1),

    (3, 2, 'owner.okanagan@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Helen', 'Chen', '250-555-0200', 1, 1),

    -- ── Instructors ────────────────────────────────────────────────────────
    (4, 1, 'instructor.david@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'David', 'Kim', '604-555-0400', 1, 1),

    (5, 1, 'instructor.sarah@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Sarah', 'Johnson', '604-555-0500', 1, 1),

    (6, 1, 'instructor.michael@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Michael', 'Tran', '250-555-0600', 1, 1),

    -- New user — no availability set, no prior history
    (7, 1, 'instructor.emma@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Emma', 'Wilson', '604-555-0700', 1, 1),

    -- Independent (no school affiliation) — ensures recommendations return results
    (8, 1, 'instructor.robert@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Robert', 'Lee', '250-555-0800', 1, 1),

    -- School owner who has NOT created a school yet (dashboard edge case)
    (9, 2, 'owner.new@acin-bc.test',
     '$2a$12$9wvE0ALsUri1kddPDvPPJ.vRaaUJxqKR/dY/J6keB6psHMJRnf5uu',
     'Tom', 'Park', '778-555-0900', 1, 1);


-- ============================================================
--  SCHOOLS
-- ============================================================
INSERT INTO schools (id, owner_id, name, slug, head_instructor_name, description,
                     address, city, state, country, postal_code,
                     phone, email, website_url, is_active) VALUES

    (1, 2,
     'Coastal ATA Martial Arts',
     'coastal-ata',
     'Sabum Nim James Park, 4th Degree',
     'Family-focused ATA school serving North Vancouver since 2010. Programs for all ages from Little Ninjas through adult Leadership. We pride ourselves on a welcoming, disciplined environment rooted in ATA values.',
     '1245 Lonsdale Ave', 'North Vancouver', 'BC', 'CA', 'V7M 2H5',
     '604-555-0100', 'info@coastalata.example.ca', 'https://coastalata.example.ca', 1),

    (2, 3,
     'Okanagan ATA Martial Arts',
     'okanagan-ata',
     'Helen Chen, 3rd Degree',
     'The premier ATA school in the Okanagan Valley. Serving Kelowna and surrounding communities with programs for children, teens, and adults. Competitive team with regional and national championships.',
     '1890 Cooper Rd', 'Kelowna', 'BC', 'CA', 'V1Y 8B7',
     '250-555-0200', 'info@okanaganata.example.ca', 'https://okanaganata.example.ca', 1);


-- ============================================================
--  INSTRUCTORS
--  Auto-created at registration for all non-admin users.
--  is_public=0  → stub (not visible in directory yet)
--  is_public=1  → active, visible in directory
-- ============================================================
INSERT INTO instructors (id, user_id, school_id,
                         ata_member_number,
                         bio, `rank`, certification_level, years_experience,
                         city, state, country,
                         is_public, is_available_for_events,
                         is_available_for_testing, is_available_for_seminars,
                         travel_radius_miles) VALUES

    -- ── id=1 David Kim: 6th Degree Master Instructor, verified cert, judging history ──
    (1, 4, 1,
     '3847-10291',
     'David Kim is a 6th Degree ATA Black Belt and Master Instructor with 20 years of teaching experience in the Lower Mainland. He has served as head judge at over 30 provincial and national ATA testing events and tournaments. David is known for his precision, professionalism, and mentorship of junior instructors.',
     '6th Degree Black Belt', 'Master Instructor', 20,
     'North Vancouver', 'BC', 'CA',
     1, 1, 1, 1, 200),

    -- ── id=2 Sarah Johnson: 4th Degree, available for testing, accepted booking ──
    (2, 5, 1,
     '62901834-4412',
     'Sarah Johnson holds a 4th Degree Black Belt and specializes in youth development and belt testing evaluation. With 12 years of teaching experience, she has a gift for making students feel comfortable during high-pressure testing environments. Sarah is available for testing events throughout the Lower Mainland.',
     '4th Degree Black Belt', 'Chief Instructor', 12,
     'Vancouver', 'BC', 'CA',
     1, 1, 1, 1, 150),

    -- ── id=3 Michael Tran: 3rd Degree, unverified cert, blocked dates ────────────
    (3, 6, 2,
     '9103-55274',
     'Michael Tran is a 3rd Degree Black Belt based in Kelowna. He is the head instructor at Okanagan ATA and has been teaching for 8 years. Michael competes regularly on the provincial sparring circuit and coaches the Okanagan ATA competition team.',
     '3rd Degree Black Belt', 'Head Instructor', 8,
     'Kelowna', 'BC', 'CA',
     1, 1, 0, 1, 100),

    -- ── id=4 Emma Wilson: 1st Degree, new, no availability set ─────────────────
    (4, 7, 1,
     '48203917-7731',
     'Emma Wilson is a 1st Degree Black Belt recently certified as an ATA instructor. She teaches youth programs at Coastal ATA and is beginning to take on assistant judging roles at local testing events.',
     '1st Degree Black Belt', 'Certified Instructor', 2,
     'Burnaby', 'BC', 'CA',
     1, 1, 0, 0, 50),

    -- ── id=5 James Park: School owner who is also a public instructor ────────────
    (5, 2, 1,
     '1212-48298',
     'James Park is the founder and head instructor of Coastal ATA Martial Arts. A 4th Degree Black Belt with 15 years of teaching experience, James has served as a judge at numerous provincial tournaments and belt testings throughout British Columbia.',
     '4th Degree Black Belt', 'Chief Instructor', 15,
     'North Vancouver', 'BC', 'CA',
     1, 1, 1, 1, 150),

    -- ── id=6 Helen Chen: School owner — public instructor profile by default ────────
    (6, 3, 2,
     NULL,
     NULL,
     '3rd Degree Black Belt', 'Head Instructor', 6,
     'Kelowna', 'BC', 'CA',
     1, 1, 0, 0, NULL),

    -- ── id=7 Robert Lee: 9th Degree Grand Master, independent, Victoria ────────────
    -- Key test case: independent instructors appear in recommendations for any school
    (7, 8, NULL,
     '5530-19847',
     'Robert Lee is a 9th Degree ATA Grand Master Instructor based in Victoria. With 25 years of experience, Robert has served as a senior examiner at ATA World Championships and is one of the most respected testing officials in Western Canada. He is available to travel throughout BC for significant events.',
     '9th Degree Black Belt', 'Grand Master Instructor', 25,
     'Victoria', 'BC', 'CA',
     1, 1, 1, 1, 350),

    -- ── id=8 Tom Park: New school owner, no school yet — public instructor profile ──
    (8, 9, NULL,
     NULL, NULL,
     NULL, NULL, NULL,
     NULL, 'BC', 'CA',
     1, 1, 0, 0, NULL);


-- ============================================================
--  INSTRUCTOR SPECIALTIES
-- ============================================================
INSERT INTO instructor_specialties (instructor_id, specialty) VALUES
    -- David Kim
    (1, 'Belt Testing'),
    (1, 'Forms (Poomsae)'),
    (1, 'Instructor Development'),
    (1, 'Tournament Judging'),

    -- Sarah Johnson
    (2, 'Belt Testing'),
    (2, 'Leadership Program'),
    (2, 'Youth Programs'),

    -- Michael Tran
    (3, 'Competition Team Training'),
    (3, 'Sparring'),
    (3, 'Tournament Judging'),

    -- Emma Wilson
    (4, 'Youth Programs'),

    -- James Park (school owner + instructor)
    (5, 'Adult Programs'),
    (5, 'Forms (Poomsae)'),
    (5, 'Leadership Program'),
    (5, 'Seminar Instruction'),

    -- Robert Lee (independent senior)
    (7, 'Adult Programs'),
    (7, 'Belt Testing'),
    (7, 'Instructor Development'),
    (7, 'Tournament Judging');


-- ============================================================
--  SCHOOL INSTRUCTORS (roster junction)
-- ============================================================
INSERT INTO school_instructors (school_id, instructor_id, role_title, is_primary, joined_at) VALUES
    -- Coastal ATA roster
    (1, 1, 'Instructor',           0, '2019-09-01'),   -- David Kim
    (1, 2, 'Instructor',           0, '2021-03-15'),   -- Sarah Johnson
    (1, 4, 'Assistant Instructor', 0, '2024-06-01'),   -- Emma Wilson

    -- Okanagan ATA roster
    (2, 3, 'Head Instructor',      1, '2018-01-10');   -- Michael Tran


-- ============================================================
--  EVENTS
--  Types  : tournament · seminar · belt_testing · camp · other
--  Statuses: draft · published · completed · cancelled
-- ============================================================
INSERT INTO events (id, school_id, created_by, title, description, event_type,
                    location_name, address, city, state, country, postal_code,
                    start_datetime, end_datetime, max_participants,
                    judges_needed, required_judge_rank,
                    registration_deadline, is_public, status) VALUES

    -- ── 1: Upcoming belt testing (published) — pending judge request attached ──
    (1, 1, 2,
     'Coastal ATA Summer Belt Testing 2026',
     'Our semi-annual ATA belt testing event open to all Coastal ATA students from Tiny Tigers through adult leadership. Testing covers all forms, one-steps, and sparring requirements. Guest judges will evaluate all 1st Degree and above candidates.',
     'belt_testing',
     'North Shore Recreation Centre', '1030 Brooksbank Ave', 'North Vancouver', 'BC', 'CA', 'V7J 2B8',
     '2026-07-19 09:00:00', '2026-07-19 17:00:00', 80,
     2, '4th Degree Black Belt',
     '2026-07-12 23:59:59', 1, 'published'),

    -- ── 2: Upcoming tournament (published) — accepted judge request attached ──────
    (2, 1, 2,
     'BC Lower Mainland Regional Tournament 2026',
     'Open ATA tournament for all BC Lower Mainland schools. Divisions include forms, sparring, and weapons for all ages and ranks. Medals and trophies awarded. All ATA-affiliated students welcome.',
     'tournament',
     'Bill Copeland Sports Centre', '3676 Kensington Ave', 'Burnaby', 'BC', 'CA', 'V5C 3J6',
     '2026-08-15 08:00:00', '2026-08-15 19:00:00', 200,
     3, '3rd Degree Black Belt',
     '2026-08-08 23:59:59', 1, 'published'),

    -- ── 3: Draft seminar — cancelled judge request attached ────────────────────
    (3, 1, 2,
     'ATA Leadership Instructor Development Seminar',
     'A full-day professional development seminar for ATA certified instructors. Topics include curriculum delivery, student retention, leadership programme advancement, and tournament preparation. Presented by senior ATA instructors.',
     'seminar',
     'Coastal ATA Dojang', '1245 Lonsdale Ave', 'North Vancouver', 'BC', 'CA', 'V7M 2H5',
     '2026-09-12 09:00:00', '2026-09-12 17:00:00', 30,
     1, NULL,
     NULL, 0, 'draft'),

    -- ── 4: Past belt testing (completed) — completed judge request, David's history
    (4, 1, 2,
     'Coastal ATA Spring Belt Testing 2026',
     'Spring 2026 semi-annual testing event.',
     'belt_testing',
     'North Shore Recreation Centre', '1030 Brooksbank Ave', 'North Vancouver', 'BC', 'CA', 'V7J 2B8',
     '2026-04-19 09:00:00', '2026-04-19 16:00:00', 75,
     2, '4th Degree Black Belt',
     '2026-04-12 23:59:59', 1, 'completed'),

    -- ── 5: Okanagan belt testing (published) — declined judge request attached ──
    (5, 2, 3,
     'Okanagan ATA Summer Belt Testing 2026',
     'Semi-annual belt testing for all Okanagan ATA students. Open to friends and family as observers.',
     'belt_testing',
     'Kelowna Community Centre', '1340 Water St', 'Kelowna', 'BC', 'CA', 'V1Y 9P3',
     '2026-07-26 10:00:00', '2026-07-26 16:00:00', 60,
     2, '3rd Degree Black Belt',
     '2026-07-19 23:59:59', 1, 'published');


-- ============================================================
--  EVENT_STAFF
--  Sarah Johnson confirmed as judge for the BC Regional Tournament
--  (created when request id=2 was accepted)
-- ============================================================
INSERT INTO event_staff (event_id, instructor_id, staff_role, status, notes) VALUES
    (2, 2, 'judge', 'confirmed', 'Confirmed via judge request. Reporting to ring 1 for sparring divisions.');


-- ============================================================
--  JUDGE REQUESTS  (all 5 statuses covered)
--
--  requester_id = users.id (school owner's user ID)
--  instructor_id = instructors.id (instructor PROFILE ID, not user ID)
-- ============================================================
INSERT INTO judge_requests (id, requester_id, instructor_id, event_id,
                             requested_date, requested_time, location_name,
                             required_rank, judges_needed, message,
                             status, response_message, responded_at) VALUES

    -- ── 1: PENDING — dashboard shows accept/decline for David Kim ──────────────
    (1, 2, 1, 1,
     '2026-07-19', '09:00:00', NULL,
     '4th Degree Black Belt', 2,
     'Hi David, we would be honoured to have you serve as head judge at our Summer Belt Testing on July 19th at the North Shore Recreation Centre. We are expecting around 40 candidates testing for red stripe through 1st Degree. Your experience and expertise would be invaluable. We can offer $175 plus travel from North Vancouver.',
     'pending', NULL, NULL),

    -- ── 2: ACCEPTED — Sarah confirmed for BC Regional Tournament (Aug 15) ──────
    --   Also tests double-booking prevention: Sarah is now booked Aug 15
    (2, 2, 2, 2,
     '2026-08-15', '08:00:00', NULL,
     '3rd Degree Black Belt', 3,
     'Sarah, we would love to have you judging at our Regional Tournament on August 15th at the Bill Copeland Sports Centre in Burnaby. You would be covering forms and one-steps for all youth divisions. Compensation is $150 plus a judges lunch.',
     'accepted',
     'Thank you James! I am happy to be there. August 15th works perfectly. Please send me the event schedule and the judges briefing time when you have it ready.',
     '2026-06-03 10:22:00'),

    -- ── 3: DECLINED — David Kim declined Okanagan testing July 26 ──────────────
    --   Also tests that David is blocked on July 26 (he set blocked availability)
    (3, 3, 1, 5,
     '2026-07-26', '10:00:00', NULL,
     '4th Degree Black Belt', 2,
     'Hi David, we are hosting our Summer Belt Testing in Kelowna on July 26th and would love to have a senior judge from the Lower Mainland. Would you be available to travel to Kelowna for this event? We cover travel and accommodation.',
     'declined',
     'Hi Helen, thank you so much for thinking of me! Unfortunately I already have a prior family commitment that weekend and am unable to travel. I hope your testing goes wonderfully — Kelowna is fortunate to have such an active ATA community. Best of luck!',
     '2026-06-05 14:47:00'),

    -- ── 4: CANCELLED — James cancelled before Michael could respond ────────────
    (4, 2, 3, 3,
     '2026-09-12', '09:00:00', NULL,
     '3rd Degree Black Belt', 1,
     'Hi Michael, we are putting together a leadership seminar in September and would love to have you as a guest instructor for the sparring strategy segment. Let me know if you are available.',
     'cancelled', NULL, NULL),

    -- ── 5: COMPLETED — David judged Spring Belt Testing (builds his history) ───
    --   Recommendation engine scores David higher for belt testing events
    (5, 2, 1, 4,
     '2026-04-19', '09:00:00', NULL,
     '4th Degree Black Belt', 2,
     'David, we would like to invite you back as head judge for our Spring Belt Testing in April. You did an outstanding job last year and our students always appreciate your thorough feedback.',
     'completed',
     'It was a pleasure as always, James. Your students tested brilliantly — you should be proud of the progress they have made. Looking forward to the next one!',
     '2026-04-19 17:30:00');


-- ============================================================
--  CERTIFICATIONS
--  id=1 verified, id=2 verified, id=3 unverified (admin action needed),
--  id=4 expired (admin sees in reports)
-- ============================================================
INSERT INTO certifications (id, instructor_id,
                             certification_name, issuing_organization,
                             certification_number, rank_level,
                             issued_date, expiry_date,
                             is_verified, verified_by, verified_at) VALUES

    -- David Kim — verified 6th Degree (Master Instructor)
    (1, 1,
     'ATA Certified Instructor',
     'ATA International',
     '8431', '6th Degree Black Belt',
     '2020-09-15', '2025-09-14',
     1, 1, '2026-01-10 09:00:00'),

    -- Sarah Johnson — verified 4th Degree
    (2, 2,
     'ATA Certified Instructor',
     'ATA International',
     '12334', '4th Degree Black Belt',
     '2022-03-20', '2027-03-19',
     1, 1, '2026-01-10 09:15:00'),

    -- Michael Tran — NOT verified (admin cert review queue test case)
    (3, 3,
     'ATA Certified Instructor',
     'ATA International',
     '15902', '3rd Degree Black Belt',
     '2021-11-05', '2026-11-04',
     0, NULL, NULL),

    -- David Kim — EXPIRED cert (admin reports test case)
    (4, 1,
     'ATA Certified Instructor',
     'ATA International',
     '6274', '4th Degree Black Belt',
     '2015-06-01', '2020-05-31',
     1, 1, '2020-06-15 10:00:00'),

    -- James Park — verified 4th Degree (using the user's real cert number as example)
    (5, 5,
     'ATA Certified Instructor',
     'ATA International',
     '10783', '4th Degree Black Belt',
     '2016-06-13', '2029-01-29',
     1, 1, '2026-01-10 09:45:00'),

    -- Robert Lee — verified 9th Degree Grand Master Instructor
    (6, 7,
     'ATA Certified Instructor',
     'ATA International',
     '3219', '9th Degree Black Belt',
     '2005-04-12', '2030-04-11',
     1, 1, '2026-01-10 09:30:00');


-- ============================================================
--  CONVERSATIONS
-- ============================================================
INSERT INTO conversations (id, subject, participant_one_id, participant_two_id,
                           reference_type, reference_id, last_message_at) VALUES

    -- Conv 1: James (school owner) ↔ David Kim — re: Summer Belt Testing
    -- David has an UNREAD message → navbar badge shows for David
    (1,
     'Re: Summer Belt Testing — July 19th',
     2, 4,
     'judge_request', 1,
     '2026-06-04 11:45:00'),

    -- Conv 2: Helen (school owner) ↔ Sarah Johnson — all messages read
    (2,
     'Kelowna Testing — September dates',
     3, 5,
     NULL, NULL,
     '2026-05-28 15:30:00');


-- ============================================================
--  MESSAGES
-- ============================================================
INSERT INTO messages (id, conversation_id, sender_id, body,
                      is_read, read_at, sender_deleted, recipient_deleted) VALUES

    -- ── Conversation 1: James ↔ David (msg 3 is unread by David) ─────────────
    (1, 1, 2,
     'Hi David, I just sent you a formal judge request for our July 19th belt testing. Looking forward to having you with us again — the students always appreciate your detailed feedback. Let me know if you have any questions about the schedule.',
     1, '2026-06-02 09:15:00', 0, 0),

    (2, 1, 4,
     'Hi James, thanks for reaching out! July 19th works well for me. Could you send me the preliminary schedule and let me know approximately how many candidates you are expecting for the 1st Degree testing?',
     1, '2026-06-02 14:30:00', 0, 0),

    -- This message is UNREAD by David → drives the unread badge in his navbar
    (3, 1, 2,
     'Great news! We are expecting around 40 candidates in total, with 12 testing for 1st Degree. Plan to arrive by 8:30 AM for the judges briefing at 9:00 AM sharp before doors open at 9:30 AM. I will email you the full schedule and candidate forms by end of week.',
     0, NULL, 0, 0),

    -- ── Conversation 2: Helen ↔ Sarah (all read) ───────────────────────────────
    (4, 2, 3,
     'Hi Sarah! We are thinking of hosting a fall belt testing here in Kelowna sometime in September. We would love to have a Lower Mainland instructor come out as a guest examiner. Would you be interested?',
     1, '2026-05-28 16:00:00', 0, 0),

    (5, 2, 5,
     'Hi Helen, that sounds wonderful! I love visiting the Okanagan. Once you have confirmed dates, send them my way and I will check my calendar. September should be fairly open for me.',
     1, '2026-05-28 16:45:00', 0, 0);


-- ============================================================
--  NOTIFICATIONS  (mix of unread / read, all types covered)
-- ============================================================
INSERT INTO notifications (user_id, type, title, body,
                           is_read, read_at, reference_type, reference_id) VALUES

    -- ── David Kim (user 4) — 2 unread ─────────────────────────────────────────
    -- New judge request from Coastal ATA
    (4, 'judge_request_received',
     'New judge request from Coastal ATA Martial Arts',
     'James Park has sent you a guest judge request for the Coastal ATA Summer Belt Testing on July 19th. Review the details and respond at your earliest convenience.',
     0, NULL, 'judge_request', 1),

    -- Unread message from James
    (4, 'new_message',
     'New message from James Park',
     'James Park sent you a message: "Great news! We are expecting around 40 candidates..."',
     0, NULL, 'message', 1),

    -- Old read notification
    (4, 'judge_request_received',
     'New judge request from Coastal ATA Martial Arts',
     'James Park has sent you a guest judge request for the Spring Belt Testing on April 19th.',
     1, '2026-03-12 10:00:00', 'judge_request', 5),

    -- ── James Park (user 2) — 1 unread ────────────────────────────────────────
    -- Sarah accepted the tournament request
    (2, 'judge_request_accepted',
     'Sarah Johnson accepted your judge request',
     'Sarah Johnson has confirmed she will attend as a guest judge for the BC Lower Mainland Regional Tournament on August 15th.',
     0, NULL, 'judge_request', 2),

    -- ── Helen Chen (user 3) — 1 read ──────────────────────────────────────────
    -- David declined her request
    (3, 'judge_request_declined',
     'David Kim declined your judge request',
     'David Kim is unable to attend your Okanagan Summer Belt Testing on July 26th. Consider browsing the instructor directory for available alternatives.',
     1, '2026-06-05 15:30:00', 'judge_request', 3),

    -- ── Sarah Johnson (user 5) — 1 read ───────────────────────────────────────
    -- Judge request received and she already read it
    (5, 'judge_request_received',
     'New judge request from Coastal ATA Martial Arts',
     'James Park has sent you a guest judge request for the BC Lower Mainland Regional Tournament on August 15th.',
     1, '2026-05-31 09:00:00', 'judge_request', 2);


-- ============================================================
--  AVAILABILITY
--
--  Key test cases:
--  • David:   available Jul 19 (pending request) · BLOCKED Jul 26 (declined, unavailable)
--  • Sarah:   available Aug 15 (accepted booking) — double-booking prevention test
--             (another school requesting Sarah for Aug 15 should exclude her)
--  • Michael: BLOCKED Jul 19 — excluded from Coastal Jul 19 recommendations
--             available Sep 12 (available for the seminar date)
--  • Robert:  available Jul 19 and Aug 15 — appears in recommendations for both events
--  • Emma:    NO ENTRIES — uses profile default (is_available_for_events=1)
-- ============================================================
INSERT INTO availability (instructor_id, available_date, start_time, end_time, is_available, notes) VALUES

    -- ── David Kim (instructor_id=1) ────────────────────────────────────────────
    (1, '2026-07-05',  '09:00:00', '17:00:00', 1, NULL),
    (1, '2026-07-12',  '09:00:00', '17:00:00', 1, NULL),
    (1, '2026-07-19',  '08:00:00', '18:00:00', 1, 'Coastal ATA Summer Belt Testing'),
    (1, '2026-07-26',  NULL,       NULL,        0, 'Family commitment — not available'),
    (1, '2026-08-09',  '09:00:00', '17:00:00', 1, NULL),
    (1, '2026-08-16',  '09:00:00', '17:00:00', 1, NULL),
    (1, '2026-08-23',  '09:00:00', '17:00:00', 1, NULL),
    (1, '2026-09-06',  '09:00:00', '17:00:00', 1, NULL),

    -- ── Sarah Johnson (instructor_id=2) ───────────────────────────────────────
    (2, '2026-07-05',  '10:00:00', '16:00:00', 1, NULL),
    (2, '2026-07-12',  '10:00:00', '16:00:00', 1, NULL),
    (2, '2026-07-19',  '09:00:00', '17:00:00', 1, NULL),
    (2, '2026-08-15',  '08:00:00', '19:00:00', 1, 'BC Regional Tournament — confirmed'),
    (2, '2026-08-22',  '10:00:00', '16:00:00', 1, NULL),
    (2, '2026-09-12',  '10:00:00', '16:00:00', 1, NULL),
    -- Test: Sarah blocked Aug 8 (shows mixed availability)
    (2, '2026-08-08',  NULL,       NULL,        0, 'Out of town'),

    -- ── Michael Tran (instructor_id=3) ────────────────────────────────────────
    (3, '2026-07-12',  '10:00:00', '16:00:00', 1, NULL),
    -- BLOCKED Jul 19 → excluded from Coastal ATA Summer Testing recommendations
    (3, '2026-07-19',  NULL,       NULL,        0, 'Okanagan school event'),
    (3, '2026-08-02',  '10:00:00', '16:00:00', 1, NULL),
    (3, '2026-08-09',  '10:00:00', '16:00:00', 1, NULL),
    (3, '2026-09-12',  '09:00:00', '17:00:00', 1, 'Available for seminar'),
    (3, '2026-09-19',  '09:00:00', '17:00:00', 1, NULL),

    -- ── Robert Lee (instructor_id=7) — independent, appears in recommendations ─
    (7, '2026-07-12',  '09:00:00', '17:00:00', 1, NULL),
    (7, '2026-07-19',  '09:00:00', '17:00:00', 1, 'Available — Lower Mainland events'),
    (7, '2026-07-26',  '09:00:00', '17:00:00', 1, NULL),
    (7, '2026-08-15',  '08:00:00', '19:00:00', 1, 'Available — Lower Mainland events'),
    (7, '2026-08-22',  '09:00:00', '17:00:00', 1, NULL),
    (7, '2026-09-05',  '09:00:00', '17:00:00', 1, NULL),
    (7, '2026-09-12',  '09:00:00', '17:00:00', 1, NULL),
    -- Robert blocked for Christmas holiday period
    (7, '2026-12-19',  NULL,       NULL,        0, 'Holiday — not available'),
    (7, '2026-12-20',  NULL,       NULL,        0, 'Holiday — not available'),

    -- ── James Park (instructor_id=5) — school owner who is also an instructor ──
    (5, '2026-07-19',  '09:00:00', '18:00:00', 1, 'Running Coastal ATA Summer Testing'),
    (5, '2026-08-15',  '08:00:00', '19:00:00', 1, 'Running BC Regional Tournament'),
    (5, '2026-09-12',  '09:00:00', '17:00:00', 1, NULL);

-- Emma Wilson (instructor_id=4): NO availability entries
-- → uses profile default (is_available_for_events=1, is_available_for_testing=0)
-- → appears in general event searches but not belt testing specific searches

SET FOREIGN_KEY_CHECKS = 1;
