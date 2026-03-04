'use strict';

/**
 * tests/approvalController.test.js — Approval Workflow Controller Tests
 *
 * Comprehensive unit tests for src/controllers/approvalController.js covering:
 *   - POST /api/approve/:id  — Approve workflow (staged → approved)
 *   - POST /api/reject/:id   — Reject workflow (staged → rejected)
 *   - POST /api/promote/:id  — Promote workflow (approved → production)
 *   - Authentication enforcement on all three endpoints
 *   - State machine compliance, idempotent transitions, terminal states
 *   - API key security (values never in error responses)
 *
 * Independently runnable: node tests/approvalController.test.js
 *
 * Traceability:
 *   AAP §0.2.2  — New Test Files
 *   AAP §0.5.1  — Group 7 Tests
 *   AAP §0.7.1  — Feature-Specific Rules
 *   AAP §0.7.3  — Security Requirements
 *
 * @module tests/approvalController.test
 */

/* -----------------------------------------------------------------------
 * Phase 1: Module Imports — CommonJS ONLY (AAP §0.7.1)
 * Zero external test frameworks. Only Node.js built-in modules.
 * ----------------------------------------------------------------------- */

const assert = require('assert');
const http = require('http');
const { EventEmitter } = require('events');

const approvalController = require('../src/controllers/approvalController');
const store = require('../src/models/requirementStore');
const config = require('../src/config');

/* -----------------------------------------------------------------------
 * Test Constants
 * ----------------------------------------------------------------------- */

/** Known API key value used across all authentication tests */
const TEST_API_KEY = 'test-api-key-12345';

/* -----------------------------------------------------------------------
 * Phase 2: Test Helper Functions
 * ----------------------------------------------------------------------- */

/**
 * Creates a mock HTTP request object that extends EventEmitter.
 *
 * EventEmitter support is required because the reject handler calls
 * parseBody(req), which attaches 'data' and 'end' listeners on the
 * request stream. process.nextTick defers event emission so that
 * parseBody's listeners are attached before events fire.
 *
 * @param {Object} [options={}] - Request configuration
 * @param {string} [options.method='POST'] - HTTP method
 * @param {string} [options.url='/'] - Request URL
 * @param {Object} [options.headers={}] - Request headers (use lowercase keys)
 * @param {Object} [options.params={}] - Router-parsed URL parameters
 * @param {*} [options.body] - Request body (will be JSON-serialized if object)
 * @returns {EventEmitter} Mock request object with stream support
 */
function createMockReq(options) {
  var opts = options || {};
  var req = new EventEmitter();

  req.method = opts.method || 'POST';
  req.url = opts.url || '/';
  req.headers = opts.headers || {};
  req.params = opts.params || {};

  /* Schedule body emission on next tick so parseBody's listeners attach first */
  if (opts.body !== undefined && opts.body !== null) {
    var bodyStr = typeof opts.body === 'string'
      ? opts.body
      : JSON.stringify(opts.body);
    process.nextTick(function () {
      req.emit('data', Buffer.from(bodyStr, 'utf-8'));
      req.emit('end');
    });
  } else {
    /* Empty body — still emit 'end' so parseBody resolves with {} */
    process.nextTick(function () {
      req.emit('end');
    });
  }

  return req;
}

/**
 * Creates a mock HTTP response object that captures writeHead, setHeader,
 * and end calls for assertion. Mirrors the interface expected by
 * responseHelper's sendJSON and sendError functions.
 *
 * @returns {Object} Mock response with statusCode, headers, body, ended properties
 */
function createMockRes() {
  var res = {
    statusCode: null,
    headers: {},
    body: '',
    ended: false,
    writeHead: function (code, hdrs) {
      res.statusCode = code;
      if (hdrs && typeof hdrs === 'object') {
        var keys = Object.keys(hdrs);
        for (var i = 0; i < keys.length; i++) {
          res.headers[keys[i]] = hdrs[keys[i]];
        }
      }
    },
    setHeader: function (name, value) {
      res.headers[name] = value;
    },
    end: function (data) {
      res.body = data || '';
      res.ended = true;
    }
  };
  return res;
}

/**
 * Parses a mock response body string back into a JavaScript object.
 *
 * @param {Object} res - Mock response object from createMockRes()
 * @returns {Object|string} Parsed JSON object, or the raw string if parsing fails
 */
function parseResBody(res) {
  if (!res.body || res.body.length === 0) {
    return {};
  }
  try {
    return JSON.parse(res.body);
  } catch (e) {
    return res.body;
  }
}

/**
 * Resets the requirement store between tests to ensure complete isolation.
 * Clears all requirements and the currentProductionId pointer.
 */
function resetStore() {
  store.reset();
}

/**
 * Creates a requirement in the 'staged' state — the prerequisite for
 * approval and rejection tests. Calls store.create() followed by
 * store.stageRequirement() with prototype content.
 *
 * @returns {Object} The staged requirement object (defensive copy from store)
 */
function createStagedRequirement() {
  var created = store.create('Test prompt for approval', 'Test description');
  store.stageRequirement(created.id, '[Prototype] Enhanced test content for review');
  return store.getById(created.id);
}

/**
 * Creates a requirement in the 'approved' state — the prerequisite for
 * promotion tests. Creates a staged requirement and then transitions it
 * to approved via store.transition().
 *
 * @returns {Object} The approved requirement object (defensive copy from store)
 */
function createApprovedRequirement() {
  var staged = createStagedRequirement();
  store.transition(staged.id, config.states.APPROVED);
  return store.getById(staged.id);
}

/* -----------------------------------------------------------------------
 * Phase 3 & 4: Test Runner and Test Suites
 * ----------------------------------------------------------------------- */

/**
 * Main test runner — executes all test suites sequentially with proper
 * setup, teardown, and result reporting. Exits with code 1 on any failure.
 */
async function runTests() {
  /* Save original config.apiKey and set to known test value.
   * The authGuard reads config.apiKey on each authenticate() call,
   * so this change takes effect immediately. */
  var originalApiKey = config.apiKey;
  config.apiKey = TEST_API_KEY;

  var passed = 0;
  var failed = 0;

  /**
   * Runs a single named test with automatic store reset and error handling.
   *
   * @param {string} name - Descriptive test name for output
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
      if (err.stack) {
        /* Show first line of stack trace for debugging context */
        var stackLines = err.stack.split('\n');
        if (stackLines.length > 1) {
          console.error('    ' + stackLines[1].trim());
        }
      }
      failed++;
    }
  }

  /* =====================================================================
   * TEST SUITE 1: POST /api/approve/:id — Approve Workflow Tests
   * ===================================================================== */
  console.log('\nApproval Controller Tests');
  console.log('========================\n');
  console.log('Suite 1: POST /api/approve/:id');
  console.log('------------------------------');

  /* Test 1.1: Successfully approve a staged requirement */
  await test('1.1 Successfully approve a staged requirement', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id }
    });
    var res = createMockRes();

    await approvalController.approve(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status 200');
    var body = parseResBody(res);
    assert.strictEqual(body.status, config.states.APPROVED,
      'Expected status field to be approved');
    assert.strictEqual(body.id, staged.id, 'Expected matching requirement ID');
    assert.ok(body.message, 'Expected a success message');

    /* Verify store state was updated */
    var updated = store.getById(staged.id);
    assert.strictEqual(updated.status, config.states.APPROVED,
      'Store should reflect approved state');
  });

  /* Test 1.2: Reject approval without API key (401 Unauthorized) */
  await test('1.2 Reject approval without API key (401)', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: {},  /* No x-api-key header */
      params: { id: staged.id }
    });
    var res = createMockRes();

    await approvalController.approve(req, res);

    assert.strictEqual(res.statusCode, 401, 'Expected status 401');
    var body = parseResBody(res);
    assert.ok(body.message.indexOf('Invalid or missing API key') !== -1,
      'Expected auth failure message');
    assert.strictEqual(body.error, 'Unauthorized',
      'Expected Unauthorized error label');
  });

  /* Test 1.3: Reject approval with wrong API key (401 Unauthorized) */
  await test('1.3 Reject approval with wrong API key (401)', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: { 'x-api-key': 'completely-wrong-key-value' },
      params: { id: staged.id }
    });
    var res = createMockRes();

    await approvalController.approve(req, res);

    assert.strictEqual(res.statusCode, 401, 'Expected status 401 for wrong key');
  });

  /* Test 1.4: Reject approval for non-existent requirement (404 Not Found) */
  await test('1.4 Reject approval for non-existent requirement (404)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/approve/non-existent-uuid-value',
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: 'non-existent-uuid-value' }
    });
    var res = createMockRes();

    await approvalController.approve(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status 404');
    var body = parseResBody(res);
    assert.ok(body.message.indexOf('Requirement not found') !== -1,
      'Expected not found message');
  });

  /* Test 1.5: Reject approval for requirement NOT in staged state (409 Conflict) */
  await test('1.5 Reject approval for non-staged requirement (409)', async function () {
    /* Create a requirement in submitted state (not staged) */
    var created = store.create('Unstaged prompt', 'Will not be staged');
    var req = createMockReq({
      method: 'POST',
      url: '/api/approve/' + created.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: created.id }
    });
    var res = createMockRes();

    await approvalController.approve(req, res);

    assert.strictEqual(res.statusCode, 409, 'Expected status 409 for invalid transition');
    var body = parseResBody(res);
    assert.ok(body.message, 'Expected error message about invalid transition');
  });

  /* Test 1.6: Idempotent approval — approve an already-approved requirement (200 OK) */
  await test('1.6 Idempotent approval returns 200 for already-approved', async function () {
    var staged = createStagedRequirement();

    /* First approval — transitions staged → approved */
    var req1 = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id }
    });
    var res1 = createMockRes();
    await approvalController.approve(req1, res1);
    assert.strictEqual(res1.statusCode, 200, 'First approval should succeed');

    /* Second approval — idempotent, should return current state */
    var req2 = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id }
    });
    var res2 = createMockRes();
    await approvalController.approve(req2, res2);

    assert.strictEqual(res2.statusCode, 200,
      'Idempotent approval should return 200, not an error');
    var body = parseResBody(res2);
    assert.strictEqual(body.status, config.states.APPROVED,
      'Should return current approved state');
  });

  /* =====================================================================
   * TEST SUITE 2: POST /api/reject/:id — Reject Workflow Tests
   * ===================================================================== */
  console.log('\nSuite 2: POST /api/reject/:id');
  console.log('-----------------------------');

  /* Test 2.1: Successfully reject a staged requirement with reason */
  await test('2.1 Successfully reject a staged requirement with reason', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/reject/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id },
      body: { reason: 'Not suitable for production' }
    });
    var res = createMockRes();

    await approvalController.reject(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status 200');
    var body = parseResBody(res);
    assert.strictEqual(body.status, config.states.REJECTED,
      'Expected status field to be rejected');
    assert.strictEqual(body.id, staged.id, 'Expected matching requirement ID');
    assert.strictEqual(body.reason, 'Not suitable for production',
      'Expected rejection reason in response');
    assert.ok(body.message, 'Expected a success message');

    /* Verify store state was updated */
    var updated = store.getById(staged.id);
    assert.strictEqual(updated.status, config.states.REJECTED,
      'Store should reflect rejected state');
  });

  /* Test 2.2: Reject without reason — reason is optional */
  await test('2.2 Reject without reason succeeds (reason is optional)', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/reject/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id }
      /* No body — reason defaults to empty string */
    });
    var res = createMockRes();

    await approvalController.reject(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status 200 even without reason');
    var body = parseResBody(res);
    assert.strictEqual(body.status, config.states.REJECTED,
      'Should still be rejected without reason');
  });

  /* Test 2.3: Reject without API key (401 Unauthorized) */
  await test('2.3 Reject without API key (401)', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/reject/' + staged.id,
      headers: {},  /* No x-api-key */
      params: { id: staged.id }
    });
    var res = createMockRes();

    await approvalController.reject(req, res);

    assert.strictEqual(res.statusCode, 401, 'Expected status 401');
    var body = parseResBody(res);
    assert.strictEqual(body.error, 'Unauthorized',
      'Expected Unauthorized error label');
  });

  /* Test 2.4: Reject non-existent requirement (404) */
  await test('2.4 Reject non-existent requirement (404)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/reject/non-existent-id-abc',
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: 'non-existent-id-abc' }
    });
    var res = createMockRes();

    await approvalController.reject(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status 404');
    var body = parseResBody(res);
    assert.ok(body.message.indexOf('Requirement not found') !== -1,
      'Expected not found message');
  });

  /* Test 2.5: Reject requirement not in staged state (409 Conflict) */
  await test('2.5 Reject non-staged requirement (409)', async function () {
    /* Create a requirement in submitted state (not staged) */
    var created = store.create('Unstaged for reject test', 'Description');
    var req = createMockReq({
      method: 'POST',
      url: '/api/reject/' + created.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: created.id }
    });
    var res = createMockRes();

    await approvalController.reject(req, res);

    assert.strictEqual(res.statusCode, 409, 'Expected status 409 for invalid transition');
    var body = parseResBody(res);
    assert.ok(body.message, 'Expected error message about invalid state');
  });

  /* Test 2.6: Verify rejected is a terminal state — cannot transition further
   * AAP §0.7.1: "Terminal States are Final" */
  await test('2.6 Rejected is terminal — cannot approve after rejection', async function () {
    var staged = createStagedRequirement();

    /* First: reject the requirement */
    var reqReject = createMockReq({
      method: 'POST',
      url: '/api/reject/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id },
      body: { reason: 'Terminal state test' }
    });
    var resReject = createMockRes();
    await approvalController.reject(reqReject, resReject);
    assert.strictEqual(resReject.statusCode, 200, 'Rejection should succeed');

    /* Then: try to approve the rejected requirement — should fail */
    var reqApprove = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id }
    });
    var resApprove = createMockRes();
    await approvalController.approve(reqApprove, resApprove);

    assert.strictEqual(resApprove.statusCode, 409,
      'Should return 409 — rejected is a terminal state');
    var body = parseResBody(resApprove);
    assert.ok(body.message.indexOf('terminal state') !== -1 ||
      body.message.indexOf('Invalid transition') !== -1,
      'Should indicate terminal state or invalid transition');
  });

  /* =====================================================================
   * TEST SUITE 3: POST /api/promote/:id — Promote Workflow Tests
   * ===================================================================== */
  console.log('\nSuite 3: POST /api/promote/:id');
  console.log('------------------------------');

  /* Test 3.1: Successfully promote an approved requirement */
  await test('3.1 Successfully promote an approved requirement', async function () {
    var approved = createApprovedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/promote/' + approved.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: approved.id }
    });
    var res = createMockRes();

    await approvalController.promote(req, res);

    assert.strictEqual(res.statusCode, 200, 'Expected status 200');
    var body = parseResBody(res);
    assert.strictEqual(body.status, config.states.PRODUCTION,
      'Expected status field to be production');
    assert.strictEqual(body.id, approved.id, 'Expected matching requirement ID');
    assert.ok(body.message, 'Expected a success message');

    /* Verify store production pointer was updated */
    var production = store.getProduction();
    assert.ok(production, 'getProduction() should return the promoted requirement');
    assert.strictEqual(production.id, approved.id,
      'Production pointer should reference the promoted requirement');
    assert.strictEqual(production.status, config.states.PRODUCTION,
      'Production requirement should be in production state');
  });

  /* Test 3.2: Promote without API key (401) */
  await test('3.2 Promote without API key (401)', async function () {
    var approved = createApprovedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/promote/' + approved.id,
      headers: {},  /* No x-api-key */
      params: { id: approved.id }
    });
    var res = createMockRes();

    await approvalController.promote(req, res);

    assert.strictEqual(res.statusCode, 401, 'Expected status 401');
  });

  /* Test 3.3: Promote non-existent requirement (404) */
  await test('3.3 Promote non-existent requirement (404)', async function () {
    var req = createMockReq({
      method: 'POST',
      url: '/api/promote/does-not-exist-id',
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: 'does-not-exist-id' }
    });
    var res = createMockRes();

    await approvalController.promote(req, res);

    assert.strictEqual(res.statusCode, 404, 'Expected status 404');
  });

  /* Test 3.4: Promote a staged (not approved) requirement (409)
   * AAP §0.7.1: "No Direct Production Mutation" / "Staging Approval is Mandatory" */
  await test('3.4 Promote staged but not approved requirement (409)', async function () {
    var staged = createStagedRequirement();
    var req = createMockReq({
      method: 'POST',
      url: '/api/promote/' + staged.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: staged.id }
    });
    var res = createMockRes();

    await approvalController.promote(req, res);

    assert.strictEqual(res.statusCode, 409,
      'Expected 409 — must be approved before promotion');
    var body = parseResBody(res);
    assert.ok(body.message.indexOf('approved') !== -1,
      'Error should mention approved state requirement');
  });

  /* Test 3.5: Promote a submitted requirement (409) */
  await test('3.5 Promote submitted requirement directly (409)', async function () {
    var created = store.create('Direct promotion attempt', 'Should fail');
    var req = createMockReq({
      method: 'POST',
      url: '/api/promote/' + created.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: created.id }
    });
    var res = createMockRes();

    await approvalController.promote(req, res);

    assert.strictEqual(res.statusCode, 409,
      'Expected 409 — submitted cannot be promoted directly');
  });

  /* Test 3.6: Single Active Production — promoting new archives previous
   * AAP §0.7.1: "Only one requirement may be in production state at any given time" */
  await test('3.6 Single active production — new promotion replaces previous', async function () {
    /* Create and promote requirement A */
    var approvedA = createApprovedRequirement();
    var reqA = createMockReq({
      method: 'POST',
      url: '/api/promote/' + approvedA.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: approvedA.id }
    });
    var resA = createMockRes();
    await approvalController.promote(reqA, resA);
    assert.strictEqual(resA.statusCode, 200, 'First promotion should succeed');

    /* Verify A is currently in production */
    var productionAfterA = store.getProduction();
    assert.strictEqual(productionAfterA.id, approvedA.id,
      'After first promotion, A should be in production');

    /* Create and promote requirement B */
    var approvedB = createApprovedRequirement();
    var reqB = createMockReq({
      method: 'POST',
      url: '/api/promote/' + approvedB.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: approvedB.id }
    });
    var resB = createMockRes();
    await approvalController.promote(reqB, resB);
    assert.strictEqual(resB.statusCode, 200, 'Second promotion should succeed');

    /* Verify B is now in production (replaced A) */
    var productionAfterB = store.getProduction();
    assert.ok(productionAfterB, 'getProduction() should return a requirement');
    assert.strictEqual(productionAfterB.id, approvedB.id,
      'getProduction() should return B after second promotion');
    assert.notStrictEqual(productionAfterB.id, approvedA.id,
      'A should no longer be the active production');
  });

  /* Test 3.7: Verify production is a terminal state — cannot transition further
   * AAP §0.7.1: "Terminal States are Final" */
  await test('3.7 Production is terminal — cannot approve after promotion', async function () {
    var approved = createApprovedRequirement();

    /* Promote to production */
    var reqPromote = createMockReq({
      method: 'POST',
      url: '/api/promote/' + approved.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: approved.id }
    });
    var resPromote = createMockRes();
    await approvalController.promote(reqPromote, resPromote);
    assert.strictEqual(resPromote.statusCode, 200, 'Promotion should succeed');

    /* Try to approve the production requirement — should fail */
    var reqApprove = createMockReq({
      method: 'POST',
      url: '/api/approve/' + approved.id,
      headers: { 'x-api-key': TEST_API_KEY },
      params: { id: approved.id }
    });
    var resApprove = createMockRes();
    await approvalController.approve(reqApprove, resApprove);

    assert.strictEqual(resApprove.statusCode, 409,
      'Should return 409 — production is a terminal state');
    var body = parseResBody(resApprove);
    assert.ok(body.message.indexOf('terminal state') !== -1 ||
      body.message.indexOf('Invalid transition') !== -1,
      'Should indicate terminal state or invalid transition');
  });

  /* =====================================================================
   * TEST SUITE 4: Authentication Enforcement
   * ===================================================================== */
  console.log('\nSuite 4: Authentication Enforcement');
  console.log('-----------------------------------');

  /* Test 4.1: All three endpoints require authentication */
  await test('4.1 All three endpoints require authentication', async function () {
    var staged = createStagedRequirement();

    /* Test approve without auth */
    var reqApprove = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: {},
      params: { id: staged.id }
    });
    var resApprove = createMockRes();
    await approvalController.approve(reqApprove, resApprove);
    assert.strictEqual(resApprove.statusCode, 401,
      'approve() should return 401 without auth');

    /* Test reject without auth */
    var reqReject = createMockReq({
      method: 'POST',
      url: '/api/reject/' + staged.id,
      headers: {},
      params: { id: staged.id }
    });
    var resReject = createMockRes();
    await approvalController.reject(reqReject, resReject);
    assert.strictEqual(resReject.statusCode, 401,
      'reject() should return 401 without auth');

    /* Test promote without auth (need approved requirement) */
    var approved = createApprovedRequirement();
    var reqPromote = createMockReq({
      method: 'POST',
      url: '/api/promote/' + approved.id,
      headers: {},
      params: { id: approved.id }
    });
    var resPromote = createMockRes();
    await approvalController.promote(reqPromote, resPromote);
    assert.strictEqual(resPromote.statusCode, 401,
      'promote() should return 401 without auth');
  });

  /* Test 4.2: API key value never appears in error responses
   * AAP §0.7.3: "API key values must never be included in response bodies" */
  await test('4.2 API key value never appears in error responses', async function () {
    var staged = createStagedRequirement();

    /* Call with wrong API key */
    var wrongKey = 'this-is-a-wrong-api-key-value';
    var req = createMockReq({
      method: 'POST',
      url: '/api/approve/' + staged.id,
      headers: { 'x-api-key': wrongKey },
      params: { id: staged.id }
    });
    var res = createMockRes();
    await approvalController.approve(req, res);

    assert.strictEqual(res.statusCode, 401, 'Expected 401 for wrong key');

    /* Verify neither the wrong key nor the real key appear in the response */
    var responseText = res.body;
    assert.strictEqual(responseText.indexOf(wrongKey), -1,
      'Wrong API key value must not appear in error response');
    assert.strictEqual(responseText.indexOf(TEST_API_KEY), -1,
      'Correct API key value must not appear in error response');

    /* Also verify the parsed body message doesn't contain keys */
    var body = parseResBody(res);
    assert.strictEqual(body.message.indexOf(wrongKey), -1,
      'Wrong API key value must not appear in error message');
    assert.strictEqual(body.message.indexOf(TEST_API_KEY), -1,
      'Correct API key value must not appear in error message');
  });

  /* =====================================================================
   * Results Summary and Cleanup
   * ===================================================================== */
  console.log('\n========================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' +
    (passed + failed) + ' total');
  console.log('========================');

  /* Restore original config.apiKey to avoid polluting other test runs */
  config.apiKey = originalApiKey;

  /* Exit with code 1 on any failure */
  if (failed > 0) {
    process.exit(1);
  }
}

/* Execute the test runner */
runTests();
