'use strict';

/**
 * Request Body Parser Middleware
 *
 * Extracts and parses JSON request bodies from incoming HTTP requests using
 * the Node.js built-in request stream interface (data, end, error events).
 *
 * This module has ZERO dependencies — no require() statements. It operates
 * entirely on the http.IncomingMessage object's readable stream interface.
 *
 * Used by:
 *  - src/controllers/requirementsController.js (POST /api/requirements)
 *  - src/controllers/approvalController.js (POST /api/reject/:id)
 *
 * Security: All user-submitted content is treated as untrusted input.
 * The parser only performs structural JSON parsing — it never evaluates
 * or executes any content. Request body content is never logged.
 *
 * @module src/middleware/bodyParser
 */

/**
 * Parses a JSON request body from an incoming HTTP request stream.
 *
 * Collects data chunks from the request's readable stream via the 'data' event,
 * concatenates them using Buffer.concat for efficiency, converts the result to
 * a UTF-8 string, and attempts JSON.parse. Handles empty bodies, malformed JSON,
 * and stream errors gracefully.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request object
 * @returns {Promise<Object>} Resolves with the parsed JSON object on success,
 *   or an empty object ({}) if the request body is empty. Rejects with a
 *   descriptive Error if the body contains malformed JSON or a stream error occurs.
 *
 * @example
 * // In a controller:
 * const { parseBody } = require('../middleware/bodyParser');
 *
 * async function handlePost(req, res) {
 *   try {
 *     const body = await parseBody(req);
 *     // body is now a parsed JavaScript object
 *   } catch (err) {
 *     // err.message contains a descriptive error string
 *   }
 * }
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Collect incoming data chunks in an array for efficient Buffer concatenation.
    // Each chunk emitted by the 'data' event is a Buffer instance.
    const chunks = [];

    // Track whether the promise has already been settled to prevent
    // double-resolution in edge cases (e.g., error after end).
    let settled = false;

    /**
     * 'data' event handler — accumulates raw Buffer chunks from the request
     * stream as they arrive. Using an array with Buffer.concat is more
     * efficient than repeated string concatenation.
     */
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    /**
     * 'end' event handler — fires when the request stream has been fully
     * consumed. Concatenates all collected chunks into a single Buffer,
     * converts to a UTF-8 string, and attempts JSON parsing.
     *
     * Edge cases handled:
     *  - Empty body (no data events fired): resolves with {}
     *  - Whitespace-only body: resolves with {}
     *  - Malformed JSON: rejects with descriptive error including parse details
     */
    req.on('end', () => {
      if (settled) {
        return;
      }
      settled = true;

      try {
        // Concatenate all Buffer chunks and decode as UTF-8
        const body = Buffer.concat(chunks).toString('utf-8');

        // Handle empty or whitespace-only body gracefully by returning
        // an empty object — this allows controllers to destructure without
        // special-casing null/undefined checks.
        if (!body || body.trim() === '') {
          resolve({});
          return;
        }

        // Attempt to parse the body as JSON. This is the only operation
        // performed on user input — no evaluation or execution occurs.
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        // JSON.parse throws SyntaxError for malformed input.
        // Wrap in a new Error with a descriptive prefix so callers
        // can distinguish parse errors from stream errors.
        reject(new Error('Invalid JSON in request body: ' + err.message));
      }
    });

    /**
     * 'error' event handler — fires when a stream-level error occurs,
     * such as a network interruption or client disconnection during
     * the request body transmission.
     */
    req.on('error', (err) => {
      if (settled) {
        return;
      }
      settled = true;

      reject(new Error('Error reading request body: ' + err.message));
    });
  });
}

// Export using CommonJS module system (AAP §0.7.1 — no ES module syntax)
module.exports = { parseBody };
