'use strict';

/**
 * Graceful Shutdown Handler
 *
 * Registers process signal handlers for SIGINT and SIGTERM to gracefully close
 * the HTTP server, and installs catch-all handlers for uncaughtException and
 * unhandledRejection to log errors before exiting. This module addresses the
 * missing shutdown handling identified in the original server.js — there were
 * no signal handlers, no server.close() calls, and no uncaught exception handling.
 *
 * Design decisions:
 * - Accepts the server instance via parameter (Dependency Injection) for testability
 * - Uses a boolean flag to prevent double-shutdown race conditions
 * - Configurable timeout forces exit if connections fail to drain
 * - All logging uses the structured logger utility (no raw console calls)
 *
 * @module utils/gracefulShutdown
 */

const { logger } = require('./logger');

/**
 * Default timeout in milliseconds before forcing a shutdown if active connections
 * have not drained after server.close() is called. Set to 10 seconds to provide
 * ample time for in-flight requests to complete under normal conditions.
 *
 * @constant {number}
 */
const SHUTDOWN_TIMEOUT = 10000;

/**
 * Registers SIGINT, SIGTERM, uncaughtException, and unhandledRejection handlers
 * on the current process to enable graceful shutdown of the provided HTTP server.
 *
 * On receiving a termination signal or encountering an unhandled error:
 * 1. Logs the event via the structured logger
 * 2. Calls server.close() to stop accepting new connections
 * 3. Waits for existing connections to drain (up to SHUTDOWN_TIMEOUT ms)
 * 4. Exits the process with the appropriate exit code
 *
 * A double-shutdown guard prevents redundant shutdown attempts if multiple
 * signals arrive in quick succession.
 *
 * @param {import('http').Server} server - The HTTP server instance to shut down gracefully
 * @returns {void}
 */
function gracefulShutdown(server) {
  /**
   * Tracks whether a shutdown sequence is already in progress.
   * Prevents duplicate shutdown attempts from concurrent signals.
   *
   * @type {boolean}
   */
  let shuttingDown = false;

  /**
   * Internal shutdown procedure — not exported. Closes the server, waits for
   * active connections to drain, and exits with the specified code. If connections
   * do not drain within SHUTDOWN_TIMEOUT milliseconds, a forced exit occurs.
   *
   * @param {number} [exitCode=0] - Process exit code. 0 for clean shutdown, 1 for errors.
   */
  function shutdown(exitCode) {
    // Guard against double-shutdown if multiple signals arrive concurrently
    if (shuttingDown) {
      logger.info('Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    shuttingDown = true;

    logger.info('Shutting down server...');

    // Set a safety timeout to force exit if connections fail to drain.
    // Using unref() ensures this timer does not keep the event loop alive
    // if the server closes before the timeout fires.
    const forceExitTimer = setTimeout(() => {
      logger.error('Forced shutdown — timeout exceeded');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
    forceExitTimer.unref();

    // Stop accepting new connections and wait for existing ones to finish
    server.close(() => {
      logger.info('Server closed successfully');
      clearTimeout(forceExitTimer);
      process.exit(exitCode || 0);
    });
  }

  // --- Signal Handlers ---

  /**
   * SIGINT is sent when the user presses Ctrl+C in the terminal.
   * Initiates a clean shutdown with exit code 0.
   */
  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal. Starting graceful shutdown...');
    shutdown(0);
  });

  /**
   * SIGTERM is the standard signal sent by process managers (systemd, Docker,
   * Kubernetes) to request a graceful stop. Initiates a clean shutdown with
   * exit code 0.
   */
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal. Starting graceful shutdown...');
    shutdown(0);
  });

  // --- Error Handlers ---

  /**
   * Catches synchronous exceptions that were not handled by any try/catch block.
   * Logs the full error and initiates shutdown with exit code 1 because the
   * process is in an undefined state after an uncaught exception.
   */
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown(1);
  });

  /**
   * Catches promise rejections that have no .catch() handler attached.
   * Logs the rejection reason and initiates shutdown with exit code 1 to
   * prevent the process from continuing in a potentially inconsistent state.
   */
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
    shutdown(1);
  });
}

module.exports = { gracefulShutdown };
