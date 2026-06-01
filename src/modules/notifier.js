
// Thin wrapper around Notification.create() for each booking lifecycle event.
// Keeps all notification copy in one place so it's easy to update later.
// Errors are swallowed — a failed notification must never break the main action.

const Notification = require('../models/Notification');

const safe = (fn) => fn().catch(err => console.error('[notifier]', err.message));

const notifier = {

    // School owner sent a request → notify instructor
    judgeRequestReceived(instructorUserId, requestId, schoolName) {
        return safe(() => Notification.create({
            userId:        instructorUserId,
            type:          'judge_request_received',
            title:         `New judge request from ${schoolName}`,
            body:          `${schoolName} has sent you a guest judge request. Open it to review the details and respond.`,
            referenceType: 'judge_request',
            referenceId:   requestId
        }));
    },

    // Instructor accepted → notify school owner
    judgeRequestAccepted(schoolOwnerId, requestId, instructorName) {
        return safe(() => Notification.create({
            userId:        schoolOwnerId,
            type:          'judge_request_accepted',
            title:         `${instructorName} accepted your judge request`,
            body:          `${instructorName} has confirmed they will attend as a guest judge.`,
            referenceType: 'judge_request',
            referenceId:   requestId
        }));
    },

    // Instructor declined → notify school owner
    judgeRequestDeclined(schoolOwnerId, requestId, instructorName) {
        return safe(() => Notification.create({
            userId:        schoolOwnerId,
            type:          'judge_request_declined',
            title:         `${instructorName} declined your judge request`,
            body:          `${instructorName} is unable to attend. You can send a request to another instructor.`,
            referenceType: 'judge_request',
            referenceId:   requestId
        }));
    },

    // School owner cancelled an accepted booking → notify instructor
    judgeRequestCancelled(instructorUserId, requestId, schoolName) {
        return safe(() => Notification.create({
            userId:        instructorUserId,
            type:          'judge_request_cancelled',
            title:         `${schoolName} cancelled a judge request`,
            body:          `${schoolName} has cancelled a judge request you previously accepted. Please check your schedule.`,
            referenceType: 'judge_request',
            referenceId:   requestId
        }));
    },

    // Direct message sent → notify recipient
    newMessage(recipientId, conversationId, senderName) {
        return safe(() => Notification.create({
            userId:        recipientId,
            type:          'new_message',
            title:         `New message from ${senderName}`,
            body:          null,
            referenceType: 'message',
            referenceId:   conversationId
        }));
    }
};

module.exports = notifier;
