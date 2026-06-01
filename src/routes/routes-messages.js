
const express           = require('express');
const MessageController = require('../controllers/messageController');
const { requireAuth }   = require('../middleware/authMiddleware');

const router    = express.Router();
const authGuard = [requireAuth];

// IMPORTANT: /messages/compose must be declared before /messages/:id so Express
// does not attempt to parse 'compose' as a numeric ID.
router.get('/messages',             ...authGuard, MessageController.inbox);
router.get('/messages/compose',     ...authGuard, MessageController.composeForm);
router.post('/messages',            ...authGuard, MessageController.send);
router.get('/messages/:id',         ...authGuard, MessageController.show);
router.post('/messages/:id/reply',  ...authGuard, MessageController.reply);

module.exports = router;
