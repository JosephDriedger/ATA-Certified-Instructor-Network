
/**
 * Scorer — pure, stateless scoring functions.
 *
 * Each signal returns a value in [0, 100].
 * compute() returns { total, breakdown, tier }.
 * No DB calls, no side effects — entirely unit-testable.
 */

// ── Domain constants ──────────────────────────────────────────────────────────

const RANKS = [
    '1st Degree Black Belt',   // index 0
    '2nd Degree Black Belt',
    '3rd Degree Black Belt',
    '4th Degree Black Belt',
    '5th Degree Black Belt',
    '6th Degree Black Belt',
    '7th Degree Black Belt',
    '8th Degree Black Belt',
    '9th Degree Black Belt'    // index 8
];

const CERTS = [
    'Certified Instructor',      // index 0 → lowest
    'Senior Instructor',
    'Chief Instructor',
    'Master Instructor',
    'Senior Master Instructor',
    'Grand Master'               // index 5 → highest
];

// Minimum rank index recommended per event type.
// Instructors below the minimum receive a steep penalty but are not excluded
// (the school owner makes the final call).
const MIN_RANK_IDX = {
    belt_testing: 2,   // 3rd Degree+ recommended for testing authority
    tournament:   1,   // 2nd Degree+ recommended
    seminar:      1,
    camp:         0,
    other:        0
};

// Which availability flag is most relevant per event type
const AVAIL_FLAG = {
    belt_testing: 'is_available_for_testing',
    seminar:      'is_available_for_seminars',
    tournament:   'is_available_for_events',
    camp:         'is_available_for_events',
    other:        'is_available_for_events'
};

// ── Signal weights — must sum to 1.0 ─────────────────────────────────────────

const WEIGHTS = {
    rank:          0.25,
    availability:  0.25,
    distance:      0.20,
    certification: 0.20,
    history:       0.10
};

// ── Individual signal scorers ─────────────────────────────────────────────────

function scoreRank(instructor, eventType, requiredJudgeRank = null) {
    const idx    = RANKS.indexOf(instructor.rank);
    if (idx === -1) return 0;

    // School-specified minimum rank takes priority over event-type default
    const explicitMinIdx = requiredJudgeRank ? RANKS.indexOf(requiredJudgeRank) : -1;
    const minIdx = explicitMinIdx >= 0 ? explicitMinIdx : (MIN_RANK_IDX[eventType] ?? 0);

    const raw = ((idx + 1) / RANKS.length) * 100;

    // Below minimum: heavy penalty but not zero (school owner makes final call)
    if (idx < minIdx) return Math.round(raw * 0.3);

    return Math.round(raw);
}

function scoreCertification(instructor) {
    const idx = CERTS.indexOf(instructor.certification_level);
    if (idx === -1) return 5;  // nominal baseline — uncertified but possibly experienced
    return Math.round((idx / (CERTS.length - 1)) * 100);
}

function scoreAvailability(instructor, eventType) {
    const explicit = instructor.explicit_availability;

    // Explicit entry from the availability calendar
    if (explicit === 1) return 100;
    if (explicit === 0) return 0;   // blocked — query already filters these; guard here

    // No explicit entry → fall back to profile-level flags
    const primaryFlag   = AVAIL_FLAG[eventType] ?? 'is_available_for_events';
    const primaryAvail  = instructor[primaryFlag];
    const generalAvail  = instructor.is_available_for_events;

    if (primaryAvail) return 75;   // type-specific flag set → good fit
    if (generalAvail) return 50;   // general availability → acceptable
    return 15;                     // no flags set → possible but low priority
}

function scoreDistance(instructor, event) {
    const iCity    = (instructor.instructor_city    || '').toLowerCase().trim();
    const iState   = (instructor.instructor_state   || '').toLowerCase().trim();
    const iCountry = (instructor.instructor_country || 'us').toLowerCase().trim();

    const eCity    = (event.city    || '').toLowerCase().trim();
    const eState   = (event.state   || '').toLowerCase().trim();
    const eCountry = (event.country || 'us').toLowerCase().trim();

    // If the event has no location info, return a neutral score
    if (!eCity && !eState) return 50;

    if (eCity  && iCity  === eCity)    return 100;   // same city
    if (eState && iState === eState)   return 75;    // same state
    if (iCountry === eCountry)          return 40;   // same country
    return 10;
}

function scoreHistory(instructor, eventType) {
    const total     = Math.min(instructor.judging_total      || 0, 20);
    const typeMatch = Math.min(instructor.judging_type_match || 0, 10);

    // Type-specific experience is worth more than general experience
    const typeNorm  = (typeMatch / 10) * 100;
    const totalNorm = (total    / 20) * 100;

    return Math.round(typeNorm * 0.70 + totalNorm * 0.30);
}

// ── Public API ────────────────────────────────────────────────────────────────

function compute(instructor, event) {
    const eventType        = event.event_type         || 'other';
    const requiredJudgeRank = event.required_judge_rank || null;

    const breakdown = {
        rank:          scoreRank(instructor, eventType, requiredJudgeRank),
        availability:  scoreAvailability(instructor, eventType),
        distance:      scoreDistance(instructor, event),
        certification: scoreCertification(instructor),
        history:       scoreHistory(instructor, eventType)
    };

    const total = Object.entries(WEIGHTS).reduce(
        (sum, [key, w]) => sum + breakdown[key] * w, 0
    );

    return { total: Math.round(total), breakdown, weights: WEIGHTS };
}

function tier(score) {
    if (score >= 80) return { label: 'Excellent Match', color: 'success',   icon: 'bi-star-fill'      };
    if (score >= 60) return { label: 'Good Match',      color: 'primary',   icon: 'bi-hand-thumbs-up-fill' };
    if (score >= 40) return { label: 'Fair Match',      color: 'warning',   icon: 'bi-check-circle-fill'   };
    return                   { label: 'Possible Match', color: 'secondary', icon: 'bi-circle-fill'          };
}

module.exports = { compute, tier, WEIGHTS, RANKS, CERTS, MIN_RANK_IDX };
