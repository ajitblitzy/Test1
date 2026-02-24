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
const { createTestServer, closeTestServer, makeRequest } = require('./helpers');

describe('Application Integration Tests', function () {
  var server, port, logSpy, errorSpy;

  /**
   * Start the server and install console spies before all tests.
   * Console spies suppress stdout/stderr while allowing the logger
   * middleware to execute, enabling the logger test to inspect spy history.
   */
  beforeAll(async function () {
    logSpy = jest.spyOn(console, 'log').mockImplementation(function () {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(function () {});
    var ctx = await createTestServer(createApp);
    server = ctx.server;
    port = ctx.port;
  });

  /** Clear spy call history before each test for isolated assertions. */
  beforeEach(function () { logSpy.mockClear(); errorSpy.mockClear(); });

  /** Restore mocks and close the server after all tests complete. */
  afterAll(async function () { jest.restoreAllMocks(); await closeTestServer(server); });

  /* ===================================================================
   * Test Group 1: Server Lifecycle
   *
   * Verifies that createApp() returns a properly configured, listening
   * HTTP server that responds correctly through the full middleware
   * pipeline (logger → compression → routing → handler).
   * =================================================================== */
  describe('Server Lifecycle', function () {
    test('server starts and listens successfully', function () {
      expect(server).toBeInstanceOf(http.Server);
      expect(server.listening).toBe(true);
      var address = server.address();
      expect(address).toBeTruthy();
      expect(typeof address.port).toBe('number');
      expect(address.port).toBeGreaterThan(0);
    });

    test('server responds to HTTP requests', async function () {
      var res = await makeRequest(port, '/');
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
      await makeRequest(port, '/');

      /*
       * The logger middleware calls console.log with the format string:
       * '[%s] %s %s %d %sms' — match on the distinctive format tokens.
       */
      var logCall = logSpy.mock.calls.find(function (a) {
        return typeof a[0] === 'string' && a[0].indexOf('%s') !== -1 && a[0].indexOf('%d') !== -1;
      });
      expect(logCall).toBeTruthy();
      expect(typeof logCall[1]).toBe('string');
      expect(logCall[2]).toBe('GET');
      expect(logCall[3]).toBe('/');
      expect(logCall[4]).toBe(200);
      expect(typeof logCall[5]).toBe('string');
    });

    test('compression applies gzip when Accept-Encoding present', async function () {
      var res = await makeRequest(port, { path: '/', headers: { 'accept-encoding': 'gzip' } });
      expect(res.headers['content-encoding']).toBe('gzip');
      /* Rule R-001: decompressed body must be byte-identical */
      expect(zlib.gunzipSync(res.rawBody).toString()).toBe('Hello, World!\n');
    });

    test('compression does NOT compress when Accept-Encoding absent', async function () {
      var res = await makeRequest(port, '/');
      expect(res.headers['content-encoding']).toBeUndefined();
      expect(res.body).toBe('Hello, World!\n');
    });
  });

  /* ===================================================================
   * Test Group 3: Route Integration
   *
   * Verifies that the routing logic in src/app.js correctly dispatches:
   *   - /health → healthHandler (JSON response with server metrics)
   *   - all other paths → helloHandler (text/plain Hello World)
   * =================================================================== */
  describe('Route Integration', function () {
    test('routes /health to health handler', async function () {
      var res = await makeRequest(port, '/health');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/json');
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
        var res = await makeRequest(port, paths[i]);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/plain');
        expect(res.body).toBe('Hello, World!\n');
      }
    });
  });

  /* ===================================================================
   * Test Group 4: Server Shutdown
   *
   * Validates that server.close() properly stops the server from accepting
   * new connections. This test MUST run last because it closes the shared
   * server instance. The afterAll handler checks server.listening before
   * attempting close, so a double-close is prevented.
   * =================================================================== */
  describe('Server Shutdown', function () {
    test('server.close() stops accepting new connections', function (done) {
      var testPort = port;
      server.close(function () {
        var req = http.request(
          { hostname: '127.0.0.1', port: testPort, path: '/', method: 'GET', headers: { 'Connection': 'close' } },
          function () { done(new Error('Expected ECONNREFUSED after server.close()')); }
        );
        req.on('error', function (err) { expect(err.code).toBe('ECONNREFUSED'); done(); });
        req.end();
      });
    });
  });
});
