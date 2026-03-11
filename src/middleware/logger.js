'use strict';

/**
 * Request-level logging middleware for the HTTP server.
 *
 * Captures and logs HTTP request details to stdout after each response
 * completes. Works by monkey-patching `res.end` so that when the handler
 * (or an inner middleware such as compression) calls `res.end()`, the
 * patched wrapper fires the original `res.end`, then emits a structured
 * log line containing the HTTP method, URL, status code, and response
 * time measured with `process.hrtime()` for sub-millisecond precision.
 *
 * Log format:
 *   [ISO_TIMESTAMP] METHOD URL STATUS_CODE DURATIONms
 * Example:
 *   [2025-02-24T12:00:00.000Z] GET / 200 0.52ms
 *
 * Logging is controlled by the `logLevel` property from `config/index.js`.
 * When `logLevel` is set to `'silent'`, the monkey-patch is still installed
 * (to keep middleware ordering deterministic) but no output is written.
 *
 * Usage inside `src/app.js`:
 *   const { requestLogger } = require('./middleware/logger');
 *   // Inside the http.createServer callback:
 *   requestLogger(req, res);
 *
 * @module src/middleware/logger
 */

const config = require('../../config');

/**
 * Attaches request-level logging to an HTTP response.
 *
 * Call this function at the very start of the request handler, BEFORE
 * any other middleware that also wraps `res.end` (e.g. compression).
 * Because `requestLogger` wraps first, its logging callback executes
 * last — after compression and the actual handler — ensuring the
 * captured status code and elapsed time reflect the full pipeline.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request object.
 * @param {import('http').ServerResponse}  res - The server response object whose
 *   `end` method will be monkey-patched for post-response logging.
 * @returns {void}
 */
function requestLogger(req, res) {
  /* Capture high-resolution start time as a single BigInt nanosecond value.
   * process.hrtime.bigint() avoids the [seconds, nanoseconds] array
   * allocation that process.hrtime() produces on every call. */
  const startNs = process.hrtime.bigint();

  /* Preserve a reference to the original, un-patched res.end. */
  const originalEnd = res.end;

  /**
   * Replacement for `res.end` that delegates to the original implementation
   * and then emits a structured log line to stdout.
   *
   * @param {...*} args - All arguments forwarded verbatim to the original
   *   `res.end(chunk, encoding, callback)`.
   * @returns {import('http').ServerResponse} The return value of the
   *   original `res.end` call (the response object itself).
   */
  res.end = function patchedEnd(...args) {
    /* Invoke the real res.end, preserving `this` context and all arguments. */
    const result = originalEnd.apply(res, args);

    /* Emit the log line unless logging has been silenced via configuration. */
    if (config.logLevel !== 'silent') {
      const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;

      console.log(
        '[%s] %s %s %d %sms',
        new Date().toISOString(),
        req.method,
        req.url,
        res.statusCode,
        elapsedMs.toFixed(2)
      );
    }

    return result;
  };
}

module.exports = { requestLogger };
