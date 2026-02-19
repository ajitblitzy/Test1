'use strict';

/**
 * tests/integration/workflow.test.js — End-to-End Workflow Integration Tests
 *
 * Verifies the full Staging-Approval Workflow lifecycle by starting an actual
 * HTTP server and making real HTTP requests. Exercises the COMPLETE request
 * flow: router -> middleware -> controller -> store.
 *
 * Test Suites:
 *   1. Default Production Response (backward compatibility)
 *   2-6. Connected Lifecycle (submit -> auto-stage -> approve -> promote -> verify)
 *   7. Rejection Workflow (submit -> reject -> verify terminal)
 *   8. Error Handling (404 for unknown routes and IDs)
 *   9. Single Active Production (second promotion replaces first)
 *
 * Traceability:
 *   AAP 0.2.2  — New Test Files (tests/integration/workflow.test.js)
 *   AAP 0.4.2  — State Machine Integration
 *   AAP 0.4.3  — API Route Registry
 *   AAP 0.5.1  — Group 7 Tests
 *   AAP 0.7.1  — Feature-Specific Rules
 *
 * @module tests/integration/workflow.test
 */

/* ---------------------------------------------------------------------------
 * External Imports — Node.js built-in only (AAP 0.7.1)
 * Zero external test frameworks: No Mocha, Jest, Jasmine, supertest, etc.
 * --------------------------------------------------------------------------- */
var assert = require('assert');
var http = require('http');

/* ---------------------------------------------------------------------------
 * Test Configuration
 *
 * CRITICAL: Environment variables MUST be set BEFORE requiring internal
 * modules because config.js reads process.env at load time and caches the
 * values. The require chain is:
 *   router -> approvalController -> authGuard -> config
 * So config.apiKey is frozen when router is first required.
 * --------------------------------------------------------------------------- */

/** Test server port — avoids conflict with default server port 3000 */
var TEST_PORT = 4567;

/** Test API key for authenticated endpoints */
var TEST_API_KEY = 'test-integration-api-key-12345';

/** Save original API key for restoration after tests */
var originalApiKey = process.env.BLITZY_CLIENT_API_KEY;

/** Set test API key in environment BEFORE any internal require() calls
 *  so that config.js picks up this value when it is first loaded. */
process.env.BLITZY_CLIENT_API_KEY = TEST_API_KEY;

/* ---------------------------------------------------------------------------
 * Internal Imports — CommonJS only (AAP 0.7.1)
 * Paths use ../../src/ (two levels up from tests/integration/)
 * MUST come AFTER env var setup so config.apiKey matches TEST_API_KEY.
 * --------------------------------------------------------------------------- */
var router = require('../../src/router');
var store = require('../../src/models/requirementStore');
var config = require('../../src/config');

/* ---------------------------------------------------------------------------
 * Helper Functions
 * --------------------------------------------------------------------------- */

/**
 * Starts a real HTTP server using router.handle — mirrors server.js pattern.
 * Uses http.createServer with router.handle exactly as the real server.js
 * entry point does (AAP 0.4.1).
 *
 * @param {number} port - Port number to listen on
 * @returns {Promise<import('http').Server>} Resolves with the started server
 */
function startServer(port) {
  return new Promise(function (resolve, reject) {
    var server = http.createServer(function (req, res) {
      router.handle(req, res);
    });
    server.listen(port, '127.0.0.1', function () {
      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * Stops the HTTP server gracefully, closing all connections.
 *
 * @param {import('http').Server} server - The server to stop
 * @returns {Promise<void>} Resolves when the server is fully closed
 */
function stopServer(server) {
  return new Promise(function (resolve) {
    server.close(function () {
      resolve();
    });
  });
}

/**
 * Makes a real HTTP request to the test server using Node.js built-in
 * http.request(). Returns the response with both parsed JSON body (when
 * applicable) and the raw body string for text/plain assertions.
 *
 * @param {Object} options - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} [options.path='/'] - Request path
 * @param {number} [options.port=TEST_PORT] - Target port
 * @param {Object} [options.headers={}] - Additional headers (e.g. x-api-key)
 * @param {Object|string} [body] - Request body (auto-serialized if object)
 * @returns {Promise<{statusCode: number, headers: Object, body: *, rawBody: string}>}
 */
function makeRequest(options, body) {
  return new Promise(function (resolve, reject) {
    var headers = { 'Content-Type': 'application/json' };
    if (options.headers) {
      var keys = Object.keys(options.headers);
      for (var i = 0; i < keys.length; i++) {
        headers[keys[i]] = options.headers[keys[i]];
      }
    }

    var reqOptions = {
      hostname: '127.0.0.1',
      port: options.port || TEST_PORT,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: headers
    };

    var req = http.request(reqOptions, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        var parsedBody;
        try {
          parsedBody = JSON.parse(data);
        } catch (e) {
          parsedBody = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          rawBody: data
        });
      });
    });

    req.on('error', reject);

    if (body) {
      var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Resets the in-memory store to a clean state for test isolation.
 * Clears all requirements, resets currentProductionId, and removes
 * all event listeners to prevent cross-test interference.
 */
function resetStore() {
  store.reset();
  store.removeAllListeners();
}

/* ---------------------------------------------------------------------------
 * Test Runner
 *
 * Custom lightweight test runner using only Node.js built-in assert module.
 * Runs all 9 test suites sequentially, tracks pass/fail counts, and exits
 * with code 1 if any test fails.
 * --------------------------------------------------------------------------- */

async function runTests() {
  var passed = 0;
  var failed = 0;
  var server;

  /**
   * Runs a single named test function. Catches assertion errors and logs
   * pass/fail with the test name. Does NOT reset the store — caller is
   * responsible for resetting between isolated tests.
   *
   * @param {string} name - Human-readable test description
   * @param {Function} fn - Async test function
   */
  async function test(name, fn) {
    try {
      await fn();
      console.log('  \u2713 ' + name);
      passed++;
    } catch (err) {
      console.error('  \u2717 ' + name);
      console.error('    ' + err.message);
      failed++;
    }
  }

  try {
    /* Start a single test server for all suites */
    server = await startServer(TEST_PORT);
    console.log('Integration test server running on port ' + TEST_PORT);
    console.log('');
    console.log('Workflow Integration Tests');
    console.log('=========================');
    console.log('');

    /* ==================================================================
     * Suite 1: Default Production Response (Backward Compatibility)
     *
     * Verifies the original Hello, World!\n is served by default and
     * the health check endpoint works (AAP 0.7.1, 0.7.2).
     * ================================================================== */
    console.log('Suite 1: Default Production Response');
    resetStore();

    await test('1.1 GET / returns Hello, World! by default', async function () {
      var res = await makeRequest({ path: '/' });
      assert.strictEqual(res.statusCode, 200,
        'Expected status 200, got ' + res.statusCode);
      assert.strictEqual(res.rawBody, config.defaultProductionContent,
        'Default production response should be Hello, World!\\n');
      assert.ok(
        res.headers['content-type'] &&
        res.headers['content-type'].indexOf('text/plain') !== -1,
        'Content-Type should include text/plain'
      );
    });

    await test('1.2 GET /health returns health status', async function () {
      var res = await makeRequest({ path: '/health' });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'ok', 'Health status should be ok');
      assert.strictEqual(typeof res.body.uptime, 'number',
        'Uptime should be a number');
      assert.ok(res.body.uptime >= 0, 'Uptime should be non-negative');
    });

    await test('1.3 Config states include all lifecycle states', async function () {
      /* Verify the state machine constants are correctly defined.
       * Uses deepStrictEqual and references config.states.SUBMITTED
       * to ensure the full lifecycle is present in config. */
      assert.deepStrictEqual(
        {
          SUBMITTED: config.states.SUBMITTED,
          STAGED: config.states.STAGED,
          APPROVED: config.states.APPROVED,
          REJECTED: config.states.REJECTED,
          PRODUCTION: config.states.PRODUCTION
        },
        {
          SUBMITTED: 'submitted',
          STAGED: 'staged',
          APPROVED: 'approved',
          REJECTED: 'rejected',
          PRODUCTION: 'production'
        },
        'Config should define all five lifecycle states'
      );
    });

    console.log('');

    /* ==================================================================
     * Suite 2-6: Connected Lifecycle Test
     *
     * PREFERRED pattern per AAP: one continuous test that verifies the
     * COMPLETE pipeline: submit -> auto-stage -> approve -> promote ->
     * verify production change. The store is NOT reset between steps.
     *
     * Covers:
     *   Suite 2: Requirement Submission
     *   Suite 3: Staging Endpoint Verification
     *   Suite 4: Approval Gate Enforcement (CRITICAL — AAP 0.7.1)
     *   Suite 5: Approval Workflow
     *   Suite 6: Promotion to Production
     * ================================================================== */
    console.log('Suite 2-6: Connected Lifecycle (Submit -> Stage -> Approve -> Promote)');
    resetStore();

    await test('Full lifecycle: submit -> auto-stage -> approve -> promote -> verify production', async function () {

      /* -- Step 2.1: POST /api/requirements creates and auto-stages -- */
      var createRes = await makeRequest(
        { method: 'POST', path: '/api/requirements' },
        { prompt: 'Add a new greeting feature', description: 'Enhanced greeting with user name' }
      );
      assert.strictEqual(createRes.statusCode, 201, 'Expected 201 Created');
      assert.ok(createRes.body.id, 'Response should have an id');
      assert.strictEqual(typeof createRes.body.id, 'string', 'ID should be a string');
      assert.strictEqual(createRes.body.status, config.states.STAGED,
        'Status should be staged (auto-staging)');
      assert.strictEqual(createRes.body.prompt, 'Add a new greeting feature');
      assert.ok(createRes.body.prototype, 'Should have prototype content');
      assert.strictEqual(typeof createRes.body.prototype, 'string',
        'Prototype should be a string');

      var reqId = createRes.body.id;

      /* -- Step 2.2: GET /api/requirements lists the created requirement -- */
      var listRes = await makeRequest({ path: '/api/requirements' });
      assert.strictEqual(listRes.statusCode, 200);
      assert.ok(Array.isArray(listRes.body), 'Response should be an array');
      assert.ok(listRes.body.length >= 1, 'Should have at least one requirement');
      var listed = listRes.body.find(function (r) { return r.id === reqId; });
      assert.ok(listed, 'Created requirement should be in list');
      assert.ok(listed.id, 'Listed item should have id');
      assert.ok(listed.prompt, 'Listed item should have prompt');
      assert.ok(listed.status, 'Listed item should have status');
      assert.ok(listed.createdAt, 'Listed item should have createdAt');

      /* -- Step 2.3: GET /api/requirements/:id returns specific requirement -- */
      var detailRes = await makeRequest({ path: '/api/requirements/' + reqId });
      assert.strictEqual(detailRes.statusCode, 200);
      assert.strictEqual(detailRes.body.id, reqId);
      assert.strictEqual(detailRes.body.prompt, 'Add a new greeting feature');
      assert.strictEqual(detailRes.body.description, 'Enhanced greeting with user name');
      assert.strictEqual(detailRes.body.status, config.states.STAGED, 'Should be staged');
      assert.ok(detailRes.body.prototype, 'Requirement should have prototype');
      assert.strictEqual(typeof detailRes.body.prototype, 'string');

      var prototypeContent = detailRes.body.prototype;

      /* -- Step 3.1: GET /staging lists the staged prototype -- */
      var stagingListRes = await makeRequest({ path: '/staging' });
      assert.strictEqual(stagingListRes.statusCode, 200);
      assert.ok(Array.isArray(stagingListRes.body), 'Staging list should be an array');
      assert.ok(stagingListRes.body.length >= 1, 'Should have at least one staged item');
      var staged = stagingListRes.body.find(function (r) { return r.id === reqId; });
      assert.ok(staged, 'Requirement should be in staging list');
      assert.ok(staged.prototype, 'Staged item should have prototype');
      assert.strictEqual(staged.status, config.states.STAGED);

      /* -- Step 3.2: GET /staging/:id returns specific staged prototype -- */
      var stagingDetailRes = await makeRequest({ path: '/staging/' + reqId });
      assert.strictEqual(stagingDetailRes.statusCode, 200);
      assert.ok(stagingDetailRes.body.prototype, 'Should have prototype field');
      assert.strictEqual(stagingDetailRes.body.status, config.states.STAGED);
      assert.strictEqual(stagingDetailRes.body.id, reqId);

      /* -- Step 3.3: Production is STILL Hello, World! before approval -- */
      var prodBeforeRes = await makeRequest({ path: '/' });
      assert.strictEqual(prodBeforeRes.rawBody, config.defaultProductionContent,
        'Production should still be Hello, World! before any approval');

      /* -- Step 4.1: Cannot promote staged requirement without approval (409) --
       * AAP 0.7.1: "Staging Approval is Mandatory — no shortcut from staged to production" */
      var prematurePromoteRes = await makeRequest(
        { method: 'POST', path: '/api/promote/' + reqId,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(prematurePromoteRes.statusCode, 409,
        'Should reject promote of staged (unapproved) requirement with 409');

      /* -- Step 4.2: Cannot promote without authentication (401) --
       * AAP 0.7.1: "Authentication on Sensitive Endpoints" */
      var noAuthPromoteRes = await makeRequest(
        { method: 'POST', path: '/api/promote/' + reqId }
      );
      assert.strictEqual(noAuthPromoteRes.statusCode, 401,
        'Should reject promote without API key with 401');

      /* -- Step 4.3: Cannot approve without authentication (401) -- */
      var noAuthApproveRes = await makeRequest(
        { method: 'POST', path: '/api/approve/' + reqId }
      );
      assert.strictEqual(noAuthApproveRes.statusCode, 401,
        'Should reject approve without API key with 401');

      /* -- Step 4.4: Production STILL Hello, World! after failed attempts -- */
      var prodAfterFailRes = await makeRequest({ path: '/' });
      assert.strictEqual(prodAfterFailRes.rawBody, config.defaultProductionContent,
        'Production should remain unchanged after failed promote attempts');

      /* -- Step 5.1: POST /api/approve/:id successfully approves -- */
      var approveRes = await makeRequest(
        { method: 'POST', path: '/api/approve/' + reqId,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(approveRes.statusCode, 200, 'Approve should succeed with 200');
      assert.strictEqual(approveRes.body.status, config.states.APPROVED,
        'Status should be approved');
      assert.strictEqual(approveRes.body.id, reqId);

      /* -- Step 5.2: GET /api/requirements/:id confirms approved state -- */
      var approvedDetailRes = await makeRequest({ path: '/api/requirements/' + reqId });
      assert.strictEqual(approvedDetailRes.body.status, config.states.APPROVED,
        'Requirement should be in approved state');

      /* -- Step 5.3: Production STILL Hello, World! after approval -- */
      var prodAfterApproveRes = await makeRequest({ path: '/' });
      assert.strictEqual(prodAfterApproveRes.rawBody, config.defaultProductionContent,
        'Production should still be Hello, World! after approval but before promotion');

      /* -- Step 5.4: Approved prototype no longer in staging list -- */
      var stagingAfterApproveRes = await makeRequest({ path: '/staging' });
      assert.ok(Array.isArray(stagingAfterApproveRes.body));
      var approvedInStaging = stagingAfterApproveRes.body.find(function (r) {
        return r.id === reqId;
      });
      assert.strictEqual(approvedInStaging, undefined,
        'Approved requirement should not appear in staging list');

      /* -- Step 6.1: POST /api/promote/:id successfully promotes -- */
      var promoteRes = await makeRequest(
        { method: 'POST', path: '/api/promote/' + reqId,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(promoteRes.statusCode, 200, 'Promote should succeed with 200');
      assert.strictEqual(promoteRes.body.status, config.states.PRODUCTION,
        'Status should be production');

      /* -- Step 6.2: GET / now returns promoted content (NOT Hello, World!) --
       * THIS IS THE CRITICAL VERIFICATION: production endpoint changed */
      var prodAfterPromoteRes = await makeRequest({ path: '/' });
      assert.strictEqual(prodAfterPromoteRes.statusCode, 200);
      assert.notStrictEqual(prodAfterPromoteRes.rawBody, config.defaultProductionContent,
        'Production should no longer be Hello, World!');
      assert.strictEqual(prodAfterPromoteRes.rawBody, prototypeContent,
        'Production should serve the promoted prototype content');

      /* -- Step 6.3: GET /api/requirements/:id confirms production state -- */
      var productionDetailRes = await makeRequest({ path: '/api/requirements/' + reqId });
      assert.strictEqual(productionDetailRes.body.status, config.states.PRODUCTION,
        'Requirement should be in production state');
    });

    console.log('');

    /* ==================================================================
     * Suite 7: Rejection Workflow (separate from main lifecycle)
     *
     * Verifies: submit -> reject -> terminal state enforcement.
     * AAP 0.7.1: "Terminal States are Final"
     * ================================================================== */
    console.log('Suite 7: Rejection Workflow');
    resetStore();

    await test('Rejection workflow: submit -> reject -> verify terminal state', async function () {
      /* 7.1: Submit and auto-stage a new requirement for rejection */
      var createRes = await makeRequest(
        { method: 'POST', path: '/api/requirements' },
        { prompt: 'Feature to be rejected', description: 'This will be rejected' }
      );
      assert.strictEqual(createRes.statusCode, 201);
      var rejId = createRes.body.id;
      assert.ok(rejId, 'Should have an id');

      /* 7.2: POST /api/reject/:id rejects the staged prototype */
      var rejectRes = await makeRequest(
        { method: 'POST', path: '/api/reject/' + rejId,
          headers: { 'x-api-key': TEST_API_KEY } },
        { reason: 'Not aligned with roadmap' }
      );
      assert.strictEqual(rejectRes.statusCode, 200, 'Reject should succeed');
      assert.strictEqual(rejectRes.body.status, config.states.REJECTED,
        'Status should be rejected');

      /* 7.3: Rejected requirement cannot be approved (terminal state) */
      var approveRejRes = await makeRequest(
        { method: 'POST', path: '/api/approve/' + rejId,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(approveRejRes.statusCode, 409,
        'Should not be able to approve a rejected requirement (terminal state)');

      /* 7.4: Rejected requirement cannot be promoted (terminal state) */
      var promoteRejRes = await makeRequest(
        { method: 'POST', path: '/api/promote/' + rejId,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(promoteRejRes.statusCode, 409,
        'Should not be able to promote a rejected requirement (terminal state)');

      /* 7.5: Rejected prototype no longer appears in staging list */
      var stagingRes = await makeRequest({ path: '/staging' });
      assert.ok(Array.isArray(stagingRes.body));
      var rejInStaging = stagingRes.body.find(function (r) { return r.id === rejId; });
      assert.strictEqual(rejInStaging, undefined,
        'Rejected requirement should not appear in staging list');
    });

    console.log('');

    /* ==================================================================
     * Suite 8: Error Handling
     *
     * Verifies proper 404 responses for non-existent routes and IDs.
     * ================================================================== */
    console.log('Suite 8: Error Handling');

    resetStore();
    await test('8.1 Non-existent route returns 404', async function () {
      var res = await makeRequest({ path: '/nonexistent/path' });
      assert.strictEqual(res.statusCode, 404, 'Should return 404 for unknown route');
      assert.ok(res.body.error, 'Response should have error field');
    });

    resetStore();
    await test('8.2 Non-existent requirement ID returns 404', async function () {
      var res = await makeRequest({
        path: '/api/requirements/00000000-0000-0000-0000-000000000000'
      });
      assert.strictEqual(res.statusCode, 404, 'Should return 404 for unknown requirement');
    });

    resetStore();
    await test('8.3 Non-existent staging ID returns 404', async function () {
      var res = await makeRequest({
        path: '/staging/00000000-0000-0000-0000-000000000000'
      });
      assert.strictEqual(res.statusCode, 404, 'Should return 404 for unknown staging ID');
    });

    console.log('');

    /* ==================================================================
     * Suite 9: Single Active Production (AAP 0.7.1)
     *
     * Verifies: "Only one requirement may be in the production state
     * at any given time. Promoting a new requirement to production must
     * automatically archive the previously active production requirement."
     * ================================================================== */
    console.log('Suite 9: Single Active Production');
    resetStore();

    await test('9.1 Promoting second requirement replaces first in production', async function () {
      /* Submit, approve, and promote Requirement A */
      var createA = await makeRequest(
        { method: 'POST', path: '/api/requirements' },
        { prompt: 'Feature A', description: 'First feature' }
      );
      assert.strictEqual(createA.statusCode, 201);
      var idA = createA.body.id;

      var approveA = await makeRequest(
        { method: 'POST', path: '/api/approve/' + idA,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(approveA.statusCode, 200);

      var promoteA = await makeRequest(
        { method: 'POST', path: '/api/promote/' + idA,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(promoteA.statusCode, 200);

      /* Verify A is currently in production */
      var prodA = await makeRequest({ path: '/' });
      assert.ok(prodA.rawBody.indexOf('Feature A') !== -1,
        'Production should serve Feature A content');

      /* Submit, approve, and promote Requirement B */
      var createB = await makeRequest(
        { method: 'POST', path: '/api/requirements' },
        { prompt: 'Feature B', description: 'Second feature' }
      );
      assert.strictEqual(createB.statusCode, 201);
      var idB = createB.body.id;

      var approveB = await makeRequest(
        { method: 'POST', path: '/api/approve/' + idB,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(approveB.statusCode, 200);

      var promoteB = await makeRequest(
        { method: 'POST', path: '/api/promote/' + idB,
          headers: { 'x-api-key': TEST_API_KEY } }
      );
      assert.strictEqual(promoteB.statusCode, 200);

      /* Verify B is now in production (NOT A) */
      var prodB = await makeRequest({ path: '/' });
      assert.ok(prodB.rawBody.indexOf('Feature B') !== -1,
        'Production should now serve Feature B content');
      assert.ok(prodB.rawBody.indexOf('Feature A') === -1,
        'Production should NOT serve Feature A anymore');
    });

    console.log('');

  } finally {
    /* Always stop the server and restore environment */
    if (server) {
      await stopServer(server);
    }
    process.env.BLITZY_CLIENT_API_KEY = originalApiKey || '';
  }

  /* Print results summary */
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' +
    (passed + failed) + ' total');

  if (failed > 0) {
    process.exit(1);
  }
}

/* ---------------------------------------------------------------------------
 * Entry Point — Run all tests
 * --------------------------------------------------------------------------- */
runTests().catch(function (err) {
  console.error('Fatal error:', err);
  process.exit(1);
});
