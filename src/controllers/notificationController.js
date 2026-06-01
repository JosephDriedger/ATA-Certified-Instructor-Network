
const Notification = require('../models/Notification');

// Reference-type → URL mapping so "View" links go to the right page.
const referenceUrl = (type, id) => {
    if (!id) return null;
    const map = {
        judge_request: `/bookings/${id}`,
        event:         `/events/${id}`,
        message:       `/messages/${id}`,
        certification: `/admin/certifications/${id}`
    };
    return map[type] ?? null;
};

class NotificationController {

    // ── GET /notifications ────────────────────────────────────────────────────
    static async index(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page || '1', 10));
            const data = await Notification.getByUser(req.session.userId, { page, limit: 20 });

            // Mark all as read when the page is visited
            await Notification.markAllRead(req.session.userId);

            const withLinks = data.notifications.map(n => ({
                ...n,
                href: referenceUrl(n.reference_type, n.reference_id)
            }));

            res.render('pages/notification/index', {
                title:         'Notifications',
                notifications: withLinks,
                total:         data.total,
                page:          data.page,
                totalPages:    data.totalPages
            });
        } catch (err) { next(err); }
    }
}

module.exports = NotificationController;
