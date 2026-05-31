
const StatusCodes = require("../constants/statusCodes");
const ServerMessages = require("../lang/en/serverMessages");
const Utils = require("../modules/utils");

const notFound = (req, res) => {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const message = Utils.format(ServerMessages.notFound, fullUrl);
    Utils.httpResponse(res, StatusCodes.NOT_FOUND, message);
};

module.exports = notFound;
