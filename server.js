/**
 * Database Metadata Monitoring and Analytics Service — Entry Point
 *
 * Refactored from the original 14-line monolithic "Hello, World!" HTTP server
 * into a modular entry point that:
 *   1. Imports centralized configuration (hostname, port) from src/config
 *   2. Initializes the SQLite database connection via src/db/connection
 *   3. Creates all four database table schemas via src/db/schema
 *   4. Starts the HTTP server with the central route dispatcher from src/routes
 *
 * The built-in Node.js `http` module remains the HTTP server foundation.
 * CommonJS module system (`require()` / `module.exports`) is used throughout.
 *
 * @module server
 */

'use strict';

// ---------------------------------------------------------------------------
// Core Node.js imports
// ---------------------------------------------------------------------------

/** Built-in HTTP module — retained from the original server.js (line 1). */
const http = require('http');

// ---------------------------------------------------------------------------
// Internal imports — modular components replacing inline logic
// ---------------------------------------------------------------------------

/**
 * Centralized server configuration constants.
 * Replaces the hardcoded hostname (line 3) and port (line 4) from original server.js.
 * @see src/config/index.js
 */
const config = require('./src/config');

/**
 * Database connection initializer — creates the data directory, opens the
 * SQLite database file, and enables WAL mode and foreign key PRAGMAs.
 * @see src/db/connection.js
 */
const { initializeDatabase } = require('./src/db/connection');

/**
 * Schema initializer — executes CREATE TABLE IF NOT EXISTS statements for
 * all four database tables (tables_metadata, query_execution_stats,
 * table_dependencies, schema_changes).
 * @see src/db/schema.js
 */
const { initializeSchema } = require('./src/db/schema');

/**
 * Central HTTP route dispatcher — replaces the original universal handler that
 * returned "Hello, World!" for every request. Routes incoming requests to
 * table-specific API endpoint handlers based on URL prefix matching.
 * @see src/routes/index.js
 */
const { handleRequest } = require('./src/routes');

// ---------------------------------------------------------------------------
// Database initialization — must complete before accepting HTTP requests
// ---------------------------------------------------------------------------

try {
  initializeDatabase();
  initializeSchema();
  console.log('Database initialized successfully');
} catch (err) {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP server creation — using route dispatcher instead of universal handler
// ---------------------------------------------------------------------------

/**
 * HTTP server instance using the central route dispatcher.
 * Replaces the original universal handler (lines 6–9 of original server.js)
 * that returned "Hello, World!\n" with text/plain for every request.
 */
const server = http.createServer(handleRequest);

// ---------------------------------------------------------------------------
// Server startup — binds to configured hostname and port
// ---------------------------------------------------------------------------

/**
 * Starts listening for incoming HTTP connections.
 * Uses hostname and port from the centralized config module instead of
 * the original hardcoded constants. The startup log message format is
 * preserved exactly as in the original server.js (line 13).
 */
server.listen(config.port, config.hostname, () => {
  console.log(`Server running at http://${config.hostname}:${config.port}/`);
});
