
const express   = require('express');
const pagePaths = require('../constants/pagePaths');
const router    = express.Router();

router.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render(pagePaths.homePage, {
        title: 'ATA Certified Instructor Network'
    });
});

module.exports = router;
