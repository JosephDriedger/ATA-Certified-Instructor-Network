
const express                    = require('express');
const RecommendationController   = require('../controllers/recommendationController');
const { requireAuth }            = require('../middleware/authMiddleware');
const { requireMinRole }         = require('../middleware/roleMiddleware');
const { Roles }                  = require('../constants/roles');

const router = express.Router();

router.get(
    '/events/:id/recommendations',
    requireAuth,
    requireMinRole(Roles.SCHOOL_OWNER),
    RecommendationController.index
);

module.exports = router;
