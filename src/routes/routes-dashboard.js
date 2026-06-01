
const express              = require('express');
const { requireAuth }      = require('../middleware/authMiddleware');
const DashboardController  = require('../controllers/dashboardController');

const router = express.Router();

router.use(requireAuth);

router.get('/', DashboardController.index);

module.exports = router;
