'use strict';

/**
 * HTTP request/response logging middleware.
 *
 * Logs each incoming HTTP request with method, URL, status code, and response
 * time in milliseconds using the structured logger utility. This module addresses
 * the complete absence of request logging in the original server.js — where
 * incoming requests were entirely invisible.
 *
 * Pipeline position: securityHeaders → requestLogger → helloHandler → errorHandler
 *
 * @module middleware/requestLogger
 */

const { logger } = require('../utils/logger');

/**
 * HTTP request/response logging middleware that records the start time of each
 * incoming request, listens for the response 'finish' event, and logs the
 * request method, URL, response status code, and elapsed time in milliseconds.
 *
 * This middleware does NOT modify the request or response — it only observes
 * and logs. Business logic and response content remain untouched.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request
 * @param {import('http').ServerResponse} res - The HTTP server response
 * @param {Function} next - Callback to pass control to the next middleware in the pipeline
 * @returns {void}
 *
 * @example
 * // Usage in middleware pipeline composition:
 * const { requestLogger } = require('./middleware/requestLogger');
 * requestLogger(req, res, () => { handler(req, res); });
 *
 * // Example log output:
 * // [2025-01-01T00:00:00.000Z] [INFO] GET / 200 2ms
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });

  next();
}

module.exports = { requestLogger };
