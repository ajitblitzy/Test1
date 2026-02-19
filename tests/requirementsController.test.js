'use strict';

/**
 * tests/requirementsController.test.js — Requirements API Controller Tests
 *
 * Comprehensive unit tests for src/controllers/requirementsController.js
 * covering POST requirement submission, GET listing, GET detail retrieval,
 * input validation, auto-staging behavior, and error responses.
 *
 * Independently runnable via: node tests/requirementsController.test.js
 *
 * Traceability:
 *   AAP §0.2.2 (New Test Files — tests/requirementsController.test.js)
 *   AAP §0.5.1 Group 7 (Tests)
 *   AAP §0.7.1 (Feature-Specific Rules — CommonJS, zero external deps)
 *
 * @module tests/requirementsController.test
 */

// ---------------------------------------------------------------------------
// External imports — Node.js built-in modules ONLY (AAP §0.7.1)
// Zero external test frameworks — no Mocha, Jest, Jasmine, etc.
// ---------------------------------------------------------------------------
const assert = require('assert');
const http = require('http');
const { EventEmitter } = require('events');

// ---------------------------------------------------------------------------
// Internal imports — modules under test and test data helpers
// ---------------------------------------------------------------------------
const requirementsController = require('../src/controllers/requirementsController');
const store = require('../src/models/requirementStore');
const config = require('../src/config');

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Creates a mock HTTP IncomingMessage (request) object.
 *
 * Extends EventEmitter to support the stream data/end event interface
 * required by bodyParser.parseBody(req). Uses process.nextTick to defer
 * event emission so that on() listeners are attached before events fire.
 *
 * @param {Object} options - Configuration options for the mock request
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} [options.url='/'] - Request URL
 * @param {Object} [options.headers] - Request headers
 * @param {Object} [options.params] - Parsed URL params (set by router)
 * @param {Object|string} [options.body] - Request body (object auto-stringified)
 * @returns {EventEmitter} Mock request with HTTP-compatible interface
 */
function createMockReq(options) {
  options = options || {};
  var req = new EventEmitter();
  req.method = options.method || 'GET';
  req.url = options.url || '/';
  req.headers = options.headers || { 'content-type': 'application/json' };
  req.params = options.params || {};

  // If body provided, simulate request stream data events.
  // String bodies are sent as-is (for malformed JSON testing);
  // object bodies are JSON-stringified first.
  if (options.body !== undefined) {
    var bodyStr = typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
    // Defer emission via process.nextTick so parseBody's on() listeners
    // are attached before data/end events fire.
    process.nextTick(function () {
      req.emit('data', Buffer.from(bodyStr));
      req.emit('end');
    });
  } else {
    // No body — emit end immediately (deferred).
    process.nextTick(function () {
      req.emit('end');
    });
  }

  return req;
}

/**
 * Creates a mock HTTP ServerResponse object.
 *
 * Captures writeHead/setHeader/end calls for assertion.
 * getBody() parses the captured body string as JSON, falling back to the
 * raw string if JSON parsing fails (for non-JSON responses).
 *
 * @returns {Object} Mock response with HTTP-compatible interface
 */
function createMockRes() {
  var res = {
    statusCode: null,
    headers: {},
    body: '',
    writeHead: function (code, hdrs) {
      res.statusCode = code;
      if (hdrs) {
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
     * Convenience method to parse the captured body as JSON.
     * @returns {Object|string} Parsed JSON object or raw body string
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
 * Resets the in-memory store between tests for full test isolation.
 * Clears all requirements and resets the currentProductionId pointer.
 */
function resetStore() {
  store.reset();
}

// ============================================================================
// Test Runner
// ============================================================================

/**
 * Main test runner — executes all test suites sequentially.
 *
 * Each test is wrapped in a try/catch block. The store is reset before
 * every test via resetStore() to guarantee isolation. Exit code 1 is used
 * on any failure so CI/npm scripts can detect test failures.
 */
async function runTests() {
  var passed = 0;
  var failed = 0;

  /**
   * Executes a single named test case with automatic store reset.
   * @param {string} name - Human-readable test name for console output
   * @param {Function} fn - Async test function containing assertions
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

  console.log('Requirements Controller Tests');
  console.log('=============================');
  console.log('');

  // ==========================================================================
  // Suite 1: POST /api/requirements — Requirement Submission
  // ==========================================================================
  console.log('Suite 1: POST /api/requirements');

  // Test 1.1: Valid prompt + description → 201 Created with auto-staging
  await test('1.1 Create requirement with valid prompt and description', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { prompt: 'Add greeting feature', description: 'A nice greeting' }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    // Verify HTTP 201 Created status
    assert.strictEqual(res.statusCode, 201, 'Status code should be 201 Created');

    // Verify response body structure and content
    var body = res.getBody();
    assert.ok(body.id, 'Response must have an id field');
    assert.strictEqual(typeof body.id, 'string', 'ID must be a string (UUID)');
    assert.ok(body.id.length > 0, 'ID must be non-empty');
    assert.strictEqual(body.status, config.states.STAGED, 'Status must be staged (auto-staging per AAP §0.5.1)');
    assert.strictEqual(body.prompt, 'Add greeting feature', 'Prompt must match submitted input');
    assert.strictEqual(body.description, 'A nice greeting', 'Description must match submitted input');
    assert.ok(body.prototype, 'Prototype field must exist in response');
    assert.ok(body.prototype.length > 0, 'Prototype content must be non-empty');
    assert.ok(body.createdAt, 'createdAt timestamp must exist');

    // Verify store has exactly 1 requirement
    var all = store.getAll();
    assert.strictEqual(all.length, 1, 'Store should contain exactly 1 requirement');
  });

  // Test 1.2: Prompt only (no description) → 201 with empty description default
  await test('1.2 Create requirement with prompt only, no description', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { prompt: 'Simple feature' }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 201, 'Status code should be 201');
    var body = res.getBody();
    assert.ok(body.id, 'Response must have an id');
    assert.strictEqual(body.description, '', 'Description should default to empty string');
    assert.strictEqual(body.prompt, 'Simple feature', 'Prompt must match input');
    assert.strictEqual(body.status, config.states.STAGED, 'Status must be staged');
  });

  // Test 1.3: Missing prompt field → 400 Bad Request
  await test('1.3 Reject creation with missing prompt field (400)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { description: 'No prompt here' }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 400, 'Status code should be 400 Bad Request');
    var body = res.getBody();
    assert.ok(body.message, 'Error response must have a message field');
    assert.ok(
      body.message.indexOf('Missing required field: prompt') !== -1,
      'Error message should state "Missing required field: prompt"'
    );
  });

  // Test 1.4: Empty/whitespace-only prompt → 400 Bad Request
  await test('1.4 Reject creation with empty/whitespace prompt (400)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { prompt: '   ' }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 400, 'Status code should be 400 Bad Request');
    var body = res.getBody();
    assert.ok(body.message, 'Error response must have a message field');
    assert.ok(
      body.message.indexOf('prompt') !== -1 || body.message.indexOf('Missing') !== -1,
      'Error should reference the prompt field'
    );
  });

  // Test 1.5: Non-string prompt (number) → 400 Bad Request
  await test('1.5 Reject creation with non-string prompt (400)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { prompt: 123 }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 400, 'Status code should be 400 Bad Request');
    var body = res.getBody();
    assert.ok(body.message, 'Error response must have a message field');
    assert.ok(
      body.message.indexOf('Prompt must be a string') !== -1,
      'Error message should state "Prompt must be a string"'
    );
  });

  // Test 1.6: Malformed JSON body → 400 Bad Request
  await test('1.6 Reject creation with malformed JSON body (400)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: 'not valid json{'
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 400, 'Status code should be 400 Bad Request');
    var body = res.getBody();
    assert.ok(body.message, 'Error response must have a message field');
    assert.ok(
      body.message.toLowerCase().indexOf('json') !== -1 ||
      body.message.toLowerCase().indexOf('invalid') !== -1,
      'Error message should mention invalid JSON'
    );
  });

  // Test 1.7: Auto-staging verification — store state after creation
  await test('1.7 Auto-staging: requirement is staged in store after creation', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { prompt: 'Auto-stage verification', description: 'Verify staging in store' }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 201, 'Creation should succeed with 201');
    var responseBody = res.getBody();
    var id = responseBody.id;

    // Verify requirement status in store via getById
    var storedReq = store.getById(id);
    assert.ok(storedReq, 'Requirement must exist in store after creation');
    assert.strictEqual(storedReq.status, config.states.STAGED,
      'Store requirement status must be "' + config.states.STAGED + '" after auto-staging');

    // Verify it appears in the getStaged() collection
    var staged = store.getStaged();
    assert.ok(staged.length >= 1, 'At least one staged requirement should exist');
    var found = staged.find(function (r) { return r.id === id; });
    assert.ok(found, 'Created requirement must appear in store.getStaged() results');
    assert.strictEqual(found.status, config.states.STAGED,
      'Staged item from getStaged() must have staged status');
  });

  // Test 1.8: Prototype content verification — non-empty and contains prompt
  await test('1.8 Prototype content is non-empty and includes prompt text', async function () {
    var promptText = 'Greeting endpoint feature';
    var req = createMockReq({
      method: 'POST',
      url: '/api/requirements',
      body: { prompt: promptText }
    });
    var res = createMockRes();

    await requirementsController.create(req, res);

    assert.strictEqual(res.statusCode, 201, 'Creation should succeed with 201');
    var responseBody = res.getBody();

    // Verify prototype field in HTTP response
    assert.ok(responseBody.prototype, 'Prototype must exist in response body');
    assert.strictEqual(typeof responseBody.prototype, 'string', 'Prototype must be a string');
    assert.ok(responseBody.prototype.length > 0, 'Prototype must be non-empty');
    assert.ok(
      responseBody.prototype.indexOf(promptText) !== -1,
      'Prototype content must include the original prompt text'
    );

    // Verify prototype in store matches response
    var storedReq = store.getById(responseBody.id);
    assert.ok(storedReq.prototype, 'Store requirement must have prototype content');
    assert.ok(
      storedReq.prototype.indexOf(promptText) !== -1,
      'Store prototype must also contain the original prompt text'
    );
  });

  console.log('');

  // ==========================================================================
  // Suite 2: GET /api/requirements — Requirement Listing
  // ==========================================================================
  console.log('Suite 2: GET /api/requirements');

  // Test 2.1: Empty store → 200 with empty array
  await test('2.1 List requirements from empty store returns empty array', async function () {
    var req = createMockReq({ method: 'GET', url: '/api/requirements' });
    var res = createMockRes();

    await requirementsController.list(req, res);

    assert.strictEqual(res.statusCode, 200, 'Status code should be 200 OK');
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'Response body must be an array');
    assert.strictEqual(body.length, 0, 'Array should be empty for clean store');
  });

  // Test 2.2: Populated store → 200 with array of 3 items
  await test('2.2 List requirements with 3 items in store', async function () {
    // Pre-populate store with 3 requirements directly via store.create()
    store.create('First prompt', 'Description 1');
    store.create('Second prompt', 'Description 2');
    store.create('Third prompt', 'Description 3');

    var req = createMockReq({ method: 'GET', url: '/api/requirements' });
    var res = createMockRes();

    await requirementsController.list(req, res);

    assert.strictEqual(res.statusCode, 200, 'Status code should be 200 OK');
    var body = res.getBody();
    assert.ok(Array.isArray(body), 'Response body must be an array');
    assert.strictEqual(body.length, 3, 'Array should contain exactly 3 items');

    // Verify each item has the required fields per AAP §0.4.3
    body.forEach(function (item, index) {
      assert.ok(item.id, 'Item ' + index + ' must have an id');
      assert.ok(item.prompt, 'Item ' + index + ' must have a prompt');
      assert.ok(item.status, 'Item ' + index + ' must have a status');
      assert.ok(item.createdAt, 'Item ' + index + ' must have a createdAt');
    });
  });

  console.log('');

  // ==========================================================================
  // Suite 3: GET /api/requirements/:id — Requirement Detail
  // ==========================================================================
  console.log('Suite 3: GET /api/requirements/:id');

  // Test 3.1: Existing requirement → 200 with full detail
  await test('3.1 Get existing requirement by ID returns full detail', async function () {
    // Create and stage a requirement directly via the store
    var created = store.create('Detail test prompt', 'Detail description');
    store.stageRequirement(created.id, '[Prototype] Detail test prototype content');

    var req = createMockReq({
      method: 'GET',
      url: '/api/requirements/' + created.id,
      params: { id: created.id }
    });
    var res = createMockRes();

    await requirementsController.getById(req, res);

    assert.strictEqual(res.statusCode, 200, 'Status code should be 200 OK');
    var body = res.getBody();
    assert.strictEqual(body.id, created.id, 'ID must match the created requirement');
    assert.strictEqual(body.prompt, 'Detail test prompt', 'Prompt must match');
    assert.strictEqual(body.status, config.states.STAGED, 'Status must reflect staged state');
    assert.ok(body.prototype, 'Prototype field must be present');
    assert.strictEqual(body.prototype, '[Prototype] Detail test prototype content',
      'Prototype content must match what was set during staging');
    assert.ok(body.createdAt, 'createdAt must be present');
    assert.ok(body.updatedAt, 'updatedAt must be present');
  });

  // Test 3.2: Non-existent ID → 404 Not Found
  await test('3.2 Get non-existent requirement returns 404', async function () {
    var req = createMockReq({
      method: 'GET',
      url: '/api/requirements/00000000-0000-0000-0000-000000000000',
      params: { id: '00000000-0000-0000-0000-000000000000' }
    });
    var res = createMockRes();

    await requirementsController.getById(req, res);

    assert.strictEqual(res.statusCode, 404, 'Status code should be 404 Not Found');
    var body = res.getBody();
    assert.ok(body.message, 'Error response must have a message field');
    assert.ok(
      body.message.indexOf('Requirement not found') !== -1,
      'Error message should state "Requirement not found"'
    );
  });

  // ==========================================================================
  // Final Results Summary
  // ==========================================================================
  console.log('');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute the test runner
runTests();
