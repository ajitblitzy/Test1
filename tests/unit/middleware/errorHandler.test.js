'use strict';

/**
 * Unit tests for src/middleware/errorHandler.js — the catch-all error handler
 * middleware that wraps request handlers in try/catch, returns a safe
 * 500 Internal Server Error response, prevents stack trace leakage to clients,
 * and logs full error details via the structured logger.
 *
 * Uses Node.js built-in test runner (node:test) and assertion module (node:assert)
 * exclusively — zero external testing dependencies per AAP §0.6.1 / §0.7.1.
 *
 * @module tests/unit/middleware/errorHandler.test
 */

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { errorHandler } = require('../../../src/middleware/errorHandler');
const { logger } = require('../../../src/utils/logger');

// ---------------------------------------------------------------------------
// Helper: creates a fresh mock request object (simulates http.IncomingMessage)
// ---------------------------------------------------------------------------
function createMockReq(overrides) {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: creates a fresh mock response object (simulates http.ServerResponse)
// with tracking for statusCode, headers, end(), and body.
// ---------------------------------------------------------------------------
function createMockRes(overrides) {
  const res = {
    statusCode: 0,
    headersSent: false,
    _headers: {},
    _endCalled: false,
    _body: null,

    setHeader(name, value) {
      res._headers[name] = value;
    },

    end(body) {
      res._endCalled = true;
      res._body = body !== undefined ? body : null;
    },

    ...overrides,
  };
  return res;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('errorHandler middleware', () => {
  // Set up spies before each test; restore after each test
  beforeEach(() => {
    mock.method(logger, 'error');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  // -----------------------------------------------------------------------
  // 4.8: errorHandler is a function
  // -----------------------------------------------------------------------
  it('should be a function', () => {
    assert.strictEqual(typeof errorHandler, 'function');
  });

  // -----------------------------------------------------------------------
  // 4.1: Returns 500 status code on error (AAP §0.7.5)
  // -----------------------------------------------------------------------
  it('should return status code 500 when an error occurs', () => {
    const throwingHandler = () => {
      throw new Error('Test error');
    };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(throwingHandler)(req, res);

    assert.strictEqual(res.statusCode, 500);
  });

  // -----------------------------------------------------------------------
  // 4.2: Sets Content-Type to text/plain on error (AAP §0.7.5)
  // -----------------------------------------------------------------------
  it('should set Content-Type to text/plain on error response', () => {
    const throwingHandler = () => {
      throw new Error('Content-Type test error');
    };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(throwingHandler)(req, res);

    assert.strictEqual(res._headers['Content-Type'], 'text/plain');
  });

  // -----------------------------------------------------------------------
  // 4.3: Response body is generic 'Internal Server Error\n' (AAP §0.7.5)
  // -----------------------------------------------------------------------
  it('should respond with generic "Internal Server Error" message without stack trace', () => {
    const throwingHandler = () => {
      throw new Error('Body test error');
    };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(throwingHandler)(req, res);

    assert.strictEqual(res._body, 'Internal Server Error\n');
  });

  // -----------------------------------------------------------------------
  // 4.4: Error details are logged via logger.error() (AAP §0.7.5)
  // -----------------------------------------------------------------------
  it('should log error details using logger.error()', () => {
    const specificMessage = 'Specific error message';
    const throwingHandler = () => {
      throw new Error(specificMessage);
    };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(throwingHandler)(req, res);

    // logger.error must have been called at least once
    assert.ok(
      logger.error.mock.calls.length >= 1,
      'logger.error() should be called at least once when an error occurs'
    );

    // Verify the first call includes the error message content
    const firstCallArgs = logger.error.mock.calls[0].arguments;
    const loggedContent = firstCallArgs.join(' ');
    assert.ok(
      loggedContent.includes(specificMessage),
      `logger.error() first call should contain "${specificMessage}", got: "${loggedContent}"`
    );
  });

  // -----------------------------------------------------------------------
  // 4.5: Respects res.headersSent check (AAP §0.7.5)
  //   When headers have already been sent, errorHandler must NOT attempt to
  //   write another response (avoids ERR_HTTP_HEADERS_SENT crash).
  // -----------------------------------------------------------------------
  it('should not send error response if headers have already been sent', () => {
    const throwingHandler = () => {
      throw new Error('headersSent test error');
    };
    const req = createMockReq();
    // Simulate headers already sent by the application
    const res = createMockRes({ headersSent: true });

    errorHandler(throwingHandler)(req, res);

    // res.end() should NOT have been called
    assert.strictEqual(res._endCalled, false,
      'res.end() must not be called when headers have already been sent');
    // statusCode should NOT have been changed to 500
    assert.strictEqual(res.statusCode, 0,
      'res.statusCode must not be changed to 500 when headers have already been sent');
  });

  // -----------------------------------------------------------------------
  // 4.6: Does not leak stack trace to client (AAP §0.7.7 security)
  // -----------------------------------------------------------------------
  it('should not include stack trace in response body', () => {
    const throwingHandler = () => {
      throw new Error('Stack trace leak test');
    };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(throwingHandler)(req, res);

    // Body must be EXACTLY the generic message — no error details
    assert.strictEqual(res._body, 'Internal Server Error\n');
    // Double-check: body must NOT contain stack trace patterns
    assert.ok(
      !res._body.includes('Error:'),
      'Response body must not contain "Error:" pattern'
    );
    assert.ok(
      !res._body.includes('at '),
      'Response body must not contain stack trace "at " pattern'
    );
    assert.ok(
      !res._body.includes('Stack trace leak test'),
      'Response body must not contain the original error message'
    );
  });

  // -----------------------------------------------------------------------
  // 4.7: Normal requests pass through without error handling
  // -----------------------------------------------------------------------
  it('should pass normal requests through without triggering error handling', () => {
    const normalHandler = (req, res) => {
      res.statusCode = 200;
      res.end('OK');
    };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(normalHandler)(req, res);

    // Handler should have set 200, not 500
    assert.strictEqual(res.statusCode, 200,
      'Normal handler response statusCode should be preserved');
    // Handler should have sent its own body
    assert.strictEqual(res._body, 'OK',
      'Normal handler response body should be preserved');
    // logger.error() must NOT have been called
    assert.strictEqual(logger.error.mock.calls.length, 0,
      'logger.error() should not be called for normal requests');
  });

  // -----------------------------------------------------------------------
  // Additional: errorHandler(handler) returns a function
  // -----------------------------------------------------------------------
  it('should return a function when given a handler', () => {
    const handler = () => {};
    const wrapped = errorHandler(handler);

    assert.strictEqual(typeof wrapped, 'function');
  });

  // -----------------------------------------------------------------------
  // Additional: logger.error is still called even when headersSent is true
  //   (error details must always be logged server-side regardless of response
  //   state, per the implementation in sendErrorResponse)
  // -----------------------------------------------------------------------
  it('should still log error via logger.error() when headers have already been sent', () => {
    const errMsg = 'Logged despite headersSent';
    const throwingHandler = () => {
      throw new Error(errMsg);
    };
    const req = createMockReq();
    const res = createMockRes({ headersSent: true });

    errorHandler(throwingHandler)(req, res);

    // Logging must still occur — only the response is suppressed
    assert.ok(
      logger.error.mock.calls.length >= 1,
      'logger.error() should still be called even when headers are already sent'
    );
    const firstCallArgs = logger.error.mock.calls[0].arguments;
    const loggedContent = firstCallArgs.join(' ');
    assert.ok(
      loggedContent.includes(errMsg),
      `logger.error() should contain "${errMsg}" even when headers are already sent`
    );
  });
});
