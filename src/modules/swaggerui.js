
const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0',
            description: 'API documentation for the application'
        },
        servers: [
            {
                url: 'http://localhost:3000/api'
            }
        ]
    },
    apis: ['./src/routes/*.js'] // Path to the API docs
};
const swaggerSpecs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerSpecs;
