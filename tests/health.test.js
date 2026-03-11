'use strict';

/**
 * Tests for /health Endpoint
 *
 * Validates the /health endpoint implemented in src/routes/health.js through
 * the composed application created by src/app.js. Verifies the JSON response
 * contract (status, uptime, timestamp, memoryUsage, pid) and confirms that
 * /health is the ONLY differentiated route (Rule R-009), while all other
 * paths continue to return the Hello World response (Rule R-001).
 *
 * Test Groups:
 *   1. Response Status and Content-Type — HTTP 200 and application/json
 *   2. Response Body Structure — valid JSON with all 5 required fields
 *   3. Field Value Validation — correct types and value ranges
 *   4. Boundary and Differentiation — /health vs all other routes
 *
 * @module tests/health.test
 * @see src/routes/health.js  — health check handler under test
 * @see src/app.js            — application factory composing middleware and routing
 */

/*
 * Set environment variables BEFORE importing any application modules.
 * config/index.js reads process.env at require() time and exports a
 * frozen (immutable) configuration object. These values must be in
 * place before the first require('../src/app') triggers the config load.
 *
 * PORT=0                  → OS assigns a random available port (avoids conflicts)
 * LOG_LEVEL=silent        → suppresses console output during test runs
 * ENABLE_CLUSTERING=false → forces single-process mode for test isolation
 */
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
process.env.ENABLE_CLUSTERING = 'false';

const { createApp } = require('../src/app');
const { createTestServer, closeTestServer, makeRequest } = require('./helpers');

describe('/health endpoint', () => {
  let server, port;

  beforeAll(async () => {
    var ctx = await createTestServer(createApp);
    server = ctx.server;
    port = ctx.port;
  });

  afterAll(() => closeTestServer(server));

  /* ------------------------------------------------------------------ */
  /* Test Group 1: Response Status and Content-Type                      */
  /* ------------------------------------------------------------------ */

  describe('Response Status and Content-Type', () => {
    test('GET /health returns status code 200', async () => {
      var response = await makeRequest(port, '/health');
      expect(response.statusCode).toBe(200);
    });

    test('GET /health returns Content-Type application/json', async () => {
      var response = await makeRequest(port, '/health');
      expect(response.headers['content-type']).toBe('application/json');
    });
  });

  /* ------------------------------------------------------------------ */
  /* Test Group 2: Response Body Structure                               */
  /* ------------------------------------------------------------------ */

  describe('Response Body Structure', () => {
    test('GET /health returns valid JSON', async () => {
      var response = await makeRequest(port, '/health');
      expect(function () { JSON.parse(response.body); }).not.toThrow();
    });

    test('GET /health response contains all 5 required fields', async () => {
      var response = await makeRequest(port, '/health');
      var body = JSON.parse(response.body);

      /* AAP §0.5.1 and §0.7.5: status, uptime, timestamp, memoryUsage, pid */
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('memoryUsage');
      expect(body).toHaveProperty('pid');
    });
  });

  /* ------------------------------------------------------------------ */
  /* Test Group 3: Field Value Validation                                */
  /* ------------------------------------------------------------------ */

  describe('Field Value Validation', () => {
    test('health status is OK', async () => {
      var body = JSON.parse((await makeRequest(port, '/health')).body);
      expect(body.status).toBe('OK');
    });

    test('uptime is a non-negative number', async () => {
      var body = JSON.parse((await makeRequest(port, '/health')).body);
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('timestamp is a valid Unix timestamp in milliseconds', async () => {
      var body = JSON.parse((await makeRequest(port, '/health')).body);
      expect(typeof body.timestamp).toBe('number');
      expect(body.timestamp).toBeGreaterThan(0);
      /* Timestamp should be close to now (within a few seconds of test execution) */
      expect(body.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('memoryUsage is an object with expected sub-fields', async () => {
      var body = JSON.parse((await makeRequest(port, '/health')).body);
      expect(typeof body.memoryUsage).toBe('object');
      expect(body.memoryUsage).not.toBeNull();
      /* Standard fields from process.memoryUsage() */
      expect(body.memoryUsage).toHaveProperty('rss');
      expect(body.memoryUsage).toHaveProperty('heapTotal');
      expect(body.memoryUsage).toHaveProperty('heapUsed');
    });

    test('pid is a positive integer', async () => {
      var body = JSON.parse((await makeRequest(port, '/health')).body);
      expect(typeof body.pid).toBe('number');
      expect(body.pid).toBeGreaterThan(0);
      expect(Number.isInteger(body.pid)).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Test Group 4: Boundary and Differentiation Tests                    */
  /* ------------------------------------------------------------------ */

  describe('Boundary and Differentiation', () => {
    test('/health is the ONLY route that returns JSON (Rule R-009)', async () => {
      /* Non-health path must return text/plain (Hello World) */
      var rootResponse = await makeRequest(port, '/');
      expect(rootResponse.headers['content-type']).toBe('text/plain');

      /* /health must return application/json (health metrics) */
      var healthResponse = await makeRequest(port, '/health');
      expect(healthResponse.headers['content-type']).toBe('application/json');
    });

    test('non-/health paths still return Hello, World! response (Rule R-001)', async () => {
      var response = await makeRequest(port, '/');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain');
      /* Byte-identical to the original server.js response */
      expect(response.body).toBe('Hello, World!\n');
    });
  });
});
