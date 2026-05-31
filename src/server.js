
// Library Imports
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const cors = require('cors');

// Module Imports
const Utils = require('./modules/utils');
const DatabaseHandler = require('./modules/database');

// Constant Imports
const StatusCodes = require('./constants/statusCodes');

// Route Imports
const homeRoutes = require('./routes/routes-home');
const notFound = require('./routes/routes-not-found');

// Message Imports
const ServerMessages = require('./lang/en/serverMessages');
const ErrorMessages = require('./lang/en/errorMessages');

class Server {
    // Private Values
    #port;
    #app;
    #server;
    #allowedOrigins;

    constructor(port) {
        // Ensure only one instance exists
        if (Server.instance)
            return Server.instance;

        // Configure App
        this.#allowedOrigins = [undefined, process.env.DEV_LINK, process.env.PROD_LINK, process.env.DEPLOY_LINK];
        this.#port = port;
        this.#app = express();
        this.#app.set("trust proxy", 1);

        // Configure Middleware
        this.#initializeMiddleware();
        
        // Configure Routes
        this.#initializeRoutes();

        // Cache Instance to Server class
        Server.instance = this;
    }

    // Initializes Server Middleware
    #initializeMiddleware() {
        this.#app.use(express.json());

        // Set EJS as templating engine
        this.#app.set('view engine', 'ejs');
        this.#app.use(expressLayouts);

        // CORS
        const corsOrigin = (origin, callback) => {
            if (this.#allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            const message = Utils.format(ServerMessages.notAllowedByCORS, origin);
            callback(new Error(message));
        };

        const corsErrResponse = (err, req, res, next) => {
            if (err.message.includes('CORS')) {
                Utils.httpResponse(res, StatusCodes.FORBIDDEN, err.message);
                return;
            }

            Utils.httpResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, ErrorMessages.internalServerError);
        };

        this.#app.use(cors({ origin: corsOrigin }));
        this.#app.use(corsErrResponse);

        // Serve Static Files
        this.#app.use(express.static(path.join(__dirname, './public')));

        // Ensure Express knows where to find views
        this.#app.set('views', path.join(__dirname, './views'));
    }

    // Initializes Server Routes
    #initializeRoutes() {
        this.#app.use('/', homeRoutes);
        this.#app.use(notFound);
    }

    // Start the Server
    start() {
        // Turn On Server
        this.#server = this.#app.listen(this.#port, () => {
            const message = Utils.format(ServerMessages.serverListening, this.#port);
            console.log(message);
        });

                // Initialize Database Connections
        const poolFields = [
            {
                privilege: UserPermissions.GUEST,
                host: process.env.DB_HOST,
                user: process.env.GUEST_DB_USER,
                password: process.env.GUEST_DB_PASSWORD,
                database: process.env.DB_NAME,
                waitforConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            }
        ];
        DatabaseHandler.initializeDatabaseConnections(poolFields);

        // Handle PM2 Stop Signals
        process.on('SIGINT', async () => {
            this.stop();
            try {
                await DatabaseHandler.endAllConnections();
                console.log('Database connections closed.');
            } catch (error) {
                console.error('Error closing database connections:', error);
            }
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            this.stop();
            try {
                await DatabaseHandler.endAllConnections();
                console.log('Database connections closed.');
            } catch (error) {
                console.error('Error closing database connections:', error);
            }
            process.exit(0);
        });
    }

    // Stop the Server
    stop() {
        // Turn Off Server
        if (this.#server) {
            this.#server.close(() => {
                const message = Utils.format(ServerMessages.serverStopped, this.#port);
                console.log(message);
            });

            return;
        }

        console.log(ErrorMessages.serverFailToStop);
    }
}

module.exports = Server;
