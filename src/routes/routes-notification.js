
const express                  = require('express');
const NotificationController   = require('../controllers/notificationController');
const { requireAuth }          = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/notifications', requireAuth, NotificationController.index);

module.exports = router;
