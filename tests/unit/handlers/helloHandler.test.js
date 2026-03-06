'use strict';

/**
 * Unit tests for src/handlers/helloHandler.js
 *
 * Validates that the extracted Hello World request handler preserves the exact
 * business logic from the original monolithic server.js (lines 6-10):
 *   - Status code: 200
 *   - Content-Type: text/plain
 *   - Body: "Hello, World!\n" (including trailing newline)
 *   - Universal: same response regardless of HTTP method, URL path, or headers
 *
 * Uses ONLY Node.js built-in modules (node:test, node:assert) — zero external
 * npm dependencies per AAP §0.7.1: "Do not introduce unnecessary dependencies."
 *
 * @see AAP §0.7.3 — Behavioral Preservation Checklist
 * @see AAP §0.7.5 — Unit Test Case Directives
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { helloHandler } = require('../../../src/handlers/helloHandler');

/**
 * Creates a fresh mock request object simulating http.IncomingMessage.
 * The handler is expected to ignore all request properties — method, url,
 * and headers are provided solely for realistic simulation.
 *
 * @param {Object} [overrides] - Optional property overrides
 * @param {string} [overrides.method='GET'] - HTTP method
 * @param {string} [overrides.url='/'] - Request URL path
 * @param {Object} [overrides.headers={}] - Request headers
 * @returns {Object} Mock request object
 */
function createMockReq(overrides) {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    ...overrides,
  };
}

/**
 * Creates a fresh mock response object simulating http.ServerResponse.
 * Provides tracking properties to verify handler behavior:
 *   - _headers: records all setHeader() calls as key-value pairs
 *   - _endCalled: boolean flag set to true when end() is invoked
 *   - _body: stores the body argument passed to end()
 *
 * Uses simple property tracking rather than complex mocking frameworks
 * per AAP §0.7.1: "Keep the code simple and understandable."
 *
 * @returns {Object} Mock response object with tracking capabilities
 */
function createMockRes() {
  const res = {
    statusCode: 0,
    _headers: {},
    _endCalled: false,
    _body: null,

    /**
     * Tracks setHeader calls by storing header name-value pairs.
     * @param {string} name - Header name
     * @param {string} value - Header value
     */
    setHeader(name, value) {
      res._headers[name] = value;
    },

    /**
     * Tracks end() calls by recording the body and setting the called flag.
     * @param {string} [body] - Response body content
     */
    end(body) {
      res._endCalled = true;
      res._body = body;
    },
  };

  return res;
}

describe('helloHandler', () => {
  /** @type {Object} Fresh mock request object, recreated before each test */
  let req;
  /** @type {Object} Fresh mock response object, recreated before each test */
  let res;

  // Create fresh mock objects before each test to prevent shared mutable
  // state from leaking between test cases (AAP Phase 2 requirement)
  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.7: Handler is a Function (basic type check)
  // Validates that the module exports a callable function.
  // ──────────────────────────────────────────────────────────────────────
  it('should be a function', () => {
    assert.strictEqual(typeof helloHandler, 'function');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.1: Response Status Code (AAP §0.7.5)
  // Validates: "GET / returns status 200" (AAP §0.7.3)
  // Original server.js line 7: res.statusCode = 200;
  // ──────────────────────────────────────────────────────────────────────
  it('should respond with status code 200', () => {
    helloHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.2: Content-Type Header (AAP §0.7.5)
  // Validates: "header Content-Type: text/plain" (AAP §0.7.3)
  // Original server.js line 8: res.setHeader('Content-Type', 'text/plain');
  // ──────────────────────────────────────────────────────────────────────
  it('should set Content-Type header to text/plain', () => {
    helloHandler(req, res);

    assert.strictEqual(res._headers['Content-Type'], 'text/plain');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.3: Response Body (AAP §0.7.5)
  // Validates: "body Hello, World!\n" (AAP §0.7.3)
  // Original server.js line 9: res.end('Hello, World!\n');
  // CRITICAL: Body MUST include the trailing newline character \n
  // ──────────────────────────────────────────────────────────────────────
  it('should respond with body "Hello, World!\\n"', () => {
    helloHandler(req, res);

    assert.strictEqual(res._body, 'Hello, World!\n');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.4: res.end() is Called (AAP §0.7.5)
  // Validates: "Handler calls res.end() to complete the response"
  // Ensures the handler properly terminates the response lifecycle.
  // ──────────────────────────────────────────────────────────────────────
  it('should call res.end() to complete the response', () => {
    helloHandler(req, res);

    assert.strictEqual(res._endCalled, true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.5: Handler is Method-Agnostic (AAP §0.7.3)
  // Validates: "POST /anything returns the same response",
  //            "PUT /foo/bar returns the same response",
  //            "Any HTTP method on any path returns the same response"
  // The handler must produce identical output for all standard HTTP methods.
  // ──────────────────────────────────────────────────────────────────────
  it('should respond identically regardless of HTTP method', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

    for (const method of methods) {
      const methodReq = createMockReq({ method });
      const methodRes = createMockRes();

      helloHandler(methodReq, methodRes);

      assert.strictEqual(
        methodRes.statusCode,
        200,
        `Expected status 200 for ${method} but got ${methodRes.statusCode}`
      );
      assert.strictEqual(
        methodRes._headers['Content-Type'],
        'text/plain',
        `Expected Content-Type text/plain for ${method} but got ${methodRes._headers['Content-Type']}`
      );
      assert.strictEqual(
        methodRes._body,
        'Hello, World!\n',
        `Expected body "Hello, World!\\n" for ${method} but got "${methodRes._body}"`
      );
      assert.strictEqual(
        methodRes._endCalled,
        true,
        `Expected res.end() to be called for ${method}`
      );
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Test Case 3.6: Handler is Path-Agnostic (AAP §0.7.3)
  // Validates: "GET / returns status 200",
  //            "POST /anything returns the same response",
  //            "PUT /foo/bar returns the same response"
  // The handler must produce identical output for all URL paths.
  // ──────────────────────────────────────────────────────────────────────
  it('should respond identically regardless of URL path', () => {
    const paths = ['/', '/anything', '/foo/bar', '/api/v1/users', ''];

    for (const url of paths) {
      const pathReq = createMockReq({ url });
      const pathRes = createMockRes();

      helloHandler(pathReq, pathRes);

      assert.strictEqual(
        pathRes.statusCode,
        200,
        `Expected status 200 for path "${url}" but got ${pathRes.statusCode}`
      );
      assert.strictEqual(
        pathRes._headers['Content-Type'],
        'text/plain',
        `Expected Content-Type text/plain for path "${url}" but got ${pathRes._headers['Content-Type']}`
      );
      assert.strictEqual(
        pathRes._body,
        'Hello, World!\n',
        `Expected body "Hello, World!\\n" for path "${url}" but got "${pathRes._body}"`
      );
      assert.strictEqual(
        pathRes._endCalled,
        true,
        `Expected res.end() to be called for path "${url}"`
      );
    }
  });
});
