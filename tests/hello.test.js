'use strict';

/**
 * Hello World Response Contract — Test Suite
 *
 * Validates the CORE business flow invariant: every HTTP request to any path
 * (except /health) must return status 200, Content-Type text/plain, and body
 * 'Hello, World!\n' — byte-identical to the original 14-line server.js.
 *
 * Test coverage matrix (AAP §0.7.5):
 *   - Response contract: status code, content-type header, response body
 *   - Method-agnostic behavior: GET, POST, PUT, DELETE (Rule R-002)
 *   - Path-agnostic behavior: /, /foo, /bar/baz, /nonexistent/deep/path (Rule R-002)
 *   - Idempotency: repeated identical requests produce identical responses
 *   - Health route differentiation: /health returns JSON, not text/plain (Rule R-009)
 *
 * Rules enforced:
 *   R-001 — Hello, World!\n must be byte-identical to original server.js line 9
 *   R-002 — Method-agnostic and path-agnostic (all paths except /health)
 *   R-003 — Status code 200 and Content-Type text/plain
 *   R-007 — CommonJS require syntax (no ES module imports)
 *   R-009 — /health is the only differentiated route
 *   R-010 — All tests pass with npm test
 *
 * @module tests/hello.test
 */

/*
 * Environment variables MUST be set BEFORE any application modules are loaded.
 * config/index.js reads process.env at require() time and Object.freeze()s the
 * resulting configuration, so these values must be in place before the first
 * require chain triggers module resolution.
 *
 * PORT=0        — OS auto-assigns a random available port (avoids conflicts)
 * LOG_LEVEL=silent — Suppresses request logger output during test execution
 * ENABLE_CLUSTERING=false — Forces single-process mode for deterministic tests
 */
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
process.env.ENABLE_CLUSTERING = 'false';

const http = require('http');
const { createApp } = require('../src/app');

describe('Hello World Response Contract', () => {
  /** @type {import('http').Server} */
  let server;

  /** @type {number} Dynamically assigned port from the OS */
  let port;

  /**
   * Makes an HTTP request to the test server and collects the full response.
   *
   * Returns a Promise that resolves with an object containing the status code,
   * response headers, and the complete response body as a string. The request
   * does NOT send an Accept-Encoding header, so the compression middleware is
   * a no-op and the response body arrives uncompressed and byte-identical.
   *
   * @param {string} [path='/'] - The URL path to request
   * @param {string} [method='GET'] - The HTTP method to use
   * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
   */
  function makeRequest(path, method) {
    if (path === undefined) { path = '/'; }
    if (method === undefined) { method = 'GET'; }

    return new Promise(function executor(resolve, reject) {
      var options = {
        hostname: '127.0.0.1',
        port: port,
        path: path,
        method: method,
      };

      var req = http.request(options, function onResponse(res) {
        var body = '';
        res.on('data', function onData(chunk) {
          body += chunk;
        });
        res.on('end', function onEnd() {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Start the server once before all tests in this suite.
   * Waits for the 'listening' event to ensure the OS has assigned a port
   * and the server is ready to accept connections.
   */
  beforeAll(function (done) {
    server = createApp();

    /* Handle the (unlikely) race where listen completes synchronously */
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
   * Close the server after all tests complete.
   * Prevents Jest "open handle" warnings by draining active connections.
   */
  afterAll(function (done) {
    if (server && server.listening) {
      server.close(function onClose() {
        done();
      });
    } else {
      done();
    }
  });

  /* ===================================================================
   * Test Group 1: Response Contract (Status Code, Headers, Body)
   *
   * Validates the three core invariants from AAP §0.7.5:
   *   - Status Code: 200
   *   - Content-Type Header: text/plain
   *   - Response Body: Hello, World!\n
   * =================================================================== */
  describe('Response Contract', () => {
    test('responds with status code 200', async () => {
      const response = await makeRequest('/');
      expect(response.statusCode).toBe(200);
    });

    test('responds with Content-Type text/plain', async () => {
      const response = await makeRequest('/');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('responds with body Hello, World!\\n (byte-identical to original)', async () => {
      const response = await makeRequest('/');

      /* Rule R-001: byte-identical verification — every character matters:
       *   'H' (capital H) + 'ello, ' (comma + space) + 'W' (capital W)
       *   + 'orld!' (exclamation) + '\n' (newline) */
      expect(response.body).toBe('Hello, World!\n');

      /* Additional byte-level verification */
      expect(response.body.length).toBe(14);
      expect(response.body.charCodeAt(0)).toBe(72);   /* 'H' */
      expect(response.body.charCodeAt(5)).toBe(44);   /* ',' */
      expect(response.body.charCodeAt(6)).toBe(32);   /* ' ' */
      expect(response.body.charCodeAt(7)).toBe(87);   /* 'W' */
      expect(response.body.charCodeAt(12)).toBe(33);  /* '!' */
      expect(response.body.charCodeAt(13)).toBe(10);  /* '\n' */
    });
  });

  /* ===================================================================
   * Test Group 2: Method-Agnostic Behavior (Rule R-002)
   *
   * The original server.js handler completely ignores the req object.
   * GET, POST, PUT, and DELETE must all produce the same 200 text/plain
   * Hello, World!\n response.
   * =================================================================== */
  describe('Method-Agnostic Behavior', () => {
    test('GET request returns Hello, World!', async () => {
      const res = await makeRequest('/', 'GET');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });

    test('POST request returns Hello, World!', async () => {
      const res = await makeRequest('/', 'POST');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });

    test('PUT request returns Hello, World!', async () => {
      const res = await makeRequest('/', 'PUT');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });

    test('DELETE request returns Hello, World!', async () => {
      const res = await makeRequest('/', 'DELETE');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });
  });

  /* ===================================================================
   * Test Group 3: Path-Agnostic Behavior (Rule R-002)
   *
   * All URL paths except /health must return the Hello World response.
   * The original server.js does zero URL inspection — req.url is ignored.
   * =================================================================== */
  describe('Path-Agnostic Behavior', () => {
    test('/ returns Hello, World!', async () => {
      const res = await makeRequest('/');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });

    test('/foo returns Hello, World!', async () => {
      const res = await makeRequest('/foo');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });

    test('/bar/baz returns Hello, World!', async () => {
      const res = await makeRequest('/bar/baz');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });

    test('/nonexistent/deep/path returns Hello, World!', async () => {
      const res = await makeRequest('/nonexistent/deep/path');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.body).toBe('Hello, World!\n');
    });
  });

  /* ===================================================================
   * Test Group 4: Idempotency
   *
   * AAP §0.7.5: "Idempotent: Identical response on repeated calls"
   * Sends 5 sequential GET requests to / and verifies every response is
   * byte-identical.
   * =================================================================== */
  describe('Idempotency', () => {
    test('repeated requests produce identical responses', async () => {
      var requestCount = 5;
      var results = [];

      for (var i = 0; i < requestCount; i++) {
        results.push(await makeRequest('/'));
      }

      for (var j = 0; j < results.length; j++) {
        expect(results[j].statusCode).toBe(200);
        expect(results[j].headers['content-type']).toBe('text/plain');
        expect(results[j].body).toBe('Hello, World!\n');
      }
    });
  });

  /* ===================================================================
   * Test Group 5: Health Route Differentiation (Rule R-009)
   *
   * /health is the ONLY route that diverges from the Hello World response.
   * It must return Content-Type application/json and a JSON body — NOT
   * the text/plain Hello, World!\n response.
   * =================================================================== */
  describe('Health Route Differentiation', () => {
    test('/health does NOT return Hello, World! response', async () => {
      const res = await makeRequest('/health');

      /* Content-Type must be application/json, not text/plain */
      expect(res.headers['content-type']).toBe('application/json');

      /* Body must NOT be the Hello World string */
      expect(res.body).not.toBe('Hello, World!\n');

      /* Body must be valid JSON with expected health fields */
      var healthData = JSON.parse(res.body);
      expect(healthData).toHaveProperty('status');
      expect(healthData).toHaveProperty('uptime');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData).toHaveProperty('memoryUsage');
      expect(healthData).toHaveProperty('pid');
      expect(healthData.status).toBe('OK');
    });

    test('/health returns status code 200', async () => {
      const res = await makeRequest('/health');
      expect(res.statusCode).toBe(200);
    });
  });
});
