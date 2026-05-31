
require('dotenv').config();

const PORT = process.env.NODE_ENV === 'production' ? process.env.PROD_PORT : process.env.DEV_PORT || 3000;
const Server = require('./server');

const server = new Server(PORT);

server.start();
