
const express = require('express');
const pagePaths = require('../constants/pagePaths');
const router = express.Router();

router.get('/', (req, res) => {
    res.render(pagePaths.homePage, {
       title: 'Home',
       pageStylesheet: '/css/pages/home.css',
       pageScript: '/js/pages/home.js'
    });
});

module.exports = router;
