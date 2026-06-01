
// Library Imports
const express         = require('express');
const expressLayouts  = require('express-ejs-layouts');
const session         = require('express-session');
const MySQLStore      = require('express-mysql-session')(session);
const path            = require('path');
const cors            = require('cors');

// Module Imports
const Utils              = require('./modules/utils');
const DatabaseHandler    = require('./modules/database');
const pool               = require('./modules/pool');
const flashMiddleware    = require('./middleware/flashMiddleware');
const Notification       = require('./models/Notification');
const Conversation       = require('./models/Conversation');

// Constant Imports
const StatusCodes   = require('./constants/statusCodes');
const pagePaths     = require('./constants/pagePaths');

// Route Imports
const homeRoutes          = require('./routes/routes-home');
const authRoutes          = require('./routes/routes-auth');
const dashboardRoutes     = require('./routes/routes-dashboard');
const instructorRoutes    = require('./routes/routes-instructor');
const schoolRoutes        = require('./routes/routes-school');
const bookingRoutes       = require('./routes/routes-booking');
const notificationRoutes  = require('./routes/routes-notification');
const availabilityRoutes      = require('./routes/routes-availability');
const messageRoutes           = require('./routes/routes-messages');
const recommendationRoutes    = require('./routes/routes-recommendations');
const notFound                = require('./routes/routes-not-found');

// Message Imports
const ServerMessages = require('./lang/en/serverMessages');
const ErrorMessages  = require('./lang/en/errorMessages');

class Server {
    #port;
    #app;
    #server;
    #allowedOrigins;

    constructor(port) {
        if (Server.instance) return Server.instance;

        this.#allowedOrigins = [
            undefined,
            process.env.DEV_LINK,
            process.env.PROD_LINK,
            process.env.DEPLOY_LINK
        ];
        this.#port = port;
        this.#app  = express();
        this.#app.set('trust proxy', 1);

        this.#initializeMiddleware();
        this.#initializeRoutes();

        Server.instance = this;
    }

    #initializeMiddleware() {
        // Body parsing (json for API, urlencoded for HTML forms)
        this.#app.use(express.json());
        this.#app.use(express.urlencoded({ extended: true }));

        // View engine — EJS with express-ejs-layouts
        this.#app.set('view engine', 'ejs');
        this.#app.use(expressLayouts);
        this.#app.set('views', path.join(__dirname, './views'));
        this.#app.set('layout', 'layout');

        // CORS
        const corsOrigin = (origin, callback) => {
            if (this.#allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            callback(new Error(Utils.format(ServerMessages.notAllowedByCORS, origin)));
        };

        const corsErrResponse = (err, req, res, next) => {
            if (err.message.includes('CORS')) {
                return Utils.httpResponse(res, StatusCodes.FORBIDDEN, err.message);
            }
            Utils.httpResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, ErrorMessages.internalServerError);
        };

        this.#app.use(cors({ origin: corsOrigin }));
        this.#app.use(corsErrResponse);

        // Static files
        this.#app.use(express.static(path.join(__dirname, './public')));

        // Session — stored in MySQL via express-mysql-session
        const sessionStore = new MySQLStore(
            {
                createDatabaseTable: true,      // auto-create sessions table if absent
                clearExpired:        true,
                checkExpirationInterval: 15 * 60 * 1000,  // purge expired sessions every 15 min
                expiration: parseInt(process.env.SESSION_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000), 10)
            },
            pool  // reuse the shared mysql2 pool
        );

        this.#app.use(session({
            name:             'acin.sid',
            secret:           process.env.SESSION_SECRET || 'change-this-secret-in-production',
            store:            sessionStore,
            resave:           false,
            saveUninitialized: false,
            rolling:          true,  // reset cookie expiry on each active request
            cookie: {
                httpOnly:  true,
                secure:    process.env.NODE_ENV === 'production',
                maxAge:    parseInt(process.env.SESSION_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000), 10),
                sameSite:  'strict'
            }
        }));

        // Flash messages: read from session → res.locals, then clear from session
        this.#app.use(flashMiddleware);

        // Global view locals — available in every EJS template without explicit passing
        this.#app.use(async (req, res, next) => {
            if (req.session.userId) {
                res.locals.user = {
                    id:          req.session.userId,
                    roleId:      req.session.roleId,
                    roleName:    req.session.roleName,
                    roleLabel:   req.session.roleLabel,
                    displayName: req.session.displayName
                };
                // Unread notification count drives the navbar bell badge.
                // Errors are swallowed so a DB hiccup never breaks a page render.
                try {
                    const [nCount, mCount] = await Promise.all([
                        Notification.getUnreadCount(req.session.userId),
                        Conversation.getUnreadCount(req.session.userId)
                    ]);
                    res.locals.unreadNotificationCount = nCount;
                    res.locals.unreadMessageCount      = mCount;
                } catch {
                    res.locals.unreadNotificationCount = 0;
                    res.locals.unreadMessageCount      = 0;
                }
            } else {
                res.locals.user                    = null;
                res.locals.unreadNotificationCount = 0;
                res.locals.unreadMessageCount      = 0;
            }

            res.locals.currentPath         = req.path;
            res.locals.title               = 'ACIN';
            res.locals.pageStylesheet      = null;
            res.locals.pageScript          = null;
            next();
        });
    }

    #initializeRoutes() {
        this.#app.use('/',          homeRoutes);
        this.#app.use('/',          authRoutes);
        this.#app.use('/',          instructorRoutes);
        this.#app.use('/',          schoolRoutes);
        this.#app.use('/',          bookingRoutes);
        this.#app.use('/',          notificationRoutes);
        this.#app.use('/',          availabilityRoutes);
        this.#app.use('/',          messageRoutes);
        this.#app.use('/',          recommendationRoutes);
        this.#app.use('/dashboard', dashboardRoutes);

        // Global error handler
        this.#app.use((err, req, res, next) => {
            console.error(err);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).render(pagePaths.error500Page, {
                title: 'Server Error'
            });
        });

        // 404 — must be last
        this.#app.use(notFound);
    }

    start() {
        this.#server = this.#app.listen(this.#port, () => {
            console.log(Utils.format(ServerMessages.serverListening, this.#port));
        });

        // Initialize the privilege-based DatabaseHandler pools.
        // Privilege 0 = default query pool (maps to DB_USER).
        DatabaseHandler.initializeDatabaseConnections([
            {
                privilege:        0,
                host:             process.env.DB_HOST     || 'localhost',
                user:             process.env.DB_USER,
                password:         process.env.DB_PASSWORD,
                database:         process.env.DB_NAME,
                waitForConnections: true,
                connectionLimit:  10,
                queueLimit:       0
            }
        ]);

        const shutdown = async (signal) => {
            console.log(`${signal} received — shutting down.`);
            this.stop();
            try {
                await DatabaseHandler.endAllConnections();
                await pool.end();
                console.log('Database connections closed.');
            } catch (err) {
                console.error('Error closing database connections:', err);
            }
            process.exit(0);
        };

        process.on('SIGINT',  () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    stop() {
        if (this.#server) {
            this.#server.close(() => {
                console.log(Utils.format(ServerMessages.serverStopped, this.#port));
            });
            return;
        }
        console.log(ErrorMessages.serverFailToStop);
    }
}

module.exports = Server;
