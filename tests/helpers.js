'use strict';

/**
 * Shared Test Helpers
 *
 * Common utilities for test server setup, teardown, HTTP requests, and
 * response assertions shared across all test suites. Extracting these
 * helpers eliminates code duplication and keeps individual test files
 * within the 100-line code limit (AAP §0.8.2).
 *
 * Exports:
 *   - createTestServer(createAppFn) — starts a server on a random port
 *   - closeTestServer(server)       — gracefully closes a test server
 *   - makeRequest(port, pathOrOpts, method) — sends an HTTP request
 *   - expectHelloResponse(response) — asserts the Hello World contract
 *
 * @module tests/helpers
 */

const http = require('http');

/**
 * Creates and starts an HTTP server using the provided factory function.
 *
 * Waits for the 'listening' event to ensure the OS has bound the server
 * to a port before resolving. Tests should set process.env.PORT = '0'
 * before loading application modules so the OS auto-assigns a random
 * available port, avoiding port conflicts between parallel test suites.
 *
 * @param {Function} createAppFn - Application factory (e.g., createApp from src/app.js)
 * @returns {Promise<{server: import('http').Server, port: number}>}
 */
function createTestServer(createAppFn) {
  var server = createAppFn();
  return new Promise(function (resolve) {
    if (server.listening) {
      resolve({ server: server, port: server.address().port });
    } else {
      server.on('listening', function () {
        resolve({ server: server, port: server.address().port });
      });
    }
  });
}

/**
 * Gracefully closes a test server instance.
 *
 * Checks server.listening before calling server.close() to prevent
 * double-close errors when a shutdown test has already closed the server.
 *
 * @param {import('http').Server} server - Server instance to close
 * @returns {Promise<void>}
 */
function closeTestServer(server) {
  return new Promise(function (resolve) {
    if (server && server.listening) {
      server.close(function () { resolve(); });
    } else {
      resolve();
    }
  });
}

/**
 * Makes an HTTP request to the test server and collects the full response.
 *
 * Supports two calling conventions:
 *   1. makeRequest(port, '/path', 'METHOD')    — simple path + method strings
 *   2. makeRequest(port, { path, method, headers }) — options object for
 *      advanced cases like custom Accept-Encoding headers
 *
 * Always sends 'Connection: close' to ensure the TCP connection is torn
 * down after each response, preventing keep-alive sockets from blocking
 * server.close() in afterAll teardown (Node.js v20 defaults to keep-alive).
 *
 * Collects response data as raw Buffer chunks so compressed responses can
 * be accurately decompressed in compression middleware tests.
 *
 * @param {number} port - Server port to connect to
 * @param {string|Object} pathOrOptions - URL path string or options object
 * @param {string} [pathOrOptions.path='/'] - URL path when using object form
 * @param {string} [pathOrOptions.method='GET'] - HTTP method when using object form
 * @param {Object} [pathOrOptions.headers={}] - Extra headers when using object form
 * @param {string} [method='GET'] - HTTP method (only when pathOrOptions is a string)
 * @returns {Promise<{statusCode: number, headers: Object, body: string, rawBody: Buffer}>}
 */
function makeRequest(port, pathOrOptions, method) {
  var reqPath, reqMethod, extraHeaders;

  if (typeof pathOrOptions === 'object' && pathOrOptions !== null) {
    reqPath = pathOrOptions.path || '/';
    reqMethod = pathOrOptions.method || 'GET';
    extraHeaders = pathOrOptions.headers || {};
  } else {
    reqPath = pathOrOptions || '/';
    reqMethod = method || 'GET';
    extraHeaders = {};
  }

  return new Promise(function (resolve, reject) {
    var reqOptions = {
      hostname: '127.0.0.1',
      port: port,
      path: reqPath,
      method: reqMethod,
      headers: Object.assign({ 'Connection': 'close' }, extraHeaders),
    };

    var req = http.request(reqOptions, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var rawBody = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: rawBody.toString(),
          rawBody: rawBody,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Asserts the standard Hello World response contract.
 *
 * Verifies the three core invariants from AAP §0.7.5:
 *   - Status Code: 200 (Rule R-003)
 *   - Content-Type: text/plain (Rule R-003)
 *   - Body: Hello, World!\n — byte-identical to original server.js line 9 (Rule R-001)
 *
 * @param {Object} response - Response object from makeRequest()
 */
function expectHelloResponse(response) {
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toBe('text/plain');
  expect(response.body).toBe('Hello, World!\n');
}

module.exports = {
  createTestServer: createTestServer,
  closeTestServer: closeTestServer,
  makeRequest: makeRequest,
  expectHelloResponse: expectHelloResponse,
};
