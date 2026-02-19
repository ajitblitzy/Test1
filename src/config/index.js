/**
 * Centralized Configuration Module
 *
 * Externalizes server and database configuration constants that were
 * originally hardcoded in server.js (lines 3–4) into a dedicated,
 * reusable module. All configuration values are plain JavaScript
 * constants — no environment variables or .env files are used.
 *
 * Consumers:
 *   - server.js: imports hostname and port for HTTP server binding
 *   - src/db/connection.js: imports dbPath for SQLite file location
 */

'use strict';

/**
 * Server hostname — loopback address for local binding.
 * Extracted from original server.js line 3.
 * @type {string}
 */
const hostname = '127.0.0.1';

/**
 * Server port number.
 * Extracted from original server.js line 4.
 * @type {number}
 */
const port = 3000;

/**
 * File path for the SQLite database.
 * The data/ directory will be auto-created by src/db/connection.js
 * if it does not already exist.
 * @type {string}
 */
const dbPath = './data/metadata.db';

module.exports = { hostname, port, dbPath };
