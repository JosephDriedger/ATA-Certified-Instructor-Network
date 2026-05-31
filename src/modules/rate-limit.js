
const rateLimit = require('express-rate-limit');
const StatusCodes = require('../constants/statusCodes');

// Module Imports
const Utils = require('./utils');

// Message Imports
const ServerMessages = require('../lang/en/serverMessages');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
    handler: (req, res) => Utils.httpResponse(res, StatusCodes.TOO_MANY_REQUESTS, ServerMessages.tooManyRequests)
});

module.exports = limiter;
