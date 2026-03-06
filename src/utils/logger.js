'use strict';

/**
 * Structured logging utility that wraps console methods with ISO timestamps
 * and log levels. Provides info(), warn(), and error() methods as a lightweight,
 * zero-dependency alternative to external logging libraries.
 *
 * This module is the foundational logging layer for the application, consumed by
 * middleware, server, app bootstrap, and shutdown modules. It follows the
 * Liskov Substitution Principle — any compatible logger providing info(), warn(),
 * and error() methods can be swapped in as a drop-in replacement.
 *
 * @module utils/logger
 */

/**
 * Logger object providing structured log output with ISO timestamps and level prefixes.
 * Each method delegates to the corresponding native console method after prepending
 * a formatted prefix: [<ISO_TIMESTAMP>] [<LEVEL>].
 *
 * @type {{ info: Function, warn: Function, error: Function }}
 */
const logger = {
  /**
   * Logs an informational message to stdout via console.log.
   * Output format: [2025-01-01T00:00:00.000Z] [INFO] <message>
   *
   * @param {...*} args - Arguments to log (strings, objects, numbers, etc.)
   */
  info: (...args) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO]`, ...args);
  },

  /**
   * Logs a warning message to stderr via console.warn.
   * Output format: [2025-01-01T00:00:00.000Z] [WARN] <message>
   *
   * @param {...*} args - Arguments to log (strings, objects, numbers, etc.)
   */
  warn: (...args) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]`, ...args);
  },

  /**
   * Logs an error message to stderr via console.error.
   * Output format: [2025-01-01T00:00:00.000Z] [ERROR] <message>
   *
   * @param {...*} args - Arguments to log (strings, objects, numbers, etc.)
   */
  error: (...args) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]`, ...args);
  }
};

module.exports = { logger };
