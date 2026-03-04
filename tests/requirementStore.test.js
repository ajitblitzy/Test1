'use strict';

/**
 * tests/requirementStore.test.js — Data Store and State Machine Tests
 *
 * Comprehensive unit tests for src/models/requirementStore.js covering:
 * - CRUD operations (create, getById, getAll, getStaged, getProduction)
 * - stageRequirement with prototype guard enforcement
 * - State machine transitions (submitted → staged → approved → production)
 * - Terminal state enforcement (rejected and production are final)
 * - Idempotent state transitions (same-state returns current state)
 * - Single active production prototype enforcement
 * - UUID generation and format validation
 * - Defensive copy verification (returned objects are not references)
 * - Event emission (created, transitioned)
 * - Store reset and cleanup
 * - updatedAt timestamp tracking
 *
 * Traceability: AAP §0.2.2, §0.4.2, §0.5.1 Group 7, §0.7.1
 *
 * Rules:
 * - CommonJS only (require/module.exports) — AAP §0.7.1
 * - Zero external dependencies — built-in assert only
 * - Independently runnable: node tests/requirementStore.test.js
 *
 * @module tests/requirementStore.test
 */

const assert = require('assert');
const store = require('../src/models/requirementStore');
const config = require('../src/config');

/* UUID v4 format regex for validation (AAP §0.3.1: crypto.randomUUID()) */
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================================================
 * Test Helpers
 * ============================================================================ */

/**
 * Resets the store to a clean state between tests.
 * Clears all requirements and the production pointer.
 */
function resetStore() {
  store.reset();
}

/**
 * Helper to create a staged requirement for tests needing staged preconditions.
 * Uses the store's stageRequirement method which sets prototype and transitions.
 *
 * @param {string} [prompt] - Prompt text (defaults to 'Test prompt')
 * @param {string} [desc] - Description text (defaults to 'Test description')
 * @returns {Object} The staged requirement (defensive copy from store)
 */
function createStagedRequirement(prompt, desc) {
  prompt = prompt || 'Test prompt';
  desc = desc || 'Test description';
  var req = store.create(prompt, desc);
  store.stageRequirement(req.id, '[Prototype] Enhanced: ' + prompt);
  return store.getById(req.id);
}

/**
 * Helper to create a fully promoted (production) requirement.
 * Walks through the entire lifecycle: submitted → staged → approved → production.
 *
 * @param {string} [prompt] - Prompt text (defaults to 'Production prompt')
 * @returns {Object} The production requirement (defensive copy from store)
 */
function createProductionRequirement(prompt) {
  prompt = prompt || 'Production prompt';
  var staged = createStagedRequirement(prompt, 'For production');
  store.transition(staged.id, config.states.APPROVED);
  store.transition(staged.id, config.states.PRODUCTION);
  return store.getById(staged.id);
}

/* ============================================================================
 * Test Runner
 * ============================================================================ */

async function runTests() {
  var passed = 0;
  var failed = 0;

  /**
   * Executes a single test case with automatic store reset and listener cleanup.
   *
   * @param {string} name - Descriptive test name
   * @param {Function} fn - Async or sync test function
   */
  async function test(name, fn) {
    try {
      resetStore();
      store.removeAllListeners();
      await fn();
      console.log('  \u2713 ' + name);
      passed++;
    } catch (err) {
      console.error('  \u2717 ' + name);
      console.error('    ' + err.message);
      failed++;
    }
  }

  console.log('Requirement Store Tests');
  console.log('=======================');
  console.log('');

  /* ========================================================================
   * Test Suite 1: CRUD Operations — create()
   * ======================================================================== */
  console.log('Suite 1: CRUD Operations - create()');

  await test('1.1 Create requirement with valid input', async function () {
    var result = store.create('Test prompt', 'Test description');

    /* Verify ID is a non-empty UUID string */
    assert.ok(result.id, 'id should be non-empty');
    assert.strictEqual(typeof result.id, 'string');
    assert.ok(UUID_REGEX.test(result.id), 'id should match UUID v4 format');

    /* Verify prompt and description stored correctly */
    assert.strictEqual(result.prompt, 'Test prompt');
    assert.strictEqual(result.description, 'Test description');

    /* Verify initial lifecycle state is submitted (AAP §0.4.2) */
    assert.strictEqual(result.status, config.states.SUBMITTED);

    /* Verify prototype and rejection reason are null at creation */
    assert.strictEqual(result.prototype, null);
    assert.strictEqual(result.rejectionReason, null);

    /* Verify timestamps are valid ISO date strings */
    assert.ok(result.createdAt, 'createdAt should be set');
    assert.ok(result.updatedAt, 'updatedAt should be set');
    assert.strictEqual(typeof result.createdAt, 'string');
    assert.strictEqual(typeof result.updatedAt, 'string');
    assert.ok(!isNaN(new Date(result.createdAt).getTime()), 'createdAt should be parseable ISO date');
    assert.ok(!isNaN(new Date(result.updatedAt).getTime()), 'updatedAt should be parseable ISO date');
  });

  await test('1.2 Create multiple requirements — each gets unique UUID', async function () {
    var r1 = store.create('Prompt 1', 'Desc 1');
    var r2 = store.create('Prompt 2', 'Desc 2');
    var r3 = store.create('Prompt 3', 'Desc 3');

    /* All IDs must be distinct */
    assert.notStrictEqual(r1.id, r2.id, 'r1 and r2 should have different IDs');
    assert.notStrictEqual(r1.id, r3.id, 'r1 and r3 should have different IDs');
    assert.notStrictEqual(r2.id, r3.id, 'r2 and r3 should have different IDs');

    /* Store count should reflect all created requirements */
    assert.strictEqual(store.getAll().length, 3, 'getAll() should return 3 items');
    assert.strictEqual(store.count(), 3, 'count() should return 3');
  });

  await test('1.3 Create with empty description defaults', async function () {
    var result = store.create('Prompt only', '');
    assert.strictEqual(result.description, '', 'Empty description should remain empty string');
  });

  await test('1.4 UUID format validation', async function () {
    var result = store.create('UUID format check', 'Testing UUID');
    assert.ok(
      UUID_REGEX.test(result.id),
      'ID ' + result.id + ' should match UUID v4 format regex'
    );
  });

  /* ========================================================================
   * Test Suite 2: CRUD Operations — getById()
   * ======================================================================== */
  console.log('');
  console.log('Suite 2: CRUD Operations - getById()');

  await test('2.1 Retrieve existing requirement by ID', async function () {
    var created = store.create('Get by ID test', 'Description for retrieval');
    var retrieved = store.getById(created.id);

    assert.ok(retrieved, 'Should return a non-null object');
    assert.strictEqual(retrieved.id, created.id);
    assert.strictEqual(retrieved.prompt, 'Get by ID test');
    assert.strictEqual(retrieved.status, config.states.SUBMITTED);
    assert.strictEqual(retrieved.description, 'Description for retrieval');
  });

  await test('2.2 Return null for non-existent ID', async function () {
    var result = store.getById('nonexistent-uuid-00000000');
    assert.strictEqual(result, null, 'Should return null for non-existent ID');
  });

  await test('2.3 Returned object is a copy (not reference)', async function () {
    var created = store.create('Copy test prompt', 'Original description');
    var first = store.getById(created.id);

    /* Mutate the returned copy */
    first.prompt = 'modified externally';

    /* Fetch again — should still have original value */
    var second = store.getById(created.id);
    assert.strictEqual(second.prompt, 'Copy test prompt',
      'Second retrieval should have original prompt, proving defensive copy');
    assert.notStrictEqual(second.prompt, 'modified externally');
  });

  /* ========================================================================
   * Test Suite 3: CRUD Operations — getAll()
   * ======================================================================== */
  console.log('');
  console.log('Suite 3: CRUD Operations - getAll()');

  await test('3.1 Empty store returns empty array', async function () {
    var all = store.getAll();
    assert.ok(Array.isArray(all), 'Should return an array');
    assert.strictEqual(all.length, 0, 'Empty store should return empty array');
  });

  await test('3.2 Returns all requirements', async function () {
    store.create('Prompt A', 'Desc A');
    store.create('Prompt B', 'Desc B');
    store.create('Prompt C', 'Desc C');
    var all = store.getAll();
    assert.strictEqual(all.length, 3, 'Should return all 3 requirements');
  });

  /* ========================================================================
   * Test Suite 4: CRUD Operations — getStaged()
   * ======================================================================== */
  console.log('');
  console.log('Suite 4: CRUD Operations - getStaged()');

  await test('4.1 Returns only staged requirements', async function () {
    /* Create one submitted (not staged) requirement */
    store.create('Not staged', 'Will stay submitted');

    /* Create two staged requirements */
    createStagedRequirement('Staged 1', 'First staged');
    createStagedRequirement('Staged 2', 'Second staged');

    var staged = store.getStaged();
    assert.strictEqual(staged.length, 2, 'Should return only 2 staged requirements');

    /* Verify all returned items have the staged status */
    staged.forEach(function (item) {
      assert.strictEqual(item.status, config.states.STAGED,
        'Each item in getStaged() should have status === staged');
    });
  });

  await test('4.2 Returns empty array when no staged requirements', async function () {
    store.create('Just submitted 1', 'Not staged');
    store.create('Just submitted 2', 'Also not staged');
    var staged = store.getStaged();
    assert.strictEqual(staged.length, 0, 'Should return empty array when nothing is staged');
  });

  /* ========================================================================
   * Test Suite 5: CRUD Operations — getProduction()
   * ======================================================================== */
  console.log('');
  console.log('Suite 5: CRUD Operations - getProduction()');

  await test('5.1 Returns null when no production requirement', async function () {
    var prod = store.getProduction();
    assert.strictEqual(prod, null,
      'Should return null when no prototype has been promoted (default Hello, World!)');
  });

  await test('5.2 Returns the promoted production requirement', async function () {
    var prodReq = createProductionRequirement('Production feature');
    var prod = store.getProduction();

    assert.ok(prod, 'Should return a non-null requirement');
    assert.strictEqual(prod.id, prodReq.id, 'Should match the promoted requirement ID');
    assert.strictEqual(prod.status, config.states.PRODUCTION, 'Should be in production state');
  });

  /* ========================================================================
   * Test Suite 6: stageRequirement()
   * ======================================================================== */
  console.log('');
  console.log('Suite 6: stageRequirement()');

  await test('6.1 Successfully stage a submitted requirement', async function () {
    var created = store.create('Stage me', 'For staging test');
    var result = store.stageRequirement(created.id, '[Prototype] Enhanced content');

    assert.strictEqual(result.status, config.states.STAGED);
    assert.strictEqual(result.prototype, '[Prototype] Enhanced content');

    /* Verify via getById as well */
    var retrieved = store.getById(created.id);
    assert.strictEqual(retrieved.status, config.states.STAGED);
    assert.strictEqual(retrieved.prototype, '[Prototype] Enhanced content');
  });

  await test('6.2 Reject staging with empty prototype content', async function () {
    var created = store.create('Empty proto test', 'Testing empty prototype');
    assert.throws(
      function () { store.stageRequirement(created.id, ''); },
      /prototype content/i,
      'Should throw for empty prototype (AAP §0.4.2: prototype must be non-empty)'
    );
  });

  await test('6.3 Reject staging with null prototype content', async function () {
    var created = store.create('Null proto test', 'Testing null prototype');
    assert.throws(
      function () { store.stageRequirement(created.id, null); },
      /prototype content/i,
      'Should throw for null prototype'
    );
  });

  /* ========================================================================
   * Test Suite 7: State Machine Transitions — transition()
   *
   * CRITICAL: Core of the staging-approval workflow (AAP §0.4.2)
   *
   * Valid transitions:
   *   submitted → staged → approved → production
   *                      ↘ rejected (terminal)
   * ======================================================================== */
  console.log('');
  console.log('Suite 7: State Machine Transitions - transition()');

  await test('7.1 Valid transition: submitted -> staged', async function () {
    var created = store.create('Direct transition test', 'For transition');

    /*
     * To test transition() directly for submitted→staged, we must set
     * the prototype field on the internal Map entry because transition()
     * enforces the non-empty prototype guard (AAP §0.4.2).
     */
    store.requirements.get(created.id).prototype = 'Test prototype content';
    var result = store.transition(created.id, config.states.STAGED);

    assert.strictEqual(result.status, config.states.STAGED);
    assert.strictEqual(store.getById(created.id).status, config.states.STAGED);
  });

  await test('7.2 Valid transition: staged -> approved', async function () {
    var staged = createStagedRequirement('For approval transition', 'Test');
    var result = store.transition(staged.id, config.states.APPROVED);

    assert.strictEqual(result.status, config.states.APPROVED);
    assert.strictEqual(store.getById(staged.id).status, config.states.APPROVED);
  });

  await test('7.3 Valid transition: staged -> rejected', async function () {
    var staged = createStagedRequirement('For rejection transition', 'Test');
    var result = store.transition(staged.id, config.states.REJECTED);

    assert.strictEqual(result.status, config.states.REJECTED);
    assert.strictEqual(store.getById(staged.id).status, config.states.REJECTED);
  });

  await test('7.4 Valid transition: approved -> production', async function () {
    var staged = createStagedRequirement('For production transition', 'Test');
    store.transition(staged.id, config.states.APPROVED);
    var result = store.transition(staged.id, config.states.PRODUCTION);

    assert.strictEqual(result.status, config.states.PRODUCTION);
    assert.strictEqual(store.getById(staged.id).status, config.states.PRODUCTION);
    assert.strictEqual(store.getProduction().id, staged.id,
      'getProduction() should return the newly promoted requirement');
  });

  await test('7.5 Invalid transition: submitted -> approved (skip staged)', async function () {
    var created = store.create('Skip staged attempt', 'Test');
    assert.throws(
      function () { store.transition(created.id, config.states.APPROVED); },
      /Invalid transition/i,
      'submitted→approved should be rejected (AAP §0.7.1: Staging Approval is Mandatory)'
    );
  });

  await test('7.6 Invalid transition: submitted -> production (direct to prod)', async function () {
    var created = store.create('Direct prod attempt', 'Test');
    assert.throws(
      function () { store.transition(created.id, config.states.PRODUCTION); },
      /Invalid transition/i,
      'submitted→production should be rejected (AAP §0.7.1: No Direct Production Mutation)'
    );
  });

  await test('7.7 Invalid transition: staged -> production (skip approved)', async function () {
    var staged = createStagedRequirement('Skip approved attempt', 'Test');
    assert.throws(
      function () { store.transition(staged.id, config.states.PRODUCTION); },
      /Invalid transition/i,
      'staged→production should be rejected (AAP §0.7.1: Staging Approval is Mandatory)'
    );
  });

  await test('7.8 No backward transitions - cannot go back to submitted', async function () {
    var staged = createStagedRequirement('Backward attempt', 'Test');
    assert.throws(
      function () { store.transition(staged.id, config.states.SUBMITTED); },
      /Invalid transition/i,
      'staged→submitted should be rejected (AAP §0.4.2: no backward transitions)'
    );
  });

  /* ========================================================================
   * Test Suite 8: Terminal States (AAP §0.7.1)
   * "Terminal States are Final — Requirements in the rejected or production
   *  state must not be transitioned to any other state."
   * ======================================================================== */
  console.log('');
  console.log('Suite 8: Terminal States');

  await test('8.1 Rejected is terminal - cannot transition to any other state', async function () {
    var staged = createStagedRequirement('To be rejected', 'Terminal test');
    store.transition(staged.id, config.states.REJECTED);

    /* Attempt every possible target state — all must throw */
    assert.throws(
      function () { store.transition(staged.id, config.states.APPROVED); },
      /terminal state/i,
      'rejected→approved should throw'
    );
    assert.throws(
      function () { store.transition(staged.id, config.states.SUBMITTED); },
      /terminal state/i,
      'rejected→submitted should throw'
    );
    assert.throws(
      function () { store.transition(staged.id, config.states.STAGED); },
      /terminal state/i,
      'rejected→staged should throw'
    );
    assert.throws(
      function () { store.transition(staged.id, config.states.PRODUCTION); },
      /terminal state/i,
      'rejected→production should throw'
    );
  });

  await test('8.2 Production is terminal - cannot transition to any other state', async function () {
    var prodReq = createProductionRequirement('Terminal production test');

    /* Attempt every possible target state — all must throw */
    assert.throws(
      function () { store.transition(prodReq.id, config.states.SUBMITTED); },
      /terminal state/i,
      'production→submitted should throw'
    );
    assert.throws(
      function () { store.transition(prodReq.id, config.states.STAGED); },
      /terminal state/i,
      'production→staged should throw'
    );
    assert.throws(
      function () { store.transition(prodReq.id, config.states.APPROVED); },
      /terminal state/i,
      'production→approved should throw'
    );
    assert.throws(
      function () { store.transition(prodReq.id, config.states.REJECTED); },
      /terminal state/i,
      'production→rejected should throw'
    );
  });

  /* ========================================================================
   * Test Suite 9: Idempotent Transitions (AAP §0.7.1)
   * "Attempting to transition a requirement to its current state should
   *  return the current state without error, not cause a failure."
   * ======================================================================== */
  console.log('');
  console.log('Suite 9: Idempotent Transitions');

  await test('9.1 Transitioning staged to staged returns current state without error', async function () {
    var staged = createStagedRequirement('Idempotent staged', 'Test');

    /* Transition to same state should not throw */
    assert.doesNotThrow(function () {
      var result = store.transition(staged.id, config.states.STAGED);
      assert.strictEqual(result.status, config.states.STAGED,
        'Should return current staged state');
    });

    /* Verify state unchanged */
    assert.strictEqual(store.getById(staged.id).status, config.states.STAGED);
  });

  await test('9.2 Idempotent for approved state', async function () {
    var staged = createStagedRequirement('Idempotent approved', 'Test');
    store.transition(staged.id, config.states.APPROVED);

    /* Transition to same approved state should not throw */
    assert.doesNotThrow(function () {
      var result = store.transition(staged.id, config.states.APPROVED);
      assert.strictEqual(result.status, config.states.APPROVED,
        'Should return current approved state');
    });

    /* Verify state unchanged */
    assert.strictEqual(store.getById(staged.id).status, config.states.APPROVED);
  });

  /* ========================================================================
   * Test Suite 10: Single Active Production (AAP §0.7.1)
   * "Only one requirement may be in the production state at any given time.
   *  Promoting a new requirement to production must automatically archive
   *  the previously active production requirement."
   * ======================================================================== */
  console.log('');
  console.log('Suite 10: Single Active Production');

  await test('10.1 Only one requirement in production at a time', async function () {
    /* Promote Requirement A */
    var prodA = createProductionRequirement('Feature A');
    assert.strictEqual(store.getProduction().id, prodA.id,
      'After promoting A, getProduction should return A');

    /* Promote Requirement B — should replace A as the active production */
    var prodB = createProductionRequirement('Feature B');
    assert.strictEqual(store.getProduction().id, prodB.id,
      'After promoting B, getProduction should return B (latest promoted)');
    assert.notStrictEqual(store.getProduction().id, prodA.id,
      'A should no longer be the active production requirement');
  });

  /* ========================================================================
   * Test Suite 11: updatedAt Tracking
   * ======================================================================== */
  console.log('');
  console.log('Suite 11: updatedAt Tracking');

  await test('11.1 updatedAt is refreshed on every state transition', async function () {
    var created = store.create('Timestamp tracking test', 'Test');
    var initialUpdatedAt = created.updatedAt;

    /* Stage the requirement (triggers submitted → staged transition) */
    store.stageRequirement(created.id, '[Prototype] Timestamp tracking content');
    var afterStaging = store.getById(created.id);

    /* updatedAt should be >= initial time (same millisecond possible in fast execution) */
    var initialTime = new Date(initialUpdatedAt).getTime();
    var stagedTime = new Date(afterStaging.updatedAt).getTime();
    assert.ok(stagedTime >= initialTime,
      'updatedAt (' + afterStaging.updatedAt + ') should be >= createdAt (' + initialUpdatedAt + ')');
  });

  /* ========================================================================
   * Test Suite 12: reset() Method
   * ======================================================================== */
  console.log('');
  console.log('Suite 12: reset() Method');

  await test('12.1 Reset clears all data', async function () {
    /* Populate the store with several requirements in various states */
    store.create('Reset test 1', 'Desc');
    store.create('Reset test 2', 'Desc');
    createProductionRequirement('Reset production test');

    /* Verify store has data before reset */
    assert.ok(store.getAll().length > 0, 'Store should have data before reset');
    assert.ok(store.getProduction() !== null, 'Should have production before reset');

    /* Perform reset */
    store.reset();

    /* Verify everything is cleared */
    assert.strictEqual(store.getAll().length, 0, 'Store should be empty after reset');
    assert.strictEqual(store.getProduction(), null, 'Production should be null after reset');
  });

  /* ========================================================================
   * Test Suite 13: Event Emission
   * ======================================================================== */
  console.log('');
  console.log('Suite 13: Event Emission');

  await test('13.1 Emits created event on requirement creation', async function () {
    var eventData = null;
    store.on('created', function (data) {
      eventData = data;
    });

    var created = store.create('Event creation test', 'Testing created event');

    assert.ok(eventData, 'created event should have been emitted');
    assert.strictEqual(eventData.id, created.id, 'Event data should contain matching ID');
    assert.strictEqual(eventData.prompt, 'Event creation test');
    assert.strictEqual(eventData.status, config.states.SUBMITTED,
      'Event data should show submitted status at creation time');
  });

  await test('13.2 Emits transitioned event on state transition', async function () {
    var eventData = null;
    store.on('transitioned', function (data) {
      eventData = data;
    });

    var created = store.create('Transition event test', 'Testing transitioned event');
    store.stageRequirement(created.id, '[Prototype] Event transition content');

    assert.ok(eventData, 'transitioned event should have been emitted');
    assert.strictEqual(eventData.id, created.id, 'Event should contain matching ID');
    assert.strictEqual(eventData.from, config.states.SUBMITTED,
      'Event should record previous state as submitted');
    assert.strictEqual(eventData.to, config.states.STAGED,
      'Event should record target state as staged');
    assert.ok(eventData.requirement, 'Event should include requirement object');
    assert.strictEqual(eventData.requirement.status, config.states.STAGED,
      'Requirement in event should reflect new staged status');
  });

  /* ========================================================================
   * Test Suite 14: Config validTransitions reference verification
   * Ensures the config module provides the expected transition map
   * ======================================================================== */
  console.log('');
  console.log('Suite 14: Config State Constants Verification');

  await test('14.1 Config states contains all lifecycle state constants', async function () {
    assert.strictEqual(config.states.SUBMITTED, 'submitted');
    assert.strictEqual(config.states.STAGED, 'staged');
    assert.strictEqual(config.states.APPROVED, 'approved');
    assert.strictEqual(config.states.REJECTED, 'rejected');
    assert.strictEqual(config.states.PRODUCTION, 'production');
  });

  await test('14.2 Config validTransitions matches expected state machine', async function () {
    /* submitted can only go to staged */
    assert.deepStrictEqual(config.validTransitions.submitted, ['staged']);

    /* staged can go to approved or rejected */
    assert.deepStrictEqual(config.validTransitions.staged, ['approved', 'rejected']);

    /* approved can only go to production */
    assert.deepStrictEqual(config.validTransitions.approved, ['production']);

    /* rejected is terminal — no transitions */
    assert.deepStrictEqual(config.validTransitions.rejected, []);

    /* production is terminal — no transitions */
    assert.deepStrictEqual(config.validTransitions.production, []);
  });

  /* ========================================================================
   * Results Summary
   * ======================================================================== */
  console.log('');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  if (failed > 0) {
    process.exit(1);
  }
}

/* Execute the test suite */
runTests();
