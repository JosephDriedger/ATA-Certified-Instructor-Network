
class Utils {
    static format(str, ...args) {
        return str.replace(/{(\d+)}/g, (match, number) => {
            const index = parseInt(number, 10);
            return typeof args[index] !== 'undefined' ? args[index] : match;
        });
    }

    static httpResponse(res, statusCode, message, data = {}) {
        res.status(statusCode).json({
            message: message,
            data: data
        });
    }
}

module.exports = Utils;
