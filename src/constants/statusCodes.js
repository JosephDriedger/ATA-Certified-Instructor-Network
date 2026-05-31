
class StatusCodes {
    // Success Codes
    static OK = 200;
    static CREATED = 201;
    static ACCEPTED = 202;
    static NO_CONTENT = 204;

    // Redirection Codes
    static MOVED_PERMANENTLY = 301;
    static FOUND = 302;
    static NOT_MODIFIED = 304;

    // Client Errors
    static BAD_REQUEST = 400;
    static UNAUTHORIZED = 401;
    static FORBIDDEN = 403;
    static NOT_FOUND = 404;
    static METHOD_NOT_ALLOWED = 405;
    static REQUEST_TIMEOUT = 408;
    static TOO_MANY_REQUESTS = 429;

    // Server Errors
    static INTERNAL_SERVER_ERROR = 500;
    static NOT_IMPLEMENTED = 501;
    static BAD_GATEWAY = 502;
    static SERVICE_UNAVAILABLE = 503;
    static GATEWAY_TIMEOUT = 504;
}

module.exports = StatusCodes;
