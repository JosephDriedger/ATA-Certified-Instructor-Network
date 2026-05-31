
class ServerMessages {
    static receivedRequest = "Received request for {0}";
    static serverListening = "Server is listening on port {0}";
    static serverStopped = "Server stopped on port {0}";
    static tooManyRequests = "Too many requests, please try again later.";
    static notAllowedByCORS = "Not allowed by CORS: {0}";
    static notFound = "404 Not Found: {0}";
}

module.exports = ServerMessages;
