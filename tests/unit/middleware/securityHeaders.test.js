'use strict';

/**
 * Unit Tests — Security Headers Middleware
 *
 * Validates that the securityHeaders middleware correctly sets all
 * production-grade HTTP security response headers and removes the
 * X-Powered-By header on every response.
 *
 * Tested headers:
 *  1. X-Content-Type-Options: nosniff
 *  2. X-Frame-Options: DENY
 *  3. X-XSS-Protection: 0
 *  4. Strict-Transport-Security: max-age=31536000; includeSubDomains
 *  5. Content-Security-Policy: default-src 'none'
 *  6. X-Powered-By removal
 *
 * Uses ONLY Node.js built-in modules: node:test and node:assert/strict.
 * Zero external dependencies.
 *
 * @module tests/unit/middleware/securityHeaders.test
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { securityHeaders } = require('../../../src/middleware/securityHeaders');

describe('securityHeaders middleware', () => {
  /** @type {object} Mock HTTP IncomingMessage */
  let req;
  /** @type {object} Mock HTTP ServerResponse with header tracking */
  let res;
  /** @type {boolean} Tracks whether next() was invoked */
  let nextCalled;
  /** @type {Function} Mock next callback for middleware pipeline */
  let next;

  /**
   * Create fresh mock objects before each test to prevent shared
   * mutable state from leaking between test cases.
   */
  beforeEach(() => {
    // Minimal mock request — securityHeaders doesn't read req,
    // but providing method and url follows the (req, res, next) signature pattern.
    req = {
      method: 'GET',
      url: '/'
    };

    // Mock response object that tracks setHeader and removeHeader calls.
    // Pre-populate X-Powered-By to validate its removal.
    res = {
      _headers: {
        'X-Powered-By': 'Node.js'
      },
      _removedHeaders: [],
      setHeader(name, value) {
        res._headers[name] = value;
      },
      removeHeader(name) {
        res._removedHeaders.push(name);
        delete res._headers[name];
      }
    };

    // Track whether the middleware correctly calls next() to continue the pipeline.
    nextCalled = false;
    next = () => {
      nextCalled = true;
    };
  });

  // ─── Test Case 3.9: Type validation ────────────────────────────────

  it('should be a function', () => {
    assert.strictEqual(typeof securityHeaders, 'function');
  });

  // ─── Test Case 3.1: X-Content-Type-Options ─────────────────────────

  it('should set X-Content-Type-Options to nosniff', () => {
    securityHeaders(req, res, next);

    assert.strictEqual(
      res._headers['X-Content-Type-Options'],
      'nosniff'
    );
  });

  // ─── Test Case 3.2: X-Frame-Options ────────────────────────────────

  it('should set X-Frame-Options to DENY', () => {
    securityHeaders(req, res, next);

    assert.strictEqual(
      res._headers['X-Frame-Options'],
      'DENY'
    );
  });

  // ─── Test Case 3.3: X-XSS-Protection ──────────────────────────────

  it('should set X-XSS-Protection to 0', () => {
    securityHeaders(req, res, next);

    // CRITICAL: Value is the string '0', NOT the number 0 or the string '1'.
    // Modern best practice disables the legacy XSS auditor entirely.
    assert.strictEqual(
      res._headers['X-XSS-Protection'],
      '0'
    );
  });

  // ─── Test Case 3.4: Strict-Transport-Security ─────────────────────

  it('should set Strict-Transport-Security with max-age and includeSubDomains', () => {
    securityHeaders(req, res, next);

    assert.strictEqual(
      res._headers['Strict-Transport-Security'],
      'max-age=31536000; includeSubDomains'
    );
  });

  // ─── Test Case 3.5: Content-Security-Policy ───────────────────────

  it('should set Content-Security-Policy to default-src none', () => {
    securityHeaders(req, res, next);

    assert.strictEqual(
      res._headers['Content-Security-Policy'],
      "default-src 'none'"
    );
  });

  // ─── Test Case 3.6: X-Powered-By removal ─────────────────────────

  it('should remove X-Powered-By header', () => {
    // res._headers['X-Powered-By'] is pre-set to 'Node.js' in beforeEach
    // to simulate a scenario where the header exists prior to middleware execution.
    securityHeaders(req, res, next);

    // Verify the header was deleted from the headers map.
    assert.strictEqual(
      res._headers['X-Powered-By'],
      undefined
    );

    // Verify removeHeader was explicitly called with 'X-Powered-By'.
    assert.ok(
      res._removedHeaders.includes('X-Powered-By'),
      'removeHeader should have been called with X-Powered-By'
    );
  });

  // ─── Test Case 3.7: next() invocation ─────────────────────────────

  it('should call next() to continue the middleware pipeline', () => {
    securityHeaders(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  // ─── Test Case 3.8: Comprehensive header check ────────────────────

  it('should set all 5 security headers on a single response', () => {
    securityHeaders(req, res, next);

    // Verify every security header is present with the exact expected value
    // from a single invocation of the middleware.
    assert.strictEqual(
      res._headers['X-Content-Type-Options'],
      'nosniff'
    );
    assert.strictEqual(
      res._headers['X-Frame-Options'],
      'DENY'
    );
    assert.strictEqual(
      res._headers['X-XSS-Protection'],
      '0'
    );
    assert.strictEqual(
      res._headers['Strict-Transport-Security'],
      'max-age=31536000; includeSubDomains'
    );
    assert.strictEqual(
      res._headers['Content-Security-Policy'],
      "default-src 'none'"
    );
  });
});
