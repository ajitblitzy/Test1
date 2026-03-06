'use strict';

/**
 * Hello World request handler.
 * Responds to every HTTP request with a plain text "Hello, World!" message.
 * This handler is method-agnostic and path-agnostic — all requests receive
 * the identical response regardless of method, URL, headers, or body.
 *
 * @param {http.IncomingMessage} req - The incoming HTTP request object (ignored)
 * @param {http.ServerResponse} res - The HTTP response object
 */
function helloHandler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
}

module.exports = { helloHandler };
