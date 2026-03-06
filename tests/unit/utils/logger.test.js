'use strict';

/**
 * Unit tests for the structured logging utility (src/utils/logger.js).
 *
 * Validates that the logger object exposes info(), warn(), and error() methods,
 * each delegating to the corresponding native console method with a formatted
 * prefix containing an ISO 8601 timestamp and a log level tag. Also verifies
 * variadic argument passthrough so callers can log arbitrary data.
 *
 * Uses ONLY Node.js built-in modules:
 *   - node:test  — describe, it, mock, beforeEach, afterEach
 *   - node:assert — strictEqual, match
 *
 * @module tests/unit/utils/logger.test
 */

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { logger } = require('../../../src/utils/logger');

/**
 * ISO 8601 timestamp regex that matches the bracket-wrapped format produced by
 * the logger: [YYYY-MM-DDTHH:mm:ss.mmmZ]
 * Example match: [2025-03-06T12:34:56.789Z]
 */
const ISO_TIMESTAMP_REGEX = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;

describe('Logger Utility', () => {
  // ── Setup & Teardown ──────────────────────────────────────────────────────
  // Before each test, spy on all three console methods so we can inspect calls
  // without producing actual terminal output noise during test runs.
  // After each test, restore originals to avoid cross-test contamination.

  beforeEach(() => {
    mock.method(console, 'log');
    mock.method(console, 'warn');
    mock.method(console, 'error');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  // ── Logger Object Structure ───────────────────────────────────────────────
  describe('logger object structure', () => {
    it('should have an info method', () => {
      assert.strictEqual(typeof logger.info, 'function');
    });

    it('should have a warn method', () => {
      assert.strictEqual(typeof logger.warn, 'function');
    });

    it('should have an error method', () => {
      assert.strictEqual(typeof logger.error, 'function');
    });
  });

  // ── logger.info() ─────────────────────────────────────────────────────────
  describe('logger.info()', () => {
    it('should delegate to console.log() and not to console.warn() or console.error()', () => {
      logger.info('test message');

      assert.strictEqual(console.log.mock.calls.length, 1);
      assert.strictEqual(console.warn.mock.calls.length, 0);
      assert.strictEqual(console.error.mock.calls.length, 0);
    });

    it('should include an ISO 8601 timestamp in the first argument', () => {
      logger.info('test message');

      const firstArg = console.log.mock.calls[0].arguments[0];
      assert.match(firstArg, ISO_TIMESTAMP_REGEX);
    });

    it('should include the [INFO] level prefix in the first argument', () => {
      logger.info('test message');

      const firstArg = console.log.mock.calls[0].arguments[0];
      assert.match(firstArg, /\[INFO\]/);
    });

    it('should pass the message as a subsequent argument after the prefix', () => {
      logger.info('hello world');

      const args = console.log.mock.calls[0].arguments;
      // args[0] is the "[timestamp] [INFO]" prefix string
      // args[1] is the first variadic argument passed to logger.info()
      assert.strictEqual(args[1], 'hello world');
    });
  });

  // ── logger.warn() ─────────────────────────────────────────────────────────
  describe('logger.warn()', () => {
    it('should delegate to console.warn() and not to console.log() or console.error()', () => {
      logger.warn('warning message');

      assert.strictEqual(console.warn.mock.calls.length, 1);
      assert.strictEqual(console.log.mock.calls.length, 0);
      assert.strictEqual(console.error.mock.calls.length, 0);
    });

    it('should include an ISO 8601 timestamp in the first argument', () => {
      logger.warn('test warning');

      const firstArg = console.warn.mock.calls[0].arguments[0];
      assert.match(firstArg, ISO_TIMESTAMP_REGEX);
    });

    it('should include the [WARN] level prefix in the first argument', () => {
      logger.warn('test warning');

      const firstArg = console.warn.mock.calls[0].arguments[0];
      assert.match(firstArg, /\[WARN\]/);
    });

    it('should pass the message as a subsequent argument after the prefix', () => {
      logger.warn('caution here');

      const args = console.warn.mock.calls[0].arguments;
      assert.strictEqual(args[1], 'caution here');
    });
  });

  // ── logger.error() ────────────────────────────────────────────────────────
  describe('logger.error()', () => {
    it('should delegate to console.error() and not to console.log() or console.warn()', () => {
      logger.error('error message');

      assert.strictEqual(console.error.mock.calls.length, 1);
      assert.strictEqual(console.log.mock.calls.length, 0);
      assert.strictEqual(console.warn.mock.calls.length, 0);
    });

    it('should include an ISO 8601 timestamp in the first argument', () => {
      logger.error('test error');

      const firstArg = console.error.mock.calls[0].arguments[0];
      assert.match(firstArg, ISO_TIMESTAMP_REGEX);
    });

    it('should include the [ERROR] level prefix in the first argument', () => {
      logger.error('test error');

      const firstArg = console.error.mock.calls[0].arguments[0];
      assert.match(firstArg, /\[ERROR\]/);
    });

    it('should pass the message as a subsequent argument after the prefix', () => {
      logger.error('something broke');

      const args = console.error.mock.calls[0].arguments;
      assert.strictEqual(args[1], 'something broke');
    });
  });

  // ── Variadic Arguments ────────────────────────────────────────────────────
  describe('variadic arguments', () => {
    it('should pass multiple arguments through logger.info()', () => {
      logger.info('message', 'extra', 42);

      assert.strictEqual(console.log.mock.calls.length, 1);

      const args = console.log.mock.calls[0].arguments;
      // args[0] = "[timestamp] [INFO]" prefix
      assert.strictEqual(args[1], 'message');
      assert.strictEqual(args[2], 'extra');
      assert.strictEqual(args[3], 42);
    });

    it('should pass multiple arguments through logger.warn()', () => {
      logger.warn('first', 'second');

      assert.strictEqual(console.warn.mock.calls.length, 1);

      const args = console.warn.mock.calls[0].arguments;
      assert.strictEqual(args[1], 'first');
      assert.strictEqual(args[2], 'second');
    });

    it('should pass multiple arguments including objects through logger.error()', () => {
      const errorDetail = { code: 500 };
      logger.error('err', errorDetail);

      assert.strictEqual(console.error.mock.calls.length, 1);

      const args = console.error.mock.calls[0].arguments;
      assert.strictEqual(args[1], 'err');
      assert.strictEqual(args[2], errorDetail);
    });
  });
});
