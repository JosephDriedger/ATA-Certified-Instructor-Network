
// Load the environment-specific .env file.
// cross-env sets NODE_ENV before this process starts, so the correct
// file is always selected:
//   npm run dev   → loads .env.development
//   npm start     → loads .env.production
const env  = process.env.NODE_ENV || 'development';
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '..', `.env.${env}`)
});

const PORT   = process.env.PORT || 3000;
const Server = require('./server');

const server = new Server(PORT);
server.start();
