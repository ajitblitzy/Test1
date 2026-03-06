'use strict';

/**
 * Catch-all error handler middleware for the HTTP server middleware pipeline.
 *
 * This module provides a wrapper function that catches unexpected errors during
 * request processing, logs full error details for debugging, and returns a safe
 * 500 Internal Server Error response to the client. Stack traces and internal
 * error information are never leaked to clients (AAP §0.7.7 security).
 *
 * The original server.js had zero error handling — no try/catch blocks, no
 * server.on('error') listeners. This module addresses that gap entirely.
 *
 * @module middleware/errorHandler
 */

const { logger } = require('../utils/logger');

/**
 * Creates a wrapped request handler that catches unexpected errors during
 * request processing. When an error occurs, it logs the full error details
 * (message and stack trace) via the structured logger and sends a safe,
 * generic 500 Internal Server Error response to the client.
 *
 * This function supports both synchronous handlers and handlers that return
 * promises (async handlers), ensuring comprehensive error coverage.
 *
 * @param {Function} handler - The request handler function to wrap. Receives
 *   (req, res) as arguments — the standard Node.js HTTP request/response pair.
 * @returns {Function} A wrapped handler function with signature (req, res) that
 *   delegates to the original handler inside a try/catch boundary.
 *
 * @example
 * const { errorHandler } = require('./middleware/errorHandler');
 * const { helloHandler } = require('./handlers/helloHandler');
 *
 * const safeHandler = errorHandler(helloHandler);
 * http.createServer(safeHandler);
 */
function errorHandler(handler) {
  return (req, res) => {
    try {
      const result = handler(req, res);

      // Handle async handlers that return a promise
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          sendErrorResponse(error, req, res);
        });
      }
    } catch (error) {
      sendErrorResponse(error, req, res);
    }
  };
}

/**
 * Sends a safe 500 Internal Server Error response and logs full error details.
 * Checks res.headersSent to avoid writing to an already-completed response.
 * Never exposes error details, stack traces, or internal information to clients.
 *
 * @param {Error|*} error - The caught error object (or any thrown value).
 * @param {import('http').IncomingMessage} req - The HTTP request object.
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * @private
 */
function sendErrorResponse(error, req, res) {
  // Log full error details for server-side debugging
  logger.error('Unexpected error during request processing:', error.message || error);

  if (error.stack) {
    logger.error('Stack trace:', error.stack);
  }

  // Guard: do not modify the response if headers have already been sent
  if (res.headersSent) {
    return;
  }

  // Send a safe, generic error response — no internal details exposed
  res.statusCode = 500;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Internal Server Error\n');
}

module.exports = { errorHandler };
