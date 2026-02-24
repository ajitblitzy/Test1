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

const { createApp } = require('../src/app');
const { createTestServer, closeTestServer, makeRequest, expectHelloResponse } = require('./helpers');

describe('Hello World Response Contract', () => {
  let server, port;

  beforeAll(async () => {
    var ctx = await createTestServer(createApp);
    server = ctx.server;
    port = ctx.port;
  });

  afterAll(() => closeTestServer(server));

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
      var response = await makeRequest(port, '/');
      expect(response.statusCode).toBe(200);
    });

    test('responds with Content-Type text/plain', async () => {
      var response = await makeRequest(port, '/');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('responds with body Hello, World!\\n (byte-identical to original)', async () => {
      var response = await makeRequest(port, '/');

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
      expectHelloResponse(await makeRequest(port, '/', 'GET'));
    });

    test('POST request returns Hello, World!', async () => {
      expectHelloResponse(await makeRequest(port, '/', 'POST'));
    });

    test('PUT request returns Hello, World!', async () => {
      expectHelloResponse(await makeRequest(port, '/', 'PUT'));
    });

    test('DELETE request returns Hello, World!', async () => {
      expectHelloResponse(await makeRequest(port, '/', 'DELETE'));
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
      expectHelloResponse(await makeRequest(port, '/'));
    });

    test('/foo returns Hello, World!', async () => {
      expectHelloResponse(await makeRequest(port, '/foo'));
    });

    test('/bar/baz returns Hello, World!', async () => {
      expectHelloResponse(await makeRequest(port, '/bar/baz'));
    });

    test('/nonexistent/deep/path returns Hello, World!', async () => {
      expectHelloResponse(await makeRequest(port, '/nonexistent/deep/path'));
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
      var results = [];
      for (var i = 0; i < 5; i++) { results.push(await makeRequest(port, '/')); }
      for (var j = 0; j < results.length; j++) { expectHelloResponse(results[j]); }
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
      var res = await makeRequest(port, '/health');
      expect(res.headers['content-type']).toBe('application/json');
      expect(res.body).not.toBe('Hello, World!\n');
      var healthData = JSON.parse(res.body);
      expect(healthData).toHaveProperty('status');
      expect(healthData).toHaveProperty('uptime');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData).toHaveProperty('memoryUsage');
      expect(healthData).toHaveProperty('pid');
      expect(healthData.status).toBe('OK');
    });

    test('/health returns status code 200', async () => {
      expect((await makeRequest(port, '/health')).statusCode).toBe(200);
    });
  });
});
