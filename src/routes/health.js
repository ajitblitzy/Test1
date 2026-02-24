'use strict';

/**
 * Health check endpoint handler module.
 *
 * Provides a dedicated /health route that returns server health metadata
 * as JSON for monitoring integrations and load-balancer readiness probes.
 * This is the ONLY differentiated route in the application — all other
 * paths continue to receive the Hello World response (Rule R-009).
 *
 * Response format:
 *   {
 *     "status": "OK",
 *     "uptime": <number>,        // seconds since process start
 *     "timestamp": <number>,     // Unix timestamp in milliseconds
 *     "memoryUsage": <object>,   // rss, heapTotal, heapUsed, external, arrayBuffers
 *     "pid": <number>            // current process ID
 *   }
 *
 * @module src/routes/health
 */

/**
 * Health check endpoint handler.
 * Returns server health metadata as JSON for monitoring and load-balancer readiness probes.
 *
 * Constructs a health data object containing process uptime, current timestamp,
 * memory usage statistics, and the process identifier, then serializes it as
 * JSON and sends it with a 200 status code and application/json content type.
 *
 * @param {http.IncomingMessage} req - The incoming HTTP request object
 * @param {http.ServerResponse} res - The HTTP server response object
 */
function healthHandler(req, res) {
  const healthData = {
    status: 'OK',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memoryUsage: process.memoryUsage(),
    pid: process.pid
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(healthData));
}

module.exports = { healthHandler };
