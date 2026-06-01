
const EVENT_TYPES = [
    { value: 'tournament',   label: 'Tournament' },
    { value: 'seminar',      label: 'Seminar' },
    { value: 'belt_testing', label: 'Belt Testing' },
    { value: 'camp',         label: 'Camp' },
    { value: 'other',        label: 'Other' }
];

const EVENT_STATUSES = [
    { value: 'draft',     label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
];

// Badge colour map for Bootstrap classes
const STATUS_BADGE = {
    draft:     'bg-secondary',
    published: 'bg-success',
    completed: 'bg-primary',
    cancelled: 'bg-danger'
};

module.exports = { EVENT_TYPES, EVENT_STATUSES, STATUS_BADGE };
