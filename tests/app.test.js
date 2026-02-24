'use strict';

/**
 * Application Integration Tests
 *
 * Validates the composed application created by src/app.js by testing the
 * full middleware pipeline (logger → compression → routing → handler),
 * server lifecycle (start, respond, shutdown), and overall module integration.
 *
 * Test Groups:
 *   1. Server Lifecycle — startup, listening state, HTTP response
 *   2. Middleware Pipeline — request logging, gzip compression, no-compression fallback
 *   3. Route Integration — /health → JSON health handler, all other → Hello World
 *   4. Server Shutdown — server.close() stops accepting new connections
 *
 * Rules enforced:
 *   R-001 — Hello, World!\n must be byte-identical to original server.js line 9
 *   R-002 — Method-agnostic and path-agnostic for non-health paths
 *   R-003 — Status code 200 and Content-Type text/plain for hello handler
 *   R-007 — CommonJS require syntax (no ES module imports)
 *   R-009 — /health is the only differentiated route
 *   R-010 — All tests pass with npm test
 *
 * @module tests/app.test
 */

/*
 * Environment variables MUST be set BEFORE any application modules are loaded.
 * config/index.js reads process.env at require() time and Object.freeze()s the
 * resulting configuration, so these values must be in place before the first
 * require chain triggers module resolution.
 *
 * PORT=0                  → OS auto-assigns a random available port (avoids conflicts)
 * HOST=127.0.0.1          → Loopback address for isolated test execution
 * ENABLE_CLUSTERING=false → Forces single-process mode for deterministic tests
 * LOG_LEVEL=info          → Keep logging ACTIVE so the logger middleware test can
 *                            verify that console.log is called with the expected
 *                            format string. Output is suppressed by the jest.spyOn
 *                            mockImplementation in beforeAll.
 */
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.ENABLE_CLUSTERING = 'false';
process.env.LOG_LEVEL = 'info';

const http = require('http');
const zlib = require('zlib');
const { createApp } = require('../src/app');

describe('Application Integration Tests', function () {
  /** @type {import('http').Server} */
  var server;

  /** @type {number} Dynamically assigned port from the OS */
  var port;

  /** @type {jest.SpyInstance} Spy capturing console.log calls */
  var logSpy;

  /** @type {jest.SpyInstance} Spy capturing console.error calls */
  var errorSpy;

  /**
   * Makes an HTTP request to the test server and returns a Promise.
   *
   * Collects response data as raw Buffer chunks so that compressed responses
   * can be accurately decompressed in the compression middleware tests.
   * Returns both the string representation (body) and the raw Buffer (rawBody).
   *
   * Uses 'Connection: close' header to ensure the TCP connection is torn down
   * after each response, preventing keep-alive connections from blocking
   * server.close() during afterAll teardown (Node.js v20 defaults to keep-alive).
   *
   * @param {Object}  options             - Request configuration
   * @param {string}  [options.path='/']  - URL path to request
   * @param {string}  [options.method='GET'] - HTTP method to use
   * @param {Object}  [options.headers={}]   - Additional request headers
   * @returns {Promise<{statusCode: number, headers: Object, body: string, rawBody: Buffer}>}
   */
  function makeRequest(options) {
    var reqPath = (options && options.path) || '/';
    var reqMethod = (options && options.method) || 'GET';
    var extraHeaders = (options && options.headers) || {};

    return new Promise(function executor(resolve, reject) {
      var reqOptions = {
        hostname: '127.0.0.1',
        port: port,
        path: reqPath,
        method: reqMethod,
        headers: Object.assign({ 'Connection': 'close' }, extraHeaders),
      };

      var req = http.request(reqOptions, function onResponse(res) {
        var chunks = [];
        res.on('data', function onData(chunk) {
          chunks.push(chunk);
        });
        res.on('end', function onEnd() {
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
   * Start the server and install console spies before all tests.
   *
   * Console spies suppress actual stdout/stderr output while still allowing
   * the logger middleware to execute its console.log call. This keeps test
   * output clean while enabling the logger test to inspect spy call history.
   */
  beforeAll(function (done) {
    logSpy = jest.spyOn(console, 'log').mockImplementation(function () {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(function () {});

    server = createApp();

    /* Handle synchronous and asynchronous listen completion */
    if (server.listening) {
      port = server.address().port;
      done();
    } else {
      server.on('listening', function onListening() {
        port = server.address().port;
        done();
      });
    }
  });

  /**
   * Clear spy call history before each test so assertions inspect only
   * the calls made during that specific test case.
   */
  beforeEach(function () {
    logSpy.mockClear();
    errorSpy.mockClear();
  });

  /**
   * Restore all mocked functions and close the server after all tests.
   * The server.listening check prevents double-close errors if the
   * Server Shutdown test group already closed the server.
   */
  afterAll(function (done) {
    jest.restoreAllMocks();
    if (server && server.listening) {
      server.close(function onClose() {
        done();
      });
    } else {
      done();
    }
  });

  /* ===================================================================
   * Test Group 1: Server Lifecycle
   *
   * Verifies that createApp() returns a properly configured, listening
   * HTTP server that responds correctly through the full middleware
   * pipeline (logger → compression → routing → handler).
   * =================================================================== */
  describe('Server Lifecycle', function () {
    test('server starts and listens successfully', function () {
      /* Verify the return value is an http.Server instance */
      expect(server).toBeInstanceOf(http.Server);

      /* Verify the server is actively accepting connections */
      expect(server.listening).toBe(true);

      /* Verify address metadata is populated */
      var address = server.address();
      expect(address).toBeTruthy();
      expect(typeof address.port).toBe('number');
      expect(address.port).toBeGreaterThan(0);
    });

    test('server responds to HTTP requests', async function () {
      var res = await makeRequest({ path: '/' });

      expect(res.statusCode).toBe(200);
      /* Rule R-001: byte-identical Hello, World!\n */
      expect(res.body).toBe('Hello, World!\n');
    });
  });

  /* ===================================================================
   * Test Group 2: Middleware Pipeline
   *
   * Tests the individual middleware components as they operate within
   * the composed pipeline:
   *   - Logger: monkey-patches res.end to log method, url, status, time
   *   - Compression: negotiates gzip via Accept-Encoding header
   * =================================================================== */
  describe('Middleware Pipeline', function () {
    test('request logging middleware is active', async function () {
      await makeRequest({ path: '/' });

      /*
       * The logger middleware (src/middleware/logger.js) calls console.log
       * with the format string: '[%s] %s %s %d %sms'
       * Arguments: timestamp, method, url, statusCode, responseTimeMs
       *
       * Filter out non-logger calls (e.g. startup message from createApp)
       * by matching the distinctive format string pattern.
       */
      var requestLogCall = logSpy.mock.calls.find(function (callArgs) {
        return typeof callArgs[0] === 'string' &&
               callArgs[0].indexOf('%s') !== -1 &&
               callArgs[0].indexOf('%d') !== -1 &&
               callArgs[0].indexOf('ms') !== -1;
      });

      expect(requestLogCall).toBeTruthy();

      /* Validate the captured log components */
      /* callArgs[1] = ISO timestamp (string) */
      expect(typeof requestLogCall[1]).toBe('string');
      /* callArgs[2] = HTTP method */
      expect(requestLogCall[2]).toBe('GET');
      /* callArgs[3] = URL path */
      expect(requestLogCall[3]).toBe('/');
      /* callArgs[4] = HTTP status code */
      expect(requestLogCall[4]).toBe(200);
      /* callArgs[5] = response time in ms (string like "0.52") */
      expect(typeof requestLogCall[5]).toBe('string');
    });

    test('compression middleware applies gzip when Accept-Encoding header is present', async function () {
      var res = await makeRequest({
        path: '/',
        headers: { 'accept-encoding': 'gzip' },
      });

      /* Verify the Content-Encoding header indicates gzip compression */
      expect(res.headers['content-encoding']).toBe('gzip');

      /*
       * Decompress the raw response body and verify byte-identical content.
       * Rule R-001: decompressed body must be exactly 'Hello, World!\n'.
       */
      var decompressed = zlib.gunzipSync(res.rawBody);
      expect(decompressed.toString()).toBe('Hello, World!\n');
    });

    test('compression middleware does NOT compress when Accept-Encoding is absent', async function () {
      var res = await makeRequest({ path: '/' });

      /* No Content-Encoding header should be set */
      expect(res.headers['content-encoding']).toBeUndefined();

      /* Body is raw, uncompressed Hello, World!\n */
      expect(res.body).toBe('Hello, World!\n');
    });
  });

  /* ===================================================================
   * Test Group 3: Route Integration
   *
   * Verifies that the routing logic in src/app.js correctly dispatches:
   *   - /health → healthHandler (JSON response with server metrics)
   *   - all other paths → helloHandler (text/plain Hello World)
   *
   * Rule R-009: /health is the ONLY differentiated route.
   * Rule R-002: All other paths are method-agnostic and path-agnostic.
   * =================================================================== */
  describe('Route Integration', function () {
    test('routes /health to health handler', async function () {
      var res = await makeRequest({ path: '/health' });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/json');

      /* Parse and validate the health response JSON structure */
      var json = JSON.parse(res.body);
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('uptime');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('memoryUsage');
      expect(json).toHaveProperty('pid');
      expect(json.status).toBe('OK');
    });

    test('routes all other paths to hello handler', async function () {
      var paths = ['/', '/foo', '/bar/baz', '/anything/else'];

      for (var i = 0; i < paths.length; i++) {
        var res = await makeRequest({ path: paths[i] });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/plain');
        /* Rule R-001: byte-identical Hello, World!\n */
        expect(res.body).toBe('Hello, World!\n');
      }
    });
  });

  /* ===================================================================
   * Test Group 4: Server Shutdown
   *
   * Validates that server.close() properly stops the server from accepting
   * new connections. This exercises the graceful-shutdown integration by
   * confirming the server transitions from the listening state to closed.
   *
   * NOTE: This test MUST run last because it closes the shared server
   * instance. The afterAll handler checks server.listening before
   * attempting close, so a double-close is prevented.
   * =================================================================== */
  describe('Server Shutdown', function () {
    test('server.close() stops accepting new connections', function (done) {
      var testPort = port;

      server.close(function onClose() {
        /* Server is closed — new connection attempts should be refused */
        var req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/',
            method: 'GET',
            headers: { 'Connection': 'close' },
          },
          function onResponse() {
            /* If we get a response, the server is still accepting — fail */
            done(new Error('Expected connection to be refused after server.close()'));
          }
        );

        req.on('error', function onError(err) {
          expect(err.code).toBe('ECONNREFUSED');
          done();
        });

        req.end();
      });
    });
  });
});
