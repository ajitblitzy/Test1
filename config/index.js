'use strict';

/**
 * Centralized configuration module.
 *
 * Reads environment variables exactly once at require() time and exports
 * a frozen (immutable) configuration object consumed by all other modules
 * in the application. No re-reading or dynamic updates occur after initial load.
 *
 * Environment Variables:
 *   HOST              - Network interface to bind to (default: '127.0.0.1')
 *   PORT              - TCP port to listen on (default: 3000)
 *   ENABLE_CLUSTERING - Enable multi-core clustering via the cluster module (default: false)
 *   LOG_LEVEL         - Logging verbosity level: 'silent' | 'error' | 'warn' | 'info' (default: 'info')
 *
 * @module config
 */

/**
 * Application configuration object.
 *
 * @type {Readonly<{host: string, port: number, enableClustering: boolean, logLevel: string}>}
 *
 * @property {string}  host             - Network interface address for the HTTP server to bind to.
 *                                        Sourced from process.env.HOST, defaults to '127.0.0.1'.
 * @property {number}  port             - TCP port number for the HTTP server to listen on.
 *                                        Sourced from process.env.PORT, parsed as base-10 integer,
 *                                        defaults to 3000. Non-numeric values fall back to 3000.
 *                                        PORT=0 is preserved (OS auto-assigns an available port).
 * @property {boolean} enableClustering - Whether to fork worker processes for multi-core utilization.
 *                                        Sourced from process.env.ENABLE_CLUSTERING, only 'true'
 *                                        (case-sensitive) enables clustering; all other values
 *                                        resolve to false.
 * @property {string}  logLevel         - Minimum severity level for log output.
 *                                        Sourced from process.env.LOG_LEVEL, defaults to 'info'.
 */
/* Parse PORT with explicit NaN check to preserve PORT=0 (OS auto-assign) */
const parsedPort = parseInt(process.env.PORT, 10);

const config = Object.freeze({
  host: process.env.HOST || '127.0.0.1',
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
  enableClustering: process.env.ENABLE_CLUSTERING === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
});

module.exports = config;
