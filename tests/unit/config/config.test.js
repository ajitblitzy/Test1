'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Absolute path to the config module, resolved once for efficient
 * require-cache invalidation across all test cases.
 *
 * The config module reads process.env at require()-time and freezes the
 * resulting object — subsequent require() calls return the cached (stale)
 * frozen snapshot. Every test that needs fresh environment variable readings
 * must clear this cache entry before re-requiring the module.
 */
const CONFIG_MODULE_PATH = require.resolve('../../../src/config/index.js');

/**
 * Loads a fresh instance of the config module by invalidating the require
 * cache entry first. This guarantees that the returned config object reflects
 * the current state of process.env at call time rather than a previously
 * cached frozen snapshot.
 *
 * @returns {Object} A freshly-loaded, frozen config object with properties:
 *   - {string} host    — Server bind address
 *   - {number} port    — Server listen port
 *   - {string} nodeEnv — Runtime environment identifier
 */
function loadConfig() {
  delete require.cache[CONFIG_MODULE_PATH];
  return require('../../../src/config/index.js');
}

describe('config', () => {
  /**
   * Saved environment variable values captured before each test and
   * restored in afterEach to prevent cross-test contamination.
   * Values may be undefined when the env var is not set in the host
   * environment — the restore logic handles this by deleting the key.
   */
  let originalHost;
  let originalPort;
  let originalNodeEnv;

  beforeEach(() => {
    // Capture the current state of all env vars the config module reads
    originalHost = process.env.HOST;
    originalPort = process.env.PORT;
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore HOST — delete if it was originally undefined
    if (originalHost === undefined) {
      delete process.env.HOST;
    } else {
      process.env.HOST = originalHost;
    }

    // Restore PORT — delete if it was originally undefined
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }

    // Restore NODE_ENV — delete if it was originally undefined
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    // Clear require cache so the next loadConfig() gets a fresh module
    delete require.cache[CONFIG_MODULE_PATH];
  });

  // ---------------------------------------------------------------
  // Default values — env vars unset
  // Validates AAP §0.7.3: "Server binds to 127.0.0.1:3000 by default"
  // Validates original server.js lines 3-4 hardcoded constants
  // ---------------------------------------------------------------

  it('should default host to 127.0.0.1 when HOST env var is unset', () => {
    delete process.env.HOST;
    const config = loadConfig();

    assert.strictEqual(config.host, '127.0.0.1');
  });

  it('should default port to 3000 when PORT env var is unset', () => {
    delete process.env.PORT;
    const config = loadConfig();

    assert.strictEqual(config.port, 3000);
  });

  it('should default nodeEnv to development when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    const config = loadConfig();

    assert.strictEqual(config.nodeEnv, 'development');
  });

  // ---------------------------------------------------------------
  // Environment variable overrides
  // Validates AAP §0.7.5: "Environment variable overrides are applied"
  // ---------------------------------------------------------------

  it('should use HOST env var value when set', () => {
    process.env.HOST = '0.0.0.0';
    const config = loadConfig();

    assert.strictEqual(config.host, '0.0.0.0');
  });

  it('should parse PORT env var as a number when set to a valid numeric string', () => {
    process.env.PORT = '8080';
    const config = loadConfig();

    // PORT must be a number, not the string '8080'
    assert.strictEqual(config.port, 8080);
    assert.strictEqual(typeof config.port, 'number');
  });

  it('should use NODE_ENV env var value when set', () => {
    process.env.NODE_ENV = 'production';
    const config = loadConfig();

    assert.strictEqual(config.nodeEnv, 'production');
  });

  // ---------------------------------------------------------------
  // PORT validation and fallback
  // Validates AAP §0.7.6: "PORT set to a non-numeric value — config
  // validation must fallback or throw"
  // ---------------------------------------------------------------

  it('should fall back to 3000 when PORT is a non-numeric string', () => {
    process.env.PORT = 'abc';
    const config = loadConfig();

    // parseInt('abc', 10) returns NaN → fallback to default 3000
    assert.strictEqual(config.port, 3000);
  });

  it('should fall back to 3000 when PORT is an empty string', () => {
    process.env.PORT = '';
    const config = loadConfig();

    // parseInt('', 10) returns NaN → fallback to default 3000
    assert.strictEqual(config.port, 3000);
  });

  // ---------------------------------------------------------------
  // Object.freeze immutability
  // Validates AAP §0.5.1: "freeze the config object to prevent mutation"
  // ---------------------------------------------------------------

  it('should freeze the config object to prevent property mutation', () => {
    delete process.env.HOST;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    const config = loadConfig();

    // In strict mode, assigning to a frozen object property throws TypeError
    assert.throws(() => {
      config.host = 'changed';
    }, TypeError);

    // Confirm the value was not mutated
    assert.strictEqual(config.host, '127.0.0.1');
  });
});
