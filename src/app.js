'use strict';

/**
 * Application Factory Module — HTTP Server Composition
 *
 * Core module that replaces the monolithic server.js logic. Exports a
 * createApp() factory function that builds an HTTP server, composes the
 * middleware pipeline (logger → compression → routing), binds to the
 * configured host and port, attaches graceful shutdown handlers, and
 * returns the server instance.
 *
 * Middleware pipeline execution order:
 *   1. requestLogger  — monkey-patches res.end (outermost wrapper, logs last)
 *   2. compressResponse — wraps res.end for gzip/deflate compression
 *   3. Route handler   — healthHandler (/health) or helloHandler (all other paths)
 *
 * Design pattern: Factory Pattern (AAP §0.4.3)
 *   - Test environments create isolated server instances
 *   - Cluster workers each get their own independent server
 *   - Clean separation between entry point logic and server configuration
 *
 * @module src/app
 */

const http = require('http');
const config = require('../config');
const { helloHandler } = require('./handlers/hello');
const { healthHandler } = require('./routes/health');
const { requestLogger } = require('./middleware/logger');
const { compressResponse } = require('./middleware/compression');
const { setupGracefulShutdown } = require('./utils/graceful-shutdown');

/**
 * Creates and configures a fully composed HTTP server.
 *
 * Builds the server with the middleware pipeline, routing, timeout tuning,
 * structured error handling, and graceful shutdown. Binds to the host and
 * port specified in config/index.js (defaults to 127.0.0.1:3000).
 *
 * @returns {http.Server} A configured, listening HTTP server instance.
 */
function createApp() {
  /**
   * HTTP server with the composed request handler.
   *
   * The request handler applies middleware in order, then routes:
   *   - /health → healthHandler (JSON health metadata)
   *   - all other paths → helloHandler (200, text/plain, "Hello, World!\n")
   */
  const server = http.createServer((req, res) => {
    /* Security header applied to every response (AAP §0.7.4) */
    res.setHeader('X-Content-Type-Options', 'nosniff');

    /*
     * Middleware pipeline — order matters:
     *   requestLogger wraps res.end FIRST (outermost), so its callback
     *   executes LAST — after compression and the handler — ensuring
     *   the captured status code and elapsed time reflect the full pipeline.
     *   compressResponse wraps res.end SECOND (inner), so compression
     *   happens before the logger's post-response callback fires.
     */
    requestLogger(req, res);
    compressResponse(req, res);

    /*
     * Route the request (Rule R-009):
     *   /health is the ONLY differentiated route.
     *   All other paths (method-agnostic, path-agnostic) → Hello World.
     */
    if (req.url === '/health') {
      healthHandler(req, res);
    } else {
      helloHandler(req, res);
    }
  });

  /*
   * Explicit timeout tuning for resilience (AAP §0.7.1).
   * keepAliveTimeout at 65s sits above the typical load-balancer idle
   * timeout of 60s, preventing premature connection drops.
   * headersTimeout must exceed keepAliveTimeout per Node.js docs.
   */
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  /*
   * Server-level error handler (AAP §0.7.3 Error Handling Gap Analysis).
   * Addresses the gap where EADDRINUSE previously crashed the process
   * silently with an unhandled exception.
   */
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('[Error] Port ' + config.port + ' is already in use');
      process.exit(1);
    } else if (err.code === 'EACCES') {
      console.error('[Error] Permission denied for port ' + config.port);
      process.exit(1);
    } else {
      console.error('[Error] Server error: ' + err.message);
      process.exit(1);
    }
  });

  /* Bind to configured host and port (defaults: 127.0.0.1:3000) */
  server.listen(config.port, config.host, () => {
    console.log(
      '[Server] Running at http://' + config.host + ':' + config.port + '/ (PID: ' + process.pid + ')'
    );
  });

  /* Register SIGINT/SIGTERM/uncaughtException handlers for graceful shutdown */
  setupGracefulShutdown(server);

  return server;
}

module.exports = { createApp };
