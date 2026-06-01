
const mysql = require('mysql2/promise');

// Singleton MySQL pool shared by all models and the session store.
// pool.js is required AFTER dotenv.config() runs in index.js,
// so process.env vars are populated when this module first loads.
const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306', 10),
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:            'utf8mb4'
});

module.exports = pool;
