'use strict';

/**
 * Hello World request handler.
 * Extracted from the original server.js to provide the default HTTP response.
 * Responds to ALL HTTP methods and ALL URL paths with a plain-text Hello World message.
 * This handler is method-agnostic and path-agnostic — the req parameter is intentionally ignored.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request (unused)
 * @param {import('http').ServerResponse} res - The HTTP response object
 */
function helloHandler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
}

module.exports = { helloHandler };
