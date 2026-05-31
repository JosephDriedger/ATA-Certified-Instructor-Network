
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class DatabaseHandler {
    static dbHandlers = [];

    constructor(privilege, host, user, password, database, waitforConnections = true, connectionLimit = 10, queueLimit = 0) {
        this.privilege = privilege;
        this.userPool = mysql.createPool({
            host,
            user,
            password,
            database,
            waitForConnections: waitforConnections,
            connectionLimit,
            queueLimit
        });
    }

    async fetchQuery(filePath) {
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error) {
            console.error(`Error reading query file at ${filePath}:`, error);
            throw error;
        }
    }

    async validatePermissions(userId) {
        const absolutePath = path.join(__dirname);
        try {
            const validateQuery = await this.fetchQuery(absolutePath);
            const [rows] = await this.userPool.query(validateQuery, [userId]);
            if (rows.length <= 0) {
                throw new Error('User not found or does not have permissions.');
            }

            const roleId = rows[0].ROLE_ID;
            return roleId;
        } catch (error) {
            console.error(`Error validating permissions for user ${userId}:`, error);
            throw error;
        }
    }

    async executeQuery(query, params = [], userId = undefined) {
        // Validate for Privileged Comanands
        const absolutePath = path.join(__dirname, query);

        if (this.privilege > 0) {
            try {
                const roleId = await this.validatePermissions(userId);

                if (!roleId || roleId < this.privilege) {
                    throw new Error('User does not have sufficient permissions to execute this command.');
                }
                
            } catch (error) {
                console.error(`Error validating permissions for user ${userId}:`, error);
                throw error;
            }
        }

        // Handle Commands
        try {
            const fetchedQuery = await this.fetchQuery(absolutePath);
            const results = await this.userPool.query(fetchedQuery, params);
            return results;
        } catch (error) {
            console.error(`Error executing admin query: ${error.message}`);
            throw error;
        }
    }

    static initializeDatabaseConnections(poolFields) {
        for (const fields of poolFields) {
            const { privilege, host, user, password, database, waitforConnections, connectionLimit, queueLimit } = fields;
            DatabaseHandler.dbHandlers.push(new DatabaseHandler(privilege, host, user, password, database, waitforConnections, connectionLimit, queueLimit));
        }
        console.log('Database connections initialized.');
    }

    static async endAllConnections() {
        try {
            for (const handler of DatabaseHandler.dbHandlers) {
                await handler.userPool.end();
            }
            console.log('All database connections closed.');
        } catch (error) {
            console.error('Error closing database connections:', error);
        }
    }
}

process.on('SIGINT', async () => {
    try {
        await DatabaseHandler.endAllConnections();
        console.log('Database connections closed.');
    } catch (error) {
        console.error('Error closing database connections:', error);
    }
    process.exit(0);
});

module.exports = DatabaseHandler;
