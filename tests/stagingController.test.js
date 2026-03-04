'use strict';

/**
 * tests/stagingController.test.js — Staging API Controller Tests
 *
 * Comprehensive unit test suite for src/controllers/stagingController.js.
 * Tests staged prototype retrieval, listing, state filtering, 404 handling,
 * and Content-Type header verification.
 *
 * This file is independently runnable via: node tests/stagingController.test.js
 *
 * Traceability:
 *   AAP §0.2.2 (New Test Files — tests/stagingController.test.js)
 *   AAP §0.5.1 Group 7 (Tests)
 *   AAP §0.7.1 (Feature-Specific Rules)
 *
 * Rules enforced:
 *   - CommonJS ONLY: require() — NO ES module import syntax (AAP §0.7.1)
 *   - Zero external test frameworks — no Mocha, Jest, Jasmine, etc. (AAP §0.7.1)
 *   - Only Node.js built-in assert for assertions
 *   - Zero external dependencies — zero npm packages
 */

/* -----------------------------------------------------------------------
 * Module Imports — CommonJS ONLY (AAP §0.7.1)
 * ----------------------------------------------------------------------- */
const assert = require('assert');
const http = require('http');

/* Local imports to test against */
const stagingController = require('../src/controllers/stagingController');
const store = require('../src/models/requirementStore');
const config = require('../src/config');

/* -----------------------------------------------------------------------
 * Test Helper Functions
 *
 * Mock request and response objects that replicate the minimal Node.js
 * http.IncomingMessage and http.ServerResponse interfaces required by
 * the staging controller and the responseHelper utility it delegates to.
 * ----------------------------------------------------------------------- */

/**
 * Creates a mock HTTP request object with configurable properties.
 * The staging controller reads req.params.id for parameterized routes
 * and does not need method/url/headers for unit-level testing, but
 * they are included for completeness and future-proofing.
 *
 * @param {Object} options - Configuration for the mock request
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} [options.url='/staging'] - Request URL path
 * @param {Object} [options.headers={}] - Request headers
 * @param {Object} [options.params={}] - Router-extracted URL parameters
 * @returns {Object} Mock request object
 */
function createMockReq(options) {
  var opts = options || {};
  return {
    method: opts.method || 'GET',
    url: opts.url || '/staging',
    headers: opts.headers || {},
    params: opts.params || {}
  };
}

/**
 * Creates a mock HTTP response object that captures writeHead, setHeader,
 * and end calls. Designed to work with responseHelper.sendJSON() and
 * responseHelper.sendError() which call res.writeHead(code, headers) then
 * res.end(jsonString).
 *
 * Provides a getBody() convenience method to parse the captured JSON body.
 *
 * @returns {Object} Mock response object with statusCode, headers, body, and getBody()
 */
function createMockRes() {
  var res = {
    statusCode: null,
    headers: {},
    body: '',
    writeHead: function (code, hdrs) {
      res.statusCode = code;
      if (hdrs && typeof hdrs === 'object') {
        Object.assign(res.headers, hdrs);
      }
    },
    setHeader: function (name, value) {
      res.headers[name] = value;
    },
    end: function (data) {
      res.body = data || '';
    },
    /**
     * Parse the captured response body as JSON.
     * Returns raw body string if parsing fails.
     * @returns {Object|Array|string} Parsed JSON or raw body
     */
    getBody: function () {
      try {
        return JSON.parse(res.body);
      } catch (e) {
        return res.body;
      }
    }
  };
  return res;
}

/**
 * Creates a requirement in the store and stages it with prototype content.
 * Convenience helper for tests that need a requirement in 'staged' state.
 *
 * @param {string} [prompt='Test prompt'] - The requirement prompt text
 * @param {string} [desc='Test description'] - The requirement description
 * @returns {Object} The staged requirement object from the store
 */
function createStagedRequirement(prompt, desc) {
  var p = prompt || 'Test prompt';
  var d = desc || 'Test description';
  var req = store.create(p, d);
  store.stageRequirement(req.id, '[Prototype] Enhanced server response: ' + p);
  return store.getById(req.id);
}

/**
 * Resets the in-memory store to a clean state.
 * Called before each test to ensure isolation.
 */
function resetStore() {
  store.reset();
}

/* -----------------------------------------------------------------------
 * Test Runner
 *
 * A lightweight async test runner with pass/fail tracking, automatic
 * store reset before each test, and process.exit(1) on any failures.
 * ----------------------------------------------------------------------- */

/**
 * Runs all test suites and reports results.
 * Exits with code 1 if any test fails, code 0 if all pass.
 */
async function runTests() {
  var passed = 0;
  var failed = 0;

  /**
   * Runs a single test function with automatic store reset and error capture.
   * @param {string} name - Descriptive test name
   * @param {Function} fn - Test function (may be sync or async)
   */
  async function test(name, fn) {
    try {
      resetStore();
      await fn();
      console.log('  \u2713 ' + name);
      passed++;
    } catch (err) {
      console.error('  \u2717 ' + name);
      console.error('    ' + err.message);
      failed++;
    }
  }

  /* =====================================================================
   * Test Suite 1: GET /staging — List Staged Prototypes
   * ===================================================================== */
  console.log('Staging Controller Tests');
  console.log('========================');
  console.log('');
  console.log('  GET /staging - List Staged Prototypes');
  console.log('  -------------------------------------');

  /* Test 1.1: List staged prototypes when none exist (empty list) */
  await test('returns 200 with empty array when no staged prototypes exist', function () {
    var req = createMockReq({ url: '/staging' });
    var res = createMockRes();

    stagingController.list(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status code 200');
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'Expected response body to be an array');
    assert.deepStrictEqual(body, [], 'Expected empty array [] when no staged prototypes');
  });

  /* Test 1.2: List staged prototypes with data */
  await test('returns 200 with array of staged prototypes when data exists', function () {
    var staged1 = createStagedRequirement('Feature A', 'Description A');
    var staged2 = createStagedRequirement('Feature B', 'Description B');

    var req = createMockReq({ url: '/staging' });
    var res = createMockRes();

    stagingController.list(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status code 200');
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'Expected response body to be an array');
    assert.strictEqual(body.length, 2, 'Expected 2 staged prototypes');

    /* Verify each item has the required fields */
    body.forEach(function (item) {
      assert.ok(item.id, 'Each item should have an id field');
      assert.ok(item.prompt, 'Each item should have a prompt field');
      assert.ok(item.prototype, 'Each item should have a prototype field');
      assert.strictEqual(item.status, 'staged', 'Each item should have status "staged"');
    });
  });

  /* Test 1.3: Only staged requirements appear — approved/rejected are excluded */
  await test('only returns requirements in staged state, excludes approved and rejected', function () {
    /* Requirement A: stays in staged state */
    var reqA = createStagedRequirement('Feature A stays staged', 'Desc A');

    /* Requirement B: transition to approved */
    var reqB = createStagedRequirement('Feature B approved', 'Desc B');
    store.transition(reqB.id, config.states.APPROVED);

    /* Requirement C: transition to rejected */
    var reqC = createStagedRequirement('Feature C rejected', 'Desc C');
    store.transition(reqC.id, config.states.REJECTED);

    var req = createMockReq({ url: '/staging' });
    var res = createMockRes();

    stagingController.list(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status code 200');
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'Expected response body to be an array');
    assert.strictEqual(body.length, 1, 'Expected only 1 staged prototype (approved and rejected excluded)');
    assert.strictEqual(body[0].status, 'staged', 'The single result should be in staged state');
    assert.strictEqual(body[0].id, reqA.id, 'The single result should be requirement A');
  });

  /* Test 1.4: Content-Type is application/json */
  await test('sets Content-Type header to application/json on list response', function () {
    var req = createMockReq({ url: '/staging' });
    var res = createMockRes();

    stagingController.list(req, res);

    assert.strictEqual(
      res.headers['Content-Type'],
      'application/json',
      'Expected Content-Type to be application/json'
    );
  });

  /* Test 1.5: Production state requirements are excluded from list */
  await test('excludes production state requirements from staging list', function () {
    /* Requirement A: stays in staged state */
    var reqA = createStagedRequirement('Feature A staged', 'Desc A');

    /* Requirement B: transition through staged → approved → production */
    var reqB = createStagedRequirement('Feature B production', 'Desc B');
    store.transition(reqB.id, config.states.APPROVED);
    store.transition(reqB.id, config.states.PRODUCTION);

    var req = createMockReq({ url: '/staging' });
    var res = createMockRes();

    stagingController.list(req, res);

    var body = res.getBody();
    assert.strictEqual(body.length, 1, 'Expected only 1 staged prototype (production excluded)');
    assert.strictEqual(body[0].id, reqA.id, 'The single result should be requirement A');
  });

  /* =====================================================================
   * Test Suite 2: GET /staging/:id — View Specific Staged Prototype
   * ===================================================================== */
  console.log('');
  console.log('  GET /staging/:id - View Specific Staged Prototype');
  console.log('  -------------------------------------------------');

  /* Test 2.1: Successfully retrieve a staged prototype by ID */
  await test('returns 200 with full prototype details for a valid staged requirement', function () {
    var staged = createStagedRequirement('Test feature prompt', 'A detailed description');

    var req = createMockReq({
      url: '/staging/' + staged.id,
      params: { id: staged.id }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status code 200');

    var body = res.getBody();
    assert.strictEqual(body.id, staged.id, 'Response id should match the staged requirement id');
    assert.strictEqual(body.prompt, 'Test feature prompt', 'Response should include the prompt field');
    assert.strictEqual(body.description, 'A detailed description', 'Response should include the description field');
    assert.ok(body.prototype, 'Response should have a non-empty prototype field');
    assert.ok(body.prototype.length > 0, 'Prototype content should be non-empty');
    assert.strictEqual(body.status, 'staged', 'Response status should be "staged"');
    assert.ok(body.createdAt, 'Response should include a createdAt timestamp');
    assert.ok(body.updatedAt, 'Response should include an updatedAt timestamp');
  });

  /* Test 2.2: Non-existent ID returns 404 */
  await test('returns 404 with error message for non-existent UUID', function () {
    var fakeId = '00000000-0000-0000-0000-000000000000';

    var req = createMockReq({
      url: '/staging/' + fakeId,
      params: { id: fakeId }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status code 404');

    var body = res.getBody();
    assert.ok(
      body.message && body.message.indexOf('Staged prototype not found') !== -1,
      'Expected error message to contain "Staged prototype not found"'
    );
  });

  /* Test 2.3: Existing requirement NOT in staged state returns 404 */
  await test('returns 404 for an existing requirement that has been approved (not staged)', function () {
    var staged = createStagedRequirement('Feature to approve', 'Approve desc');
    store.transition(staged.id, config.states.APPROVED);

    var req = createMockReq({
      url: '/staging/' + staged.id,
      params: { id: staged.id }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status code 404');

    var body = res.getBody();
    assert.ok(
      body.message && body.message.indexOf('No staged prototype found for this requirement') !== -1,
      'Expected error message to contain "No staged prototype found for this requirement"'
    );
  });

  /* Test 2.4: Rejected requirement is not viewable through staging endpoint */
  await test('returns 404 for a rejected requirement viewed through staging endpoint', function () {
    var staged = createStagedRequirement('Feature to reject', 'Reject desc');
    store.transition(staged.id, config.states.REJECTED);

    var req = createMockReq({
      url: '/staging/' + staged.id,
      params: { id: staged.id }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status code 404 for rejected requirement');

    var body = res.getBody();
    assert.ok(
      body.message && body.message.indexOf('No staged prototype found for this requirement') !== -1,
      'Expected error message about no staged prototype for rejected requirement'
    );
  });

  /* Test 2.5: Production requirement is not viewable through staging endpoint */
  await test('returns 404 for a production requirement viewed through staging endpoint', function () {
    var staged = createStagedRequirement('Feature to promote', 'Promote desc');
    store.transition(staged.id, config.states.APPROVED);
    store.transition(staged.id, config.states.PRODUCTION);

    var req = createMockReq({
      url: '/staging/' + staged.id,
      params: { id: staged.id }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status code 404 for production requirement');

    var body = res.getBody();
    assert.ok(
      body.message && body.message.indexOf('No staged prototype found for this requirement') !== -1,
      'Expected error message about no staged prototype for production requirement'
    );
  });

  /* Test 2.6: Missing params.id returns 404 */
  await test('returns 404 when req.params.id is missing or undefined', function () {
    var req = createMockReq({
      url: '/staging/',
      params: {}
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status code 404 when no id provided');

    var body = res.getBody();
    assert.ok(
      body.message && body.message.indexOf('Staged prototype not found') !== -1,
      'Expected error message "Staged prototype not found" when id is missing'
    );
  });

  /* Test 2.7: Content-Type is application/json for getById success response */
  await test('sets Content-Type to application/json for getById success response', function () {
    var staged = createStagedRequirement('Content-Type test', 'Desc');

    var req = createMockReq({
      url: '/staging/' + staged.id,
      params: { id: staged.id }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(
      res.headers['Content-Type'],
      'application/json',
      'Expected Content-Type to be application/json for getById success'
    );
  });

  /* Test 2.8: Content-Type is application/json for getById 404 error response */
  await test('sets Content-Type to application/json for getById 404 error response', function () {
    var fakeId = '11111111-1111-1111-1111-111111111111';

    var req = createMockReq({
      url: '/staging/' + fakeId,
      params: { id: fakeId }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(
      res.headers['Content-Type'],
      'application/json',
      'Expected Content-Type to be application/json even for 404 errors'
    );
  });

  /* Test 2.9: getById response includes correct prototype content */
  await test('getById response includes the exact prototype content that was staged', function () {
    var created = store.create('Specific prototype test', 'Desc');
    var protoContent = '[Prototype] Custom enhanced response for specific test';
    store.stageRequirement(created.id, protoContent);

    var req = createMockReq({
      url: '/staging/' + created.id,
      params: { id: created.id }
    });
    var res = createMockRes();

    stagingController.getById(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status code 200');
    var body = res.getBody();
    assert.strictEqual(body.prototype, protoContent, 'Prototype content should exactly match what was staged');
  });

  /* =====================================================================
   * Results Summary
   * ===================================================================== */
  console.log('');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  if (failed > 0) {
    process.exit(1);
  }
}

/* Execute all tests */
runTests();
