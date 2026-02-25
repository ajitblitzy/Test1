'use strict';

/**
 * Hello World request handler.
 * Extracted from the original server.js to provide the default HTTP response.
 * Responds to ALL HTTP methods and ALL URL paths with a plain-text Hello World message.
 * This handler is method-agnostic and path-agnostic — the req parameter is intentionally ignored.
 *
 * Performance: The response body is pre-allocated as a Buffer constant to
 * eliminate per-request string-to-Buffer conversion. Content-Length is set
 * via setHeader (not writeHead) so the compression middleware can modify
 * headers asynchronously before they are flushed to the socket.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request (unused)
 * @param {import('http').ServerResponse} res - The HTTP response object
 */

/** Pre-computed response body buffer — avoids per-request allocation. */
const HELLO_BODY = Buffer.from('Hello, World!\n');

function helloHandler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', HELLO_BODY.length);
  res.end(HELLO_BODY);
}

module.exports = { helloHandler };
