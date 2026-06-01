
const InstructorProfile = require('../models/InstructorProfile');
const Availability      = require('../models/Availability');

// Validate that a string is a real calendar date in YYYY-MM-DD format.
const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Clamp year/month to a reasonable range so the calendar can't be navigated
// to nonsensical dates.
const clampMonth = (year, month) => {
    const now  = new Date();
    let y = parseInt(year,  10) || now.getFullYear();
    let m = parseInt(month, 10) || (now.getMonth() + 1);
    if (m < 1)  { y--; m = 12; }
    if (m > 12) { y++; m = 1;  }
    // Don't allow navigating more than 2 years in either direction
    const minY = now.getFullYear() - 1;
    const maxY = now.getFullYear() + 2;
    y = Math.max(minY, Math.min(maxY, y));
    return { year: y, month: m };
};

class AvailabilityController {

    // ── GET /availability ─────────────────────────────────────────────────────
    // Main calendar management page.  Data is server-rendered; JS only handles
    // the click interactions (day selection + AJAX status updates).
    static async calendar(req, res, next) {
        try {
            const profile = await InstructorProfile.findByUserId(req.session.userId);
            if (!profile) {
                req.session.flash = { type: 'warning', message: 'Complete your instructor profile before managing availability.' };
                return res.redirect('/profile/instructor');
            }

            const { year, month } = clampMonth(req.query.year, req.query.month);
            const availabilityMap = await Availability.getMonthEntries(profile.id, year, month);
            const today           = new Date().toISOString().split('T')[0];

            res.render('pages/availability/index', {
                title: 'Availability Calendar',
                profile,
                year,
                month,
                availabilityMap,
                today,
                pageScript: '/js/calendar.js'
            });
        } catch (err) { next(err); }
    }

    // ── POST /availability  (AJAX — single day) ───────────────────────────────
    static async setDay(req, res, next) {
        try {
            const profile = await InstructorProfile.findByUserId(req.session.userId);
            if (!profile) return res.status(403).json({ ok: false, error: 'Forbidden.' });

            const { date, isAvailable, startTime, endTime, notes } = req.body;

            if (!isValidDate(date)) {
                return res.status(400).json({ ok: false, error: 'Invalid date.' });
            }

            await Availability.setDate(
                profile.id,
                date,
                Boolean(isAvailable),
                { startTime: startTime || null, endTime: endTime || null, notes: notes || null }
            );

            res.json({ ok: true });
        } catch (err) { next(err); }
    }

    // ── POST /availability/bulk  (AJAX — multiple days) ───────────────────────
    // Body: { dates: string[], isAvailable: boolean | null }
    // When isAvailable === null the dates are cleared (explicit entry removed).
    static async bulkSet(req, res, next) {
        try {
            const profile = await InstructorProfile.findByUserId(req.session.userId);
            if (!profile) return res.status(403).json({ ok: false, error: 'Forbidden.' });

            const { dates, isAvailable } = req.body;

            if (!Array.isArray(dates) || dates.length === 0) {
                return res.status(400).json({ ok: false, error: 'No dates provided.' });
            }

            // Whitelist: must be valid YYYY-MM-DD, not in the past
            const today     = new Date().toISOString().split('T')[0];
            const validDates = dates.filter(d => isValidDate(d) && d >= today);

            if (validDates.length === 0) {
                return res.status(400).json({ ok: false, error: 'No valid future dates.' });
            }

            if (isAvailable === null || isAvailable === undefined) {
                await Availability.clearDates(profile.id, validDates);
            } else {
                await Availability.setDates(profile.id, validDates, Boolean(isAvailable));
            }

            res.json({ ok: true, updated: validDates.length });
        } catch (err) { next(err); }
    }

    // ── DELETE /availability/:date  (AJAX — single day) ──────────────────────
    static async clearDay(req, res, next) {
        try {
            const profile = await InstructorProfile.findByUserId(req.session.userId);
            if (!profile) return res.status(403).json({ ok: false, error: 'Forbidden.' });

            const { date } = req.params;
            if (!isValidDate(date)) {
                return res.status(400).json({ ok: false, error: 'Invalid date.' });
            }

            await Availability.clearDate(profile.id, date);
            res.json({ ok: true });
        } catch (err) { next(err); }
    }
}

module.exports = AvailabilityController;
