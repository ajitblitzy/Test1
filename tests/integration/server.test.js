'use strict';

/**
 * Integration Tests — End-to-End HTTP Server Validation
 *
 * Comprehensive integration tests that start the fully-composed HTTP server,
 * send real HTTP requests via the Node.js built-in http module, and validate
 * the complete request/response cycle including status codes, headers, body
 * content, security headers, and graceful shutdown.
 *
 * These tests verify that after the monolithic server.js was decomposed into
 * the modular src/ architecture, the EXACT original behavior is preserved:
 *   - Status:  200 OK
 *   - Header:  Content-Type: text/plain
 *   - Body:    Hello, World!\n
 *
 * Middleware pipeline validated (per AAP §0.5.1):
 *   securityHeaders → requestLogger → helloHandler → errorHandler (wrapper)
 *
 * Test isolation strategy:
 *   - Each test suite creates a server on an ephemeral port (port 0)
 *   - No hardcoded port numbers — port assigned dynamically by the OS
 *   - Server instances are properly closed after each suite
 *
 * Zero external dependencies — uses ONLY Node.js built-in modules:
 *   - node:test   — test runner (stable since Node.js v20)
 *   - node:assert  — assertion library
 *   - http         — HTTP client for sending test requests
 *
 * Run via: node --test tests/integration/server.test.js
 *
 * @module tests/integration/server.test
 */

// ---------------------------------------------------------------------------
// Imports — Node.js built-in modules ONLY (AAP §0.6.1, §0.7.1)
// ---------------------------------------------------------------------------

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

// Internal import — application factory from the decomposed architecture
const { createApp } = require('../../src/app');

// ---------------------------------------------------------------------------
// Test Helper — Promise-based HTTP Request Utility
// ---------------------------------------------------------------------------

/**
 * Sends an HTTP request and returns a Promise that resolves with the
 * complete response including status code, headers, and body.
 *
 * This helper wraps the Node.js built-in http.request() in a Promise to
 * enable clean async/await syntax in test cases. It collects all response
 * data chunks and concatenates them into a single string body.
 *
 * @param {Object} options - HTTP request options passed to http.request()
 * @param {string} options.hostname - Target hostname (e.g., '127.0.0.1')
 * @param {number} options.port     - Target port number
 * @param {string} options.path     - Request path (e.g., '/', '/foo/bar')
 * @param {string} options.method   - HTTP method (e.g., 'GET', 'POST')
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
 *   Resolves with the response status code, lowercased headers object, and
 *   body string. Rejects on connection or request errors.
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Helper that starts a server on an ephemeral port and returns the
 * dynamically assigned port number. Used by individual tests that need
 * their own isolated server instance (e.g., graceful shutdown tests).
 *
 * @param {import('http').Server} serverInstance - The HTTP server to start
 * @returns {Promise<number>} The dynamically assigned port number
 */
function startOnEphemeralPort(serverInstance) {
  return new Promise((resolve, reject) => {
    serverInstance.listen(0, '127.0.0.1', () => {
      const assignedPort = serverInstance.address().port;
      resolve(assignedPort);
    });
    serverInstance.on('error', reject);
  });
}

/**
 * Helper that gracefully closes a server instance and waits for the
 * 'close' event to fire.
 *
 * @param {import('http').Server} serverInstance - The HTTP server to close
 * @returns {Promise<void>} Resolves when the server has fully closed
 */
function closeServer(serverInstance) {
  return new Promise((resolve, reject) => {
    if (!serverInstance || !serverInstance.listening) {
      resolve();
      return;
    }
    serverInstance.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Integration Test Suite
// ---------------------------------------------------------------------------

describe('Integration: HTTP Server', () => {
  /** @type {import('http').Server} Shared server instance for test suite */
  let server;

  /** @type {number} Dynamically assigned ephemeral port */
  let port;

  // -------------------------------------------------------------------------
  // Lifecycle Hooks
  // -------------------------------------------------------------------------

  before(async () => {
    // Create the fully-composed HTTP server with the complete middleware
    // pipeline (securityHeaders → requestLogger → helloHandler → errorHandler)
    // WITHOUT binding to a fixed port
    server = createApp();

    // Start on ephemeral port (port 0) for test isolation — the OS assigns
    // a random available port, preventing EADDRINUSE conflicts
    port = await startOnEphemeralPort(server);
  });

  after(async () => {
    // Cleanly shut down the shared server after all tests complete
    await closeServer(server);
  });

  // -------------------------------------------------------------------------
  // Core Response Tests (AAP §0.7.3 — Behavioral Preservation Checklist)
  // -------------------------------------------------------------------------

  describe('Core response behavior', () => {
    it('should respond with status 200 OK', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      assert.strictEqual(
        response.statusCode,
        200,
        'Expected status code 200 but received ' + response.statusCode
      );
    });

    it('should respond with Content-Type text/plain', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      // Node.js normalizes response headers to lowercase
      assert.strictEqual(
        response.headers['content-type'],
        'text/plain',
        'Expected Content-Type "text/plain" but received "' +
          response.headers['content-type'] + '"'
      );
    });

    it('should respond with body "Hello, World!\\n"', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      // The newline character \n MUST be present — exact original behavior
      assert.strictEqual(
        response.body,
        'Hello, World!\n',
        'Expected body "Hello, World!\\n" but received "' +
          response.body + '"'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Method-Agnostic Tests (AAP §0.7.3 — Universal Handler)
  // The original server responds identically to ALL HTTP methods
  // -------------------------------------------------------------------------

  describe('Method-agnostic responses', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];

    for (const method of methods) {
      it(`should return the same response for ${method} requests`, async () => {
        const response = await makeRequest({
          hostname: '127.0.0.1',
          port,
          path: '/',
          method
        });

        assert.strictEqual(
          response.statusCode,
          200,
          `${method} / — expected status 200, got ${response.statusCode}`
        );

        assert.strictEqual(
          response.headers['content-type'],
          'text/plain',
          `${method} / — expected Content-Type "text/plain", got "${response.headers['content-type']}"`
        );

        assert.strictEqual(
          response.body,
          'Hello, World!\n',
          `${method} / — expected body "Hello, World!\\n", got "${response.body}"`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Path-Agnostic Tests (AAP §0.7.3 — All Paths Return Same Response)
  // The original server ignores the request path entirely
  // -------------------------------------------------------------------------

  describe('Path-agnostic responses', () => {
    const paths = ['/', '/anything', '/foo/bar'];

    for (const path of paths) {
      it(`should return the same response for path ${path}`, async () => {
        const response = await makeRequest({
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET'
        });

        assert.strictEqual(
          response.statusCode,
          200,
          `GET ${path} — expected status 200, got ${response.statusCode}`
        );

        assert.strictEqual(
          response.headers['content-type'],
          'text/plain',
          `GET ${path} — expected Content-Type "text/plain", got "${response.headers['content-type']}"`
        );

        assert.strictEqual(
          response.body,
          'Hello, World!\n',
          `GET ${path} — expected body "Hello, World!\\n", got "${response.body}"`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Security Headers Tests (AAP §0.1.1, §0.7.2, §0.7.7)
  // Validates that the securityHeaders middleware sets all required headers
  // -------------------------------------------------------------------------

  describe('Security headers', () => {
    it('should include X-Content-Type-Options: nosniff header', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      assert.strictEqual(
        response.headers['x-content-type-options'],
        'nosniff',
        'Expected X-Content-Type-Options: nosniff, got "' +
          response.headers['x-content-type-options'] + '"'
      );
    });

    it('should include X-Frame-Options: DENY header', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      assert.strictEqual(
        response.headers['x-frame-options'],
        'DENY',
        'Expected X-Frame-Options: DENY, got "' +
          response.headers['x-frame-options'] + '"'
      );
    });

    it('should include X-XSS-Protection: 0 header', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      assert.strictEqual(
        response.headers['x-xss-protection'],
        '0',
        'Expected X-XSS-Protection: 0, got "' +
          response.headers['x-xss-protection'] + '"'
      );
    });

    it('should not include X-Powered-By header', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      // The securityHeaders middleware calls res.removeHeader('X-Powered-By')
      // Node.js http module does not set it by default, but the middleware
      // defensively removes it in case upstream proxies add it
      assert.strictEqual(
        response.headers['x-powered-by'],
        undefined,
        'X-Powered-By header should not be present, but found "' +
          response.headers['x-powered-by'] + '"'
      );
    });

    it('should include Content-Security-Policy header', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      // Verify the Content-Security-Policy header exists and contains
      // the restrictive default-src 'none' directive
      assert.strictEqual(
        typeof response.headers['content-security-policy'],
        'string',
        'Content-Security-Policy header should be present'
      );

      assert.match(
        response.headers['content-security-policy'],
        /default-src 'none'/,
        'Content-Security-Policy should include "default-src \'none\'" directive, got "' +
          response.headers['content-security-policy'] + '"'
      );
    });

    it('should include Strict-Transport-Security header', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      // Verify the HSTS header exists and contains max-age directive
      assert.strictEqual(
        typeof response.headers['strict-transport-security'],
        'string',
        'Strict-Transport-Security header should be present'
      );

      assert.match(
        response.headers['strict-transport-security'],
        /max-age=\d+/,
        'Strict-Transport-Security should include max-age directive, got "' +
          response.headers['strict-transport-security'] + '"'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Graceful Shutdown Test (AAP §0.7.5)
  // Uses a SEPARATE server instance to avoid breaking the shared test server
  // -------------------------------------------------------------------------

  describe('Graceful shutdown', () => {
    it('should shut down gracefully when server.close() is called', async () => {
      // Create a SEPARATE server instance for this test — not the shared one
      // from the before() hook, because closing it would break other tests
      const shutdownServer = createApp();
      const shutdownPort = await startOnEphemeralPort(shutdownServer);

      // Step 1: Verify the server is running by sending a request
      const runningResponse = await makeRequest({
        hostname: '127.0.0.1',
        port: shutdownPort,
        path: '/',
        method: 'GET'
      });

      assert.strictEqual(
        runningResponse.statusCode,
        200,
        'Server should be running and return 200 before shutdown'
      );

      assert.strictEqual(
        runningResponse.body,
        'Hello, World!\n',
        'Server should return correct body before shutdown'
      );

      // Step 2: Initiate graceful shutdown
      await closeServer(shutdownServer);

      // Step 3: Verify the server is no longer accepting connections
      // After server.close(), new connection attempts should fail with either:
      //   - ECONNREFUSED: Port is fully closed, OS rejects the TCP SYN
      //   - ECONNRESET:   Server is closing and resets the connection mid-handshake
      // Both are valid indicators that the server has stopped serving requests.
      await assert.rejects(
        () => makeRequest({
          hostname: '127.0.0.1',
          port: shutdownPort,
          path: '/',
          method: 'GET'
        }),
        (error) => {
          const validShutdownErrors = ['ECONNREFUSED', 'ECONNRESET'];
          const isValidShutdownError = validShutdownErrors.includes(error.code);
          assert.strictEqual(
            isValidShutdownError,
            true,
            'Expected ECONNREFUSED or ECONNRESET after server shutdown, got "' +
              error.code + '"'
          );
          return true;
        },
        'Request to shutdown server should be rejected with a connection error'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Full Request/Response Cycle — Smoke Test
  // Validates the entire middleware pipeline end-to-end in a single test
  // -------------------------------------------------------------------------

  describe('Full request/response cycle', () => {
    it('should complete a full HTTP request/response cycle with all expected properties', async () => {
      const response = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      });

      // Validate status code — must be exactly 200
      assert.strictEqual(
        response.statusCode,
        200,
        'Full cycle: expected status 200, got ' + response.statusCode
      );

      // Validate Content-Type header — must be exactly text/plain
      assert.strictEqual(
        response.headers['content-type'],
        'text/plain',
        'Full cycle: expected Content-Type "text/plain", got "' +
          response.headers['content-type'] + '"'
      );

      // Validate body — must be exactly "Hello, World!\n" with newline
      assert.strictEqual(
        response.body,
        'Hello, World!\n',
        'Full cycle: expected body "Hello, World!\\n", got "' +
          response.body + '"'
      );

      // Validate security headers are present (set by securityHeaders middleware)
      assert.strictEqual(
        response.headers['x-content-type-options'],
        'nosniff',
        'Full cycle: X-Content-Type-Options should be "nosniff"'
      );

      assert.strictEqual(
        response.headers['x-frame-options'],
        'DENY',
        'Full cycle: X-Frame-Options should be "DENY"'
      );

      assert.strictEqual(
        response.headers['x-xss-protection'],
        '0',
        'Full cycle: X-XSS-Protection should be "0"'
      );

      assert.strictEqual(
        typeof response.headers['content-security-policy'],
        'string',
        'Full cycle: Content-Security-Policy header should be present'
      );

      assert.strictEqual(
        typeof response.headers['strict-transport-security'],
        'string',
        'Full cycle: Strict-Transport-Security header should be present'
      );

      // Confirm X-Powered-By is absent
      assert.strictEqual(
        response.headers['x-powered-by'],
        undefined,
        'Full cycle: X-Powered-By header should not be present'
      );
    });
  });
});
