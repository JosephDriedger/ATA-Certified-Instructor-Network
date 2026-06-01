
// ── Instructor domain constants ───────────────────────────────────────────
// These lists drive form options, server-side validation, and the
// recommendation engine.  Keep them in sync with any future DB lookup tables.

const RANKS = [
    '1st Degree Black Belt',   // index 0
    '2nd Degree Black Belt',   // index 1
    '3rd Degree Black Belt',   // index 2
    '4th Degree Black Belt',   // index 3
    '5th Degree Black Belt',   // index 4
    '6th Degree Black Belt',   // index 5
    '7th Degree Black Belt',   // index 6
    '8th Degree Black Belt',   // index 7
    '9th Degree Black Belt'    // index 8
];

// ── Certification levels ──────────────────────────────────────────────────
// Source: ATA International "Upcoming Changes in Testing and Title Requirements"
// (Effective January 1, 2025).
//
// Mastership titles (Master → Grand Master) are formally defined by ATA with
// strict rank and age minimums.  The three lower instructor titles follow ATA's
// standard progression for teaching staff.
//
// CERT_MIN_RANK links each level to the minimum rank index in the RANKS array.
const CERTIFICATION_LEVELS = [
    'Certified Instructor',      // 1st Degree Black Belt
    'Head Instructor',           // 2nd Degree Black Belt
    'Chief Instructor',          // 3rd Degree Black Belt
    'Master Instructor',         // 6th Degree Black Belt  (ATA "Master" title)
    'Senior Master Instructor',  // 7th Degree Black Belt  (ATA "Senior Master")
    'Chief Master Instructor',   // 8th Degree Black Belt  (ATA "Chief Master")
    'Grand Master Instructor'    // 9th Degree Black Belt  (ATA "Grand Master")
];

// Minimum rank index (into RANKS) required before a certification level
// can be claimed.  Only Mastership titles have rank restrictions per ATA.
// Certified Instructor, Head Instructor, and Chief Instructor are unrestricted.
const CERT_MIN_RANK = {
    'Master Instructor':        5,   // 6th Degree+  (ATA "Master" title)
    'Senior Master Instructor': 6,   // 7th Degree+  (ATA "Senior Master")
    'Chief Master Instructor':  7,   // 8th Degree+  (ATA "Chief Master")
    'Grand Master Instructor':  8    // 9th Degree   (ATA "Grand Master")
};

// Minimum age required per ATA's January 2025 rules (Mastership titles only).
const CERT_MIN_AGE = {
    'Master Instructor':        28,
    'Senior Master Instructor': 34,
    'Chief Master Instructor':  41,
    'Grand Master Instructor':  50
};

const SPECIALTIES = [
    'Forms (Poomsae)',
    'Sparring',
    'Weapons',
    'Self-Defense',
    'Leadership Program',
    'Youth Programs',
    'Adult Programs',
    'Tournament Judging',
    'Belt Testing',
    'Seminar Instruction',
    'Competition Team Training',
    'Instructor Development'
];

module.exports = { RANKS, CERTIFICATION_LEVELS, CERT_MIN_RANK, CERT_MIN_AGE, SPECIALTIES };
