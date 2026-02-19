'use strict';

/**
 * tests/router.test.js — Router Unit Tests
 *
 * Comprehensive unit tests for src/router.js covering route registration,
 * pattern matching, parameterized URL extraction, 404/405 handling, and
 * edge cases.  Tests all 10 registered routes per AAP §0.4.3.
 *
 * Independently runnable via:  node tests/router.test.js
 *
 * Traceability:
 *   AAP §0.2.2  — New Test Files (tests/router.test.js)
 *   AAP §0.4.3  — API Route Registry (10 routes)
 *   AAP §0.5.1  — Group 7 Tests
 *   AAP §0.7.1  — CommonJS, Zero External Dependencies
 */

/* ---------------------------------------------------------------------------
 * Environment Setup — MUST happen BEFORE module loading so that
 * src/config.js picks up the test API key for config.apiKey.
 * --------------------------------------------------------------------------- */
var originalApiKey = process.env.BLITZY_CLIENT_API_KEY;
var TEST_API_KEY = 'test-router-api-key-2025';
process.env.BLITZY_CLIENT_API_KEY = TEST_API_KEY;

/* ---------------------------------------------------------------------------
 * Module Imports — Node.js built-in only (AAP §0.7.1)
 * --------------------------------------------------------------------------- */
var assert = require('assert');
var http = require('http');
var EventEmitter = require('events').EventEmitter;

/* Internal imports — module under test and test data management */
var router = require('../src/router');
var store = require('../src/models/requirementStore');

/* ---------------------------------------------------------------------------
 * Test Helper Functions
 * --------------------------------------------------------------------------- */

/**
 * Creates a mock HTTP request extending EventEmitter for stream compatibility
 * with the bodyParser middleware (data + end events).
 *
 * @param {string} method - HTTP method (GET, POST, DELETE, PUT, etc.)
 * @param {string} url    - Request URL path (may include query string)
 * @param {Object} [opts] - Optional: { headers, body }
 * @returns {EventEmitter} Mock request with method, url, headers, params
 */
function createMockReq(method, url, opts) {
  opts = opts || {};
  var req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = opts.headers || {};
  req.params = {};

  /* Defer stream events via nextTick so bodyParser listeners attach first */
  if (opts.body !== undefined) {
    var bodyStr = typeof opts.body === 'string'
      ? opts.body
      : JSON.stringify(opts.body);
    process.nextTick(function () {
      req.emit('data', Buffer.from(bodyStr));
      req.emit('end');
    });
  } else {
    process.nextTick(function () {
      req.emit('end');
    });
  }

  return req;
}

/**
 * Creates a mock HTTP response that captures status, headers, and body.
 * Includes a 'done' Promise that resolves when res.end() is called,
 * enabling await-based testing of both sync and async handlers.
 *
 * @returns {Object} Mock response with writeHead, setHeader, end, getBody, done
 */
function createMockRes() {
  var resolvePromise;
  var res = {
    statusCode: null,
    headers: {},
    body: '',
    finished: false,
    headersSent: false,
    writeHead: function (code, hdrs) {
      res.statusCode = code;
      res.headersSent = true;
      if (hdrs) { Object.assign(res.headers, hdrs); }
    },
    setHeader: function (name, value) {
      res.headers[name] = value;
    },
    end: function (data) {
      res.body = data || '';
      res.finished = true;
      res.headersSent = true;
      if (resolvePromise) { resolvePromise(); }
    },
    getBody: function () {
      try { return JSON.parse(res.body); } catch (e) { return res.body; }
    },
    done: new Promise(function (resolve) { resolvePromise = resolve; })
  };
  return res;
}

/**
 * Resets the in-memory data store for test isolation.
 */
function resetStore() {
  store.reset();
}

/**
 * Creates a requirement and immediately stages it with prototype content.
 *
 * @param {string} [prompt]  - Prompt text (default: 'Test prompt')
 * @param {string} [desc]    - Description (default: 'Test description')
 * @returns {Object} The staged requirement object from the store
 */
function createStagedRequirement(prompt, desc) {
  prompt = prompt || 'Test prompt';
  desc = desc || 'Test description';
  var requirement = store.create(prompt, desc);
  store.stageRequirement(requirement.id, '[Prototype] Enhanced server response: ' + prompt);
  return store.getById(requirement.id);
}

/* ---------------------------------------------------------------------------
 * Test Runner — sequential execution with pass/fail tracking
 * --------------------------------------------------------------------------- */

async function runTests() {
  var passed = 0;
  var failed = 0;

  /**
   * Executes a single named test with store reset and 5-second timeout guard.
   * @param {string} name - Human-readable test name
   * @param {Function} fn - Async test function
   */
  async function test(name, fn) {
    var timeoutId;
    try {
      resetStore();
      await Promise.race([
        fn(),
        new Promise(function (_, reject) {
          timeoutId = setTimeout(function () {
            reject(new Error('Test timed out after 5000ms'));
          }, 5000);
        })
      ]);
      clearTimeout(timeoutId);
      console.log('  \u2713 ' + name);
      passed++;
    } catch (err) {
      if (timeoutId) { clearTimeout(timeoutId); }
      console.error('  \u2717 ' + name);
      console.error('    ' + err.message);
      failed++;
    }
  }

  console.log('Router Tests');
  console.log('============');

  /* =====================================================================
   * Suite 1: Route Matching — Static Routes
   * ===================================================================== */
  console.log('\n  Suite 1: Route Matching \u2014 Static Routes');

  /* Route 1 of 10: GET / — production controller (backward compat) */
  await test('1.1: GET / returns default production content Hello, World!', async function () {
    var req = createMockReq('GET', '/');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body, 'Hello, World!\n');
  });

  /* Route 2 of 10: GET /health — health check endpoint */
  await test('1.2: GET /health returns status ok with uptime', async function () {
    var req = createMockReq('GET', '/health');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number', 'uptime should be a number');
    assert.ok(body.uptime >= 0, 'uptime should be non-negative');
  });

  /* Route 6 of 10: GET /staging — staging controller list */
  await test('1.3: GET /staging returns empty staged list', async function () {
    var req = createMockReq('GET', '/staging');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'response should be an array');
    assert.strictEqual(body.length, 0);
  });

  /* Route 3 of 10: POST /api/requirements — create new requirement */
  await test('1.4: POST /api/requirements creates requirement (201)', async function () {
    var req = createMockReq('POST', '/api/requirements', {
      body: { prompt: 'Test feature request' }
    });
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 201);
    var body = res.getBody();
    assert.ok(body.id, 'response should have an id');
    assert.strictEqual(body.status, 'staged');
  });

  /* Route 4 of 10: GET /api/requirements — list all requirements */
  await test('1.5: GET /api/requirements returns requirements list', async function () {
    var req = createMockReq('GET', '/api/requirements');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'response should be an array');
  });

  /* =====================================================================
   * Suite 2: Route Matching — Parameterized Routes
   * ===================================================================== */
  console.log('\n  Suite 2: Route Matching \u2014 Parameterized Routes');

  /* Route 5 of 10: GET /api/requirements/:id */
  await test('2.1: GET /api/requirements/:id returns requirement detail', async function () {
    var staged = createStagedRequirement('my feature', 'feature desc');
    var req = createMockReq('GET', '/api/requirements/' + staged.id);
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.id, staged.id);
    assert.strictEqual(body.status, 'staged');
    assert.strictEqual(body.prompt, 'my feature');
  });

  /* Route 7 of 10: GET /staging/:id */
  await test('2.2: GET /staging/:id returns staged prototype', async function () {
    var staged = createStagedRequirement('new endpoint', 'add endpoint');
    var req = createMockReq('GET', '/staging/' + staged.id);
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.id, staged.id);
    assert.ok(body.prototype, 'should include prototype content');
  });

  /* Route 8 of 10: POST /api/approve/:id */
  await test('2.3: POST /api/approve/:id approves staged requirement', async function () {
    var staged = createStagedRequirement('approve test');
    var req = createMockReq('POST', '/api/approve/' + staged.id, {
      headers: { 'x-api-key': TEST_API_KEY }
    });
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.status, 'approved');
    /* Verify store state persisted correctly */
    var updated = store.getById(staged.id);
    assert.strictEqual(updated.status, 'approved');
  });

  /* Route 9 of 10: POST /api/reject/:id */
  await test('2.4: POST /api/reject/:id rejects staged requirement', async function () {
    var staged = createStagedRequirement('reject test');
    var req = createMockReq('POST', '/api/reject/' + staged.id, {
      headers: { 'x-api-key': TEST_API_KEY },
      body: { reason: 'not ready for production' }
    });
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.status, 'rejected');
    var updated = store.getById(staged.id);
    assert.strictEqual(updated.status, 'rejected');
  });

  /* Route 10 of 10: POST /api/promote/:id */
  await test('2.5: POST /api/promote/:id promotes approved requirement', async function () {
    var staged = createStagedRequirement('promote test');
    /* Transition staged -> approved before promoting */
    store.transition(staged.id, 'approved');
    var req = createMockReq('POST', '/api/promote/' + staged.id, {
      headers: { 'x-api-key': TEST_API_KEY }
    });
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.status, 'production');
    var updated = store.getById(staged.id);
    assert.strictEqual(updated.status, 'production');
  });

  /* =====================================================================
   * Suite 3: 404 Not Found Handling
   * ===================================================================== */
  console.log('\n  Suite 3: 404 Not Found Handling');

  await test('3.1: GET /nonexistent/path returns 404 Not Found', async function () {
    var req = createMockReq('GET', '/nonexistent/path');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 404);
    var body = res.getBody();
    assert.strictEqual(body.error, 'Not Found');
    /* Verify full error response shape with deepStrictEqual */
    assert.deepStrictEqual(
      { error: body.error, statusCode: body.statusCode },
      { error: 'Not Found', statusCode: 404 }
    );
  });

  await test('3.2: GET /api/unknown returns 404 Not Found', async function () {
    var req = createMockReq('GET', '/api/unknown');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 404);
    var body = res.getBody();
    assert.strictEqual(body.error, 'Not Found');
  });

  /* =====================================================================
   * Suite 4: 405 Method Not Allowed Handling
   * ===================================================================== */
  console.log('\n  Suite 4: 405 Method Not Allowed Handling');

  await test('4.1: DELETE / returns 405 Method Not Allowed', async function () {
    var req = createMockReq('DELETE', '/');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 405);
    var body = res.getBody();
    assert.strictEqual(body.error, 'Method Not Allowed');
    assert.deepStrictEqual(
      { error: body.error, statusCode: body.statusCode },
      { error: 'Method Not Allowed', statusCode: 405 }
    );
  });

  await test('4.2: PUT /api/requirements returns 405', async function () {
    var req = createMockReq('PUT', '/api/requirements');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 405);
    var body = res.getBody();
    assert.strictEqual(body.error, 'Method Not Allowed');
  });

  /* =====================================================================
   * Suite 5: Edge Cases
   * ===================================================================== */
  console.log('\n  Suite 5: Edge Cases');

  /* Trailing slash normalization — router's normalizePath strips trailing / */
  await test('5.1: GET /health/ with trailing slash still matches route', async function () {
    var req = createMockReq('GET', '/health/');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.strictEqual(body.status, 'ok');
  });

  /* Query string handling — url.parse separates pathname from query */
  await test('5.2: GET /api/requirements?page=1 ignores query string', async function () {
    var req = createMockReq('GET', '/api/requirements?page=1');
    var res = createMockRes();
    router.handle(req, res);
    await res.done;
    assert.strictEqual(res.statusCode, 200);
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'should return array despite query string');
  });

  /* Export verification — server.js depends on router.handle being a function */
  await test('5.3: router.handle is an exported function', async function () {
    assert.strictEqual(typeof router.handle, 'function');
    assert.ok(router.handle, 'handle should be truthy');
  });

  /* =====================================================================
   * Suite 6: HTTP Integration — verifies router works with real http server
   * Uses http.createServer (schema member_accessed requirement)
   * ===================================================================== */
  console.log('\n  Suite 6: HTTP Integration');

  await test('6.1: http.createServer with router.handle serves GET /', async function () {
    var server = http.createServer(function (req, res) {
      router.handle(req, res);
    });

    await new Promise(function (resolve, reject) {
      server.listen(0, '127.0.0.1', function () {
        var addr = server.address();
        var clientReq = http.request({
          hostname: addr.address,
          port: addr.port,
          path: '/',
          method: 'GET'
        }, function (clientRes) {
          var data = '';
          clientRes.on('data', function (chunk) { data += chunk; });
          clientRes.on('end', function () {
            try {
              assert.strictEqual(clientRes.statusCode, 200);
              assert.strictEqual(data, 'Hello, World!\n');
              server.close(function () { resolve(); });
            } catch (err) {
              server.close(function () { reject(err); });
            }
          });
        });
        clientReq.on('error', function (err) {
          server.close(function () { reject(err); });
        });
        clientReq.end();
      });
    });
  });

  /* =====================================================================
   * Results and Cleanup
   * ===================================================================== */
  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  /* Restore original API key environment variable */
  if (originalApiKey !== undefined) {
    process.env.BLITZY_CLIENT_API_KEY = originalApiKey;
  } else {
    delete process.env.BLITZY_CLIENT_API_KEY;
  }

  if (failed > 0) {
    process.exit(1);
  }
}

/* Execute the test runner */
runTests().catch(function (err) {
  console.error('Test runner failed: ' + err.message);
  console.error(err.stack);
  process.exit(1);
});
