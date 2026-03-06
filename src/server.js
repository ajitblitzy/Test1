'use strict';

/**
 * HTTP Server Creation & Binding Logic
 *
 * Encapsulates the HTTP server creation factory, error handling, and timeout
 * configuration. Extracted from the original monolithic server.js to follow
 * the Single Responsibility Principle — this module owns only server
 * instantiation and error lifecycle, not request handling or application
 * bootstrap.
 *
 * The createServer() factory returns a configured http.Server instance
 * without calling server.listen(), enabling testability — callers (app.js)
 * control when and where the server binds.
 *
 * @module src/server
 */

const http = require('http');
const { logger } = require('./utils/logger');

/**
 * Default keep-alive timeout in milliseconds.
 * Set to 65 000 ms — slightly above the common 60 s default used by
 * AWS ALB, nginx, and other reverse proxies, preventing premature
 * connection resets behind a load balancer.
 *
 * @constant {number}
 */
const KEEP_ALIVE_TIMEOUT_MS = 65000;

/**
 * Default headers timeout in milliseconds.
 * Must be strictly greater than keepAliveTimeout to avoid a Node.js race
 * condition where the headers timeout fires before keep-alive cleanup.
 * Set to 66 000 ms (keepAliveTimeout + 1 000 ms).
 *
 * @constant {number}
 */
const HEADERS_TIMEOUT_MS = 66000;

/**
 * Creates and configures an HTTP server with production-grade error
 * handling and timeout settings.
 *
 * The returned server instance:
 * - Delegates every incoming request to the provided requestHandler
 * - Listens for server-level errors (EADDRINUSE, EACCES, and others)
 *   and logs clear, actionable messages via the structured logger before
 *   exiting with a non-zero code
 * - Configures keepAliveTimeout and headersTimeout to mitigate
 *   slowloris-style denial-of-service attacks
 *
 * NOTE: The server is NOT bound to a port — callers must invoke
 * server.listen() themselves.  This separation enables unit testing
 * without opening real network sockets.
 *
 * @param {Function} requestHandler - The composed request handler function
 *   (typically a middleware pipeline produced by app.js) with signature
 *   (req: http.IncomingMessage, res: http.ServerResponse) => void.
 * @returns {http.Server} The configured HTTP server instance, ready to
 *   be bound via server.listen().
 * @throws {TypeError} If requestHandler is not a function.
 *
 * @example
 * const { createServer } = require('./server');
 * const server = createServer((req, res) => {
 *   res.writeHead(200, { 'Content-Type': 'text/plain' });
 *   res.end('Hello, World!\n');
 * });
 * server.listen(3000, '127.0.0.1');
 */
function createServer(requestHandler) {
  // Validate the request handler up-front to surface misconfiguration early
  if (typeof requestHandler !== 'function') {
    throw new TypeError(
      'createServer requires a requestHandler function, ' +
      `received ${typeof requestHandler}`
    );
  }

  // Create the HTTP server, delegating every request to the composed handler
  const server = http.createServer(requestHandler);

  // ---------------------------------------------------------------------------
  // Error handling — addresses the "zero server.on('error') listeners" code
  // smell identified in AAP §0.2.2.  Handles the most common startup failures
  // with clear, actionable log messages before exiting with a non-zero code.
  // ---------------------------------------------------------------------------
  server.on('error', (error) => {
    switch (error.code) {
      case 'EADDRINUSE':
        logger.error(
          `Port ${error.port || 'unknown'} is already in use. ` +
          'Stop the other process or choose a different port.'
        );
        break;

      case 'EACCES':
        logger.error(
          `Port ${error.port || 'unknown'} requires elevated privileges. ` +
          'Run with appropriate permissions or use a port above 1024.'
        );
        break;

      default:
        logger.error(
          `Server encountered an unexpected error: ${error.message || error}`,
          error
        );
        break;
    }

    // Exit with failure code for all server-level errors.
    // In a production deployment the process manager (systemd, Docker, etc.)
    // will observe the non-zero exit and handle restart policy.
    process.exit(1);
  });

  // ---------------------------------------------------------------------------
  // Timeout configuration — mitigates slowloris-style attacks by ensuring
  // idle connections and slow header transmissions are cleaned up promptly.
  // See AAP §0.1.1 security requirements.
  // ---------------------------------------------------------------------------

  // Time (ms) the server waits for additional data on a keep-alive connection
  // after the last response was sent, before closing the socket.
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

  // Time (ms) the server waits for the complete HTTP headers to be received.
  // Must be greater than keepAliveTimeout to prevent a Node.js timing issue.
  server.headersTimeout = HEADERS_TIMEOUT_MS;

  return server;
}

module.exports = { createServer };
