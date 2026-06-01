
const Conversation  = require('../models/Conversation');
const Message       = require('../models/Message');
const User          = require('../models/User');
const StatusCodes   = require('../constants/statusCodes');
const notifier      = require('../modules/notifier');

const MAX_BODY = 5000;

class MessageController {

    // ── GET /messages ─────────────────────────────────────────────────────────
    static async inbox(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page || '1', 10));
            const data = await Conversation.findByUser(req.session.userId, { page, limit: 25 });

            res.render('pages/messages/inbox', {
                title: 'Messages',
                ...data
            });
        } catch (err) { next(err); }
    }

    // ── GET /messages/compose ─────────────────────────────────────────────────
    // Accepts ?userId=X to pre-fill a recipient.
    // If a conversation already exists between the two users, redirects to it.
    static async composeForm(req, res, next) {
        try {
            const recipientId = parseInt(req.query.userId || '0', 10);

            if (!recipientId) {
                return res.render('pages/messages/compose', {
                    title:     'New Message',
                    recipient: null,
                    errors:    {},
                    formData:  {}
                });
            }

            if (recipientId === req.session.userId) {
                req.session.flash = { type: 'warning', message: 'You cannot send a message to yourself.' };
                return res.redirect('/messages');
            }

            // Reuse existing conversation rather than creating a duplicate
            const existingId = await Conversation.findBetween(req.session.userId, recipientId);
            if (existingId) return res.redirect(`/messages/${existingId}`);

            const recipient = await User.findById(recipientId);
            if (!recipient) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', { title: 'User Not Found' });
            }

            res.render('pages/messages/compose', {
                title:     `Message ${recipient.first_name} ${recipient.last_name}`,
                recipient,
                errors:    {},
                formData:  {}
            });
        } catch (err) { next(err); }
    }

    // ── POST /messages — start a new conversation ─────────────────────────────
    static async send(req, res, next) {
        try {
            const recipientId = parseInt(req.body.recipientId || '0', 10);
            const body        = (req.body.body    || '').trim();
            const subject     = (req.body.subject || '').trim().slice(0, 255);

            const renderCompose = async (errors) => {
                const recipient = recipientId ? await User.findById(recipientId) : null;
                return res.render('pages/messages/compose', {
                    title:     'New Message',
                    recipient,
                    errors,
                    formData:  req.body
                });
            };

            if (!recipientId || recipientId === req.session.userId) {
                return renderCompose({ recipientId: 'A valid recipient is required.' });
            }
            if (!body) {
                return renderCompose({ body: 'Message cannot be empty.' });
            }
            if (body.length > MAX_BODY) {
                return renderCompose({ body: `Message must be ${MAX_BODY.toLocaleString()} characters or less.` });
            }

            // Find or create the conversation
            let conversationId = await Conversation.findBetween(req.session.userId, recipientId);
            if (!conversationId) {
                conversationId = await Conversation.create({
                    participantOneId: req.session.userId,
                    participantTwoId: recipientId,
                    subject
                });
            }

            await Message.send({ conversationId, senderId: req.session.userId, body });
            await notifier.newMessage(recipientId, conversationId, req.session.displayName);

            res.redirect(`/messages/${conversationId}`);
        } catch (err) { next(err); }
    }

    // ── GET /messages/:id ─────────────────────────────────────────────────────
    static async show(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);

            if (!(await Conversation.isParticipant(id, req.session.userId))) {
                return res.status(StatusCodes.NOT_FOUND).render('pages/errors/404', {
                    title: 'Conversation Not Found'
                });
            }

            const [conv, messages] = await Promise.all([
                Conversation.findById(id, req.session.userId),
                Message.getThread(id, req.session.userId),
                Message.markThreadRead(id, req.session.userId)  // runs in parallel; return value ignored
            ]);

            res.render('pages/messages/thread', {
                title:        conv.subject || `Conversation with ${conv.other_first} ${conv.other_last}`,
                conversation: conv,
                messages,
                userId:       req.session.userId
            });
        } catch (err) { next(err); }
    }

    // ── POST /messages/:id/reply ──────────────────────────────────────────────
    static async reply(req, res, next) {
        try {
            const id   = parseInt(req.params.id, 10);
            const body = (req.body.body || '').trim();

            if (!(await Conversation.isParticipant(id, req.session.userId))) {
                return res.status(StatusCodes.FORBIDDEN).render('pages/errors/403', { title: 'Forbidden' });
            }

            if (!body) {
                req.session.flash = { type: 'error', message: 'Reply cannot be empty.' };
                return res.redirect(`/messages/${id}`);
            }
            if (body.length > MAX_BODY) {
                req.session.flash = { type: 'error', message: `Message must be ${MAX_BODY.toLocaleString()} characters or less.` };
                return res.redirect(`/messages/${id}`);
            }

            await Message.send({ conversationId: id, senderId: req.session.userId, body });

            // Notify the other participant
            const conv        = await Conversation.findById(id);
            const recipientId = conv.participant_one_id === req.session.userId
                ? conv.participant_two_id
                : conv.participant_one_id;

            await notifier.newMessage(recipientId, id, req.session.displayName);

            res.redirect(`/messages/${id}#bottom`);
        } catch (err) { next(err); }
    }
}

module.exports = MessageController;
