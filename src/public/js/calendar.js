/**
 * ACIN Availability Calendar — vanilla JS
 *
 * Interactions:
 *   Click a day cell  → toggle selection (multi-select)
 *   Set Available     → POST /availability/bulk { dates, isAvailable: true }
 *   Block Date(s)     → POST /availability/bulk { dates, isAvailable: false }
 *   Clear to Default  → POST /availability/bulk { dates, isAvailable: null }
 *   Bulk Range form   → expands the date range into individual dates, then same API
 */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────

    const selected = new Set();

    // ── DOM refs ──────────────────────────────────────────────────────────────

    const grid           = document.getElementById('calendarGrid');
    const actionBar      = document.getElementById('actionBar');
    const selectedCount  = document.getElementById('selectedCount');
    const pluralS        = document.getElementById('pluralS');
    const setAvailBtn    = document.getElementById('setAvailableBtn');
    const setBlockedBtn  = document.getElementById('setBlockedBtn');
    const clearSelBtn    = document.getElementById('clearSelectionBtn');
    const cancelBtn      = document.getElementById('cancelBtn');
    const bulkForm       = document.getElementById('bulkRangeForm');
    const rangeError     = document.getElementById('rangeError');
    const rangeSuccess   = document.getElementById('rangeSuccess');

    // ── Helpers ───────────────────────────────────────────────────────────────

    function updateActionBar() {
        const n = selected.size;
        selectedCount.textContent = n;
        pluralS.textContent       = n === 1 ? '' : 's';
        actionBar.classList.toggle('d-none', n === 0);
    }

    function setCellState(cell, state) {
        // state: 'available' | 'blocked' | 'default'
        cell.classList.remove('cal-available', 'cal-blocked', 'cal-default', 'selected');

        let badge = cell.querySelector('.badge');
        if (!badge) {
            badge = document.createElement('span');
            cell.appendChild(badge);
        }

        if (state === 'available') {
            cell.classList.add('cal-available');
            badge.className   = 'badge bg-success fw-normal mt-1';
            badge.textContent = 'Available';
            badge.style.fontSize = '.6rem';
        } else if (state === 'blocked') {
            cell.classList.add('cal-blocked');
            badge.className   = 'badge bg-danger fw-normal mt-1';
            badge.textContent = 'Blocked';
            badge.style.fontSize = '.6rem';
        } else {
            cell.classList.add('cal-default');
            if (badge.parentNode === cell) cell.removeChild(badge);
        }
    }

    async function postBulk(dates, isAvailable) {
        const res  = await fetch('/availability/bulk', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ dates, isAvailable })
        });
        return res.json();
    }

    function clearAllSelections() {
        selected.forEach(d => {
            const cell = grid.querySelector(`[data-date="${d}"]`);
            if (cell) cell.classList.remove('selected');
        });
        selected.clear();
        updateActionBar();
    }

    // Expand a [from, to] date range into an array of YYYY-MM-DD strings.
    function expandDateRange(from, to) {
        const dates = [];
        const cur   = new Date(from + 'T12:00:00');
        const end   = new Date(to   + 'T12:00:00');
        while (cur <= end) {
            dates.push(cur.toISOString().split('T')[0]);
            cur.setDate(cur.getDate() + 1);
        }
        return dates;
    }

    // ── Day cell click (toggle selection) ────────────────────────────────────

    grid.querySelectorAll('.cal-day:not(.cal-past)').forEach(cell => {
        cell.addEventListener('click', () => {
            const date = cell.dataset.date;
            if (selected.has(date)) {
                selected.delete(date);
                cell.classList.remove('selected');
            } else {
                selected.add(date);
                cell.classList.add('selected');
            }
            updateActionBar();
        });
    });

    // ── Action bar buttons ────────────────────────────────────────────────────

    setAvailBtn.addEventListener('click', async () => {
        const dates = [...selected];
        try {
            const data = await postBulk(dates, true);
            if (data.ok) {
                dates.forEach(d => {
                    const cell = grid.querySelector(`[data-date="${d}"]`);
                    if (cell) setCellState(cell, 'available');
                });
                clearAllSelections();
            }
        } catch (e) { console.error('Availability update failed:', e); }
    });

    setBlockedBtn.addEventListener('click', async () => {
        const dates = [...selected];
        try {
            const data = await postBulk(dates, false);
            if (data.ok) {
                dates.forEach(d => {
                    const cell = grid.querySelector(`[data-date="${d}"]`);
                    if (cell) setCellState(cell, 'blocked');
                });
                clearAllSelections();
            }
        } catch (e) { console.error('Availability update failed:', e); }
    });

    clearSelBtn.addEventListener('click', async () => {
        const dates = [...selected];
        try {
            const data = await postBulk(dates, null);
            if (data.ok) {
                dates.forEach(d => {
                    const cell = grid.querySelector(`[data-date="${d}"]`);
                    if (cell) setCellState(cell, 'default');
                });
                clearAllSelections();
            }
        } catch (e) { console.error('Availability clear failed:', e); }
    });

    cancelBtn.addEventListener('click', clearAllSelections);

    // ── Bulk Range form ───────────────────────────────────────────────────────

    bulkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        rangeError.classList.add('d-none');
        rangeSuccess.classList.add('d-none');

        const from   = document.getElementById('rangeFrom').value;
        const to     = document.getElementById('rangeTo').value;
        const status = document.getElementById('rangeStatus').value;

        if (!from || !to) {
            rangeError.textContent = 'Please select both a start and end date.';
            rangeError.classList.remove('d-none');
            return;
        }
        if (from > to) {
            rangeError.textContent = '"From" date must be before or equal to "To" date.';
            rangeError.classList.remove('d-none');
            return;
        }

        const dates = expandDateRange(from, to);
        if (dates.length > 366) {
            rangeError.textContent = 'Date range cannot exceed one year (366 days).';
            rangeError.classList.remove('d-none');
            return;
        }

        const isAvailable = status === 'available' ? true
                          : status === 'blocked'   ? false
                          : null;

        try {
            const data = await postBulk(dates, isAvailable);
            if (data.ok) {
                // Update visible cells in this month's calendar
                const state = status === 'available' ? 'available'
                            : status === 'blocked'   ? 'blocked'
                            : 'default';
                dates.forEach(d => {
                    const cell = grid.querySelector(`[data-date="${d}"]`);
                    if (cell) setCellState(cell, state);
                });

                rangeSuccess.textContent = `Updated ${data.updated ?? dates.length} date(s).`;
                rangeSuccess.classList.remove('d-none');
                bulkForm.reset();
            }
        } catch (err) {
            rangeError.textContent = 'Something went wrong. Please try again.';
            rangeError.classList.remove('d-none');
        }
    });

})();
