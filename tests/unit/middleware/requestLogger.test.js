'use strict';

/**
 * Unit tests for src/middleware/requestLogger.js
 *
 * Validates the HTTP request/response logging middleware that records each
 * incoming request's method, URL, status code, and response time in
 * milliseconds. Tests use mock req, res, and next objects — no live server
 * is started.
 *
 * Test runner: Node.js built-in node:test (stable since v20)
 * Assertions: Node.js built-in node:assert/strict
 * Zero external dependencies (AAP §0.7.1)
 *
 * @module tests/unit/middleware/requestLogger.test
 */

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { requestLogger } = require('../../../src/middleware/requestLogger');
const { logger } = require('../../../src/utils/logger');

// ---------------------------------------------------------------------------
// Helper factories — keep tests DRY without shared mutable state
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock HTTP request object simulating http.IncomingMessage.
 *
 * @param {string} [method='GET'] - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} [url='/']      - Request URL path
 * @returns {{ method: string, url: string }} Mock request object
 */
function createMockReq(method, url) {
  return {
    method: method !== undefined ? method : 'GET',
    url: url !== undefined ? url : '/',
  };
}

/**
 * Creates a mock HTTP response object simulating http.ServerResponse with a
 * lightweight event emitter for the 'finish' event. The mock tracks registered
 * listeners and provides an emitFinish() helper to trigger them.
 *
 * @param {number} [statusCode=200] - HTTP response status code
 * @returns {{ res: object, emitFinish: Function }} Mock response and trigger
 */
function createMockRes(statusCode) {
  const listeners = {};
  const res = {
    statusCode: statusCode !== undefined ? statusCode : 200,
    on(event, cb) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(cb);
    },
  };

  /**
   * Triggers all callbacks registered for the 'finish' event, simulating
   * the end of an HTTP response write cycle.
   */
  function emitFinish() {
    const callbacks = listeners['finish'];
    if (callbacks) {
      callbacks.forEach((cb) => cb());
    }
  }

  return { res, emitFinish };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('requestLogger middleware', () => {
  // Set up a spy on logger.info before each test so call tracking is fresh.
  // A no-op implementation is provided to prevent the real logger.info from
  // delegating to console.log during tests — this isolates the middleware
  // behavior and keeps test output clean.
  beforeEach(() => {
    mock.method(logger, 'info', () => {});
  });

  // Restore all mocked methods after each test to prevent leakage
  afterEach(() => {
    mock.restoreAll();
  });

  // -------------------------------------------------------------------------
  // 4.8  requestLogger is a function
  // -------------------------------------------------------------------------
  it('should be a function', () => {
    assert.strictEqual(typeof requestLogger, 'function');
  });

  // -------------------------------------------------------------------------
  // 4.1  next() is called to continue the middleware pipeline
  // -------------------------------------------------------------------------
  it('should call next() to continue the middleware pipeline', () => {
    const req = createMockReq();
    const { res } = createMockRes();
    const next = mock.fn();

    requestLogger(req, res, next);

    assert.strictEqual(next.mock.calls.length, 1);
  });

  // -------------------------------------------------------------------------
  // 4.2  Registers a finish event listener on res
  // -------------------------------------------------------------------------
  it('should register a finish event listener on the response', () => {
    const req = createMockReq();
    // Use a custom res that records every on() invocation for inspection
    const onCalls = [];
    const res = {
      statusCode: 200,
      on(event, cb) {
        onCalls.push({ event, cb });
      },
    };
    const next = mock.fn();

    requestLogger(req, res, next);

    // Exactly one listener should have been registered
    assert.strictEqual(onCalls.length, 1);
    // The listener must be for the 'finish' event
    assert.strictEqual(onCalls[0].event, 'finish');
    // The callback must be a function
    assert.strictEqual(typeof onCalls[0].cb, 'function');
  });

  // -------------------------------------------------------------------------
  // 4.3  Logs request method, URL, status code, and response time on finish
  // -------------------------------------------------------------------------
  it('should log request method, URL, status code, and response time on finish', () => {
    const req = createMockReq('GET', '/test');
    const { res, emitFinish } = createMockRes(200);
    const next = mock.fn();

    requestLogger(req, res, next);
    emitFinish();

    // logger.info should have been called exactly once on finish
    assert.strictEqual(logger.info.mock.calls.length, 1);

    const logMessage = logger.info.mock.calls[0].arguments[0];

    // Verify the log message contains the HTTP method
    assert.match(logMessage, /GET/);
    // Verify the log message contains the request URL
    assert.match(logMessage, /\/test/);
    // Verify the log message contains the status code
    assert.match(logMessage, /200/);
    // Verify the log message contains a numeric duration followed by 'ms'
    assert.match(logMessage, /\d+ms/);
  });

  // -------------------------------------------------------------------------
  // 4.4  Uses logger.info() utility (not raw console.log)
  // -------------------------------------------------------------------------
  it('should use logger.info() for logging, not raw console.log()', () => {
    // Additionally spy on console.log to prove the middleware does NOT
    // call it directly — all logging goes through logger.info()
    mock.method(console, 'log');

    const req = createMockReq();
    const { res, emitFinish } = createMockRes();
    const next = mock.fn();

    requestLogger(req, res, next);
    emitFinish();

    // The middleware MUST call logger.info (structured logging)
    assert.strictEqual(logger.info.mock.calls.length, 1);

    // console.log MUST NOT be called directly by the middleware — since
    // logger.info is mocked (no-op), the real console.log is never invoked.
    // If the middleware called console.log directly, this assertion would fail.
    assert.strictEqual(console.log.mock.calls.length, 0);
  });

  // -------------------------------------------------------------------------
  // 4.5  Response time is calculated correctly (non-negative, ms suffix)
  // -------------------------------------------------------------------------
  it('should calculate response time using Date.now() difference', () => {
    const req = createMockReq();
    const { res, emitFinish } = createMockRes();
    const next = mock.fn();

    requestLogger(req, res, next);
    emitFinish();

    assert.strictEqual(logger.info.mock.calls.length, 1);

    const logMessage = logger.info.mock.calls[0].arguments[0];
    // Extract the numeric duration from the log message
    const durationMatch = logMessage.match(/(\d+)ms/);
    assert.ok(durationMatch, 'Log message should contain a numeric duration with ms suffix');

    const duration = parseInt(durationMatch[1], 10);
    assert.ok(duration >= 0, 'Response time should be non-negative');
  });

  // -------------------------------------------------------------------------
  // 4.6  Logs different HTTP methods correctly
  // -------------------------------------------------------------------------
  it('should log different HTTP methods correctly', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];

    for (const method of methods) {
      // Reset logger.info call tracking between iterations
      logger.info.mock.resetCalls();

      const req = createMockReq(method, '/');
      const { res, emitFinish } = createMockRes();
      const next = mock.fn();

      requestLogger(req, res, next);
      emitFinish();

      assert.strictEqual(
        logger.info.mock.calls.length,
        1,
        `logger.info should be called once for method ${method}`
      );

      const logMessage = logger.info.mock.calls[0].arguments[0];
      assert.match(
        logMessage,
        new RegExp(method),
        `Log message should contain HTTP method: ${method}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // 4.7  Logs different URL paths correctly
  // -------------------------------------------------------------------------
  it('should log different URL paths correctly', () => {
    const urls = ['/', '/api/test', '/foo/bar'];

    for (const url of urls) {
      // Reset logger.info call tracking between iterations
      logger.info.mock.resetCalls();

      const req = createMockReq('GET', url);
      const { res, emitFinish } = createMockRes();
      const next = mock.fn();

      requestLogger(req, res, next);
      emitFinish();

      assert.strictEqual(
        logger.info.mock.calls.length,
        1,
        `logger.info should be called once for URL: ${url}`
      );

      const logMessage = logger.info.mock.calls[0].arguments[0];
      assert.ok(
        logMessage.includes(url),
        `Log message should contain URL path: ${url}`
      );
    }
  });
});
