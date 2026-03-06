'use strict';

/**
 * Application Entry Point
 *
 * Thin bootstrapper that delegates all application logic to the src/ layer.
 * This file's sole responsibility is to import and invoke the startServer()
 * function from src/app.js, which composes the HTTP server with middleware,
 * binds to the configured host/port, and registers graceful shutdown handlers.
 *
 * Startup command: node server.js
 */

const { startServer } = require('./src/app');

startServer();
