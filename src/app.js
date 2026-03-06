'use strict';

/**
 * Application Factory & Bootstrap Module
 *
 * Central composition root that wires together the HTTP server, middleware
 * pipeline, request handler, logger, and graceful shutdown. This module is
 * the heart of the refactored architecture — it is the ONLY file that knows
 * how all the layers connect.
 *
 * Exports two functions:
 *  - createApp()   — Factory that composes middleware and returns an http.Server
 *                     (useful for testing without binding to a port)
 *  - startServer() — Bootstrap that creates the app, binds to the configured
 *                     host:port, registers graceful shutdown, and starts listening
 *
 * Design patterns applied:
 *  - Factory Pattern:        createApp() creates configured server instances
 *  - Middleware Chain:        Pipeline of (req, res, next) functions composed in order
 *  - Dependency Injection:   Logger and config injected, not hardcoded
 *  - Separation of Concerns: This file only does composition — no business logic
 *
 * Middleware pipeline order (per AAP §0.5.1):
 *   securityHeaders → requestLogger → helloHandler → errorHandler (wrapper)
 *
 * @module src/app
 */

// ---------------------------------------------------------------------------
// Internal imports — wired from the decomposed module layers
// ---------------------------------------------------------------------------

const config = require('./config');
const { createServer } = require('./server');
const { helloHandler } = require('./handlers/helloHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { securityHeaders } = require('./middleware/securityHeaders');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const { gracefulShutdown } = require('./utils/gracefulShutdown');

// ---------------------------------------------------------------------------
// Middleware Composition
// ---------------------------------------------------------------------------

/**
 * Composes an array of middleware functions and a final handler into a single
 * request handler function with signature (req, res).
 *
 * Each middleware in the array must follow the (req, res, next) signature,
 * where calling next() passes control to the next middleware in the pipeline.
 * The final handler receives (req, res) and is responsible for ending the
 * response.
 *
 * Execution order is left-to-right through the middlewares array, followed by
 * the handler. This mirrors the conceptual pipeline:
 *   middlewares[0] → middlewares[1] → ... → handler
 *
 * @param {Array<Function>} middlewares - Ordered array of middleware functions,
 *   each with signature (req: http.IncomingMessage, res: http.ServerResponse,
 *   next: Function) => void.
 * @param {Function} handler - The terminal request handler with signature
 *   (req: http.IncomingMessage, res: http.ServerResponse) => void.
 * @returns {Function} A composed function with signature (req, res) that
 *   executes the full middleware chain followed by the handler.
 */
function composeMiddleware(middlewares, handler) {
  return (req, res) => {
    let index = 0;

    /**
     * Advances to the next middleware in the chain, or invokes the final
     * handler when all middleware have executed.
     */
    function next() {
      if (index < middlewares.length) {
        const currentMiddleware = middlewares[index];
        index += 1;
        currentMiddleware(req, res, next);
      } else {
        handler(req, res);
      }
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Application Factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns a fully configured HTTP server instance with the
 * middleware pipeline composed and the error handler wrapper applied.
 *
 * The returned server is NOT bound to a port — callers must invoke
 * server.listen() themselves. This separation is intentional: it enables
 * integration tests to make requests against the server using
 * http.request() without opening a real network socket on a fixed port.
 *
 * Middleware pipeline (executed in order for every request):
 *   1. securityHeaders — sets production security headers
 *   2. requestLogger   — logs request method, URL, status, and duration
 *   3. helloHandler    — sends 200 OK, text/plain, "Hello, World!\n"
 *   Wrapped by: errorHandler — catches unexpected errors in the pipeline
 *
 * @returns {import('http').Server} A configured http.Server instance ready
 *   to be bound via server.listen().
 *
 * @example
 * const { createApp } = require('./src/app');
 * const server = createApp();
 * server.listen(3000, '127.0.0.1');
 */
function createApp() {
  // Compose the middleware pipeline in the specified order:
  // securityHeaders → requestLogger → helloHandler
  const composedHandler = composeMiddleware(
    [securityHeaders, requestLogger],
    helloHandler
  );

  // Wrap the entire composed pipeline with the error handler to catch
  // any unexpected errors thrown during request processing
  const safeHandler = errorHandler(composedHandler);

  // Create the HTTP server with production-grade timeout and error handling
  const server = createServer(safeHandler);

  return server;
}

// ---------------------------------------------------------------------------
// Server Bootstrap
// ---------------------------------------------------------------------------

/**
 * Bootstraps the application: creates the server, binds it to the configured
 * host and port, registers graceful shutdown handlers, and starts listening
 * for incoming HTTP requests.
 *
 * This function is the top-level entry point called by the root server.js
 * file. It orchestrates the full application lifecycle:
 *   1. Creates the app via createApp()
 *   2. Binds to config.host:config.port
 *   3. Logs the startup URL (matching the original server.js format)
 *   4. Registers SIGINT/SIGTERM/uncaughtException handlers for graceful shutdown
 *   5. Returns the server instance for external reference
 *
 * @returns {import('http').Server} The running http.Server instance.
 *
 * @example
 * const { startServer } = require('./src/app');
 * const server = startServer();
 */
function startServer() {
  const server = createApp();

  // Bind the server to the configured host and port.
  // The callback fires once the server is successfully listening.
  server.listen(config.port, config.host, () => {
    logger.info(`Server running at http://${config.host}:${config.port}/`);
  });

  // Register graceful shutdown handlers for SIGINT, SIGTERM,
  // uncaughtException, and unhandledRejection
  gracefulShutdown(server);

  return server;
}

// ---------------------------------------------------------------------------
// Module Exports
// ---------------------------------------------------------------------------

module.exports = { createApp, startServer };
