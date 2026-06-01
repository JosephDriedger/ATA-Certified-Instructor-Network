
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

class DatabaseHandler {
    static dbHandlers = [];

    constructor(privilege, host, user, password, database, waitForConnections = true, connectionLimit = 10, queueLimit = 0) {
        this.privilege = privilege;
        this.userPool  = mysql.createPool({
            host,
            user,
            password,
            database,
            waitForConnections,
            connectionLimit,
            queueLimit
        });
    }

    // Returns the underlying mysql2 pool for the given privilege level.
    // Models use this to run queries directly without going through the
    // privilege-validation layer (which is for admin/privileged CLI queries).
    static getPool(privilege = 0) {
        const handler = DatabaseHandler.dbHandlers.find(h => h.privilege === privilege);
        if (!handler) throw new Error(`No database pool registered for privilege level ${privilege}.`);
        return handler.userPool;
    }

    // Reads a SQL file from disk. Uses fs.promises so it is properly awaitable.
    async fetchQuery(filePath) {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            console.error(`Error reading query file at ${filePath}:`, error);
            throw error;
        }
    }

    async validatePermissions(userId) {
        const absolutePath = path.join(__dirname, 'queries', 'auth', 'validatePermissions.sql');
        try {
            const validateQuery = await this.fetchQuery(absolutePath);
            const [rows] = await this.userPool.query(validateQuery, [userId]);
            if (rows.length <= 0) throw new Error('User not found or insufficient permissions.');
            return rows[0].ROLE_ID;
        } catch (error) {
            console.error(`Error validating permissions for user ${userId}:`, error);
            throw error;
        }
    }

    async executeQuery(queryRelativePath, params = [], userId = undefined) {
        const absolutePath = path.join(__dirname, queryRelativePath);

        if (this.privilege > 0) {
            const roleId = await this.validatePermissions(userId);
            if (!roleId || roleId < this.privilege) {
                throw new Error('User does not have sufficient permissions to execute this query.');
            }
        }

        const sql     = await this.fetchQuery(absolutePath);
        const results = await this.userPool.query(sql, params);
        return results;
    }

    static initializeDatabaseConnections(poolFields) {
        for (const fields of poolFields) {
            const { privilege, host, user, password, database, waitForConnections, connectionLimit, queueLimit } = fields;
            DatabaseHandler.dbHandlers.push(
                new DatabaseHandler(privilege, host, user, password, database, waitForConnections, connectionLimit, queueLimit)
            );
        }
        console.log(`Database connections initialized (${poolFields.length} pool(s)).`);
    }

    static async endAllConnections() {
        for (const handler of DatabaseHandler.dbHandlers) {
            await handler.userPool.end();
        }
        console.log('All database connections closed.');
    }
}

module.exports = DatabaseHandler;
