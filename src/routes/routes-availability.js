
const express                  = require('express');
const AvailabilityController   = require('../controllers/availabilityController');
const { requireAuth }          = require('../middleware/authMiddleware');
const { requireMinRole }       = require('../middleware/roleMiddleware');
const { Roles }                = require('../constants/roles');

const router = express.Router();

// Any authenticated user can manage their own availability calendar.
// School owners who also act as instructors need this too.
const guard = [requireAuth, requireMinRole(Roles.INSTRUCTOR)];

router.get('/availability',          ...guard, AvailabilityController.calendar);
router.post('/availability/bulk',    ...guard, AvailabilityController.bulkSet);
router.post('/availability',         ...guard, AvailabilityController.setDay);
router.delete('/availability/:date', ...guard, AvailabilityController.clearDay);

module.exports = router;
