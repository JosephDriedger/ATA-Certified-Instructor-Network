
const StatusCodes   = require('../constants/statusCodes');
const pagePaths     = require('../constants/pagePaths');

const notFound = (req, res) => {
    res.status(StatusCodes.NOT_FOUND).render(pagePaths.error404Page, {
        title: 'Page Not Found'
    });
};

module.exports = notFound;
