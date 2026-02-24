'use strict';

/**
 * Graceful shutdown utility for HTTP server.
 *
 * Addresses the complete absence of signal handling and error recovery
 * in the original server.js — which had zero application-level error
 * handling, no try/catch, no server.on('error'), and no shutdown hooks.
 *
 * Shutdown sequence:
 *   1. Receive signal (SIGINT/SIGTERM) or uncaught error
 *   2. Stop accepting new connections via server.close()
 *   3. Drain in-flight requests until all connections complete
 *   4. If drain exceeds timeout, force-kill the process
 *   5. Exit with code 0 (clean) or 1 (error/timeout)
 *
 * @module src/utils/graceful-shutdown
 */

/**
 * Force-kill timeout in milliseconds.
 * Configurable via the SHUTDOWN_TIMEOUT environment variable.
 * Defaults to 5000ms (5 seconds) per AAP §0.8.2 performance expectations.
 * @type {number}
 */
const FORCE_KILL_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 5000;

/**
 * Flag to prevent duplicate shutdown sequences from concurrent signals.
 * Once a shutdown is initiated, subsequent signals are ignored.
 * @type {boolean}
 */
let isShuttingDown = false;

/**
 * Sets up graceful shutdown handlers for the given HTTP server.
 *
 * Registers handlers for:
 * - SIGINT (Ctrl+C) — initiates graceful shutdown
 * - SIGTERM (container stop / process manager kill) — initiates graceful shutdown
 * - uncaughtException — logs error with stack trace, then initiates graceful shutdown
 * - unhandledRejection — logs rejection reason, then initiates graceful shutdown
 *
 * The shutdown process stops accepting new connections, waits for in-flight
 * requests to complete, and force-kills after FORCE_KILL_TIMEOUT if draining
 * takes too long.
 *
 * @param {http.Server} server - The HTTP server instance to attach shutdown handlers to
 * @returns {void}
 */
/**
 * References to registered process event listeners, stored so they can be
 * removed by teardownGracefulShutdown(). Without tracking these, the listeners
 * persist after server.close() in test environments, causing Jest "worker
 * process failed to exit gracefully" warnings due to leaked process listeners.
 * @type {{ sigint: Function|null, sigterm: Function|null, uncaughtException: Function|null, unhandledRejection: Function|null }}
 */
let listeners = { sigint: null, sigterm: null, uncaughtException: null, unhandledRejection: null };

function setupGracefulShutdown(server) {
  /**
   * Internal shutdown handler that orchestrates the graceful shutdown sequence.
   * Prevents re-entry via the isShuttingDown flag.
   *
   * @param {string} signal - The signal or event name that triggered the shutdown
   * @returns {void}
   */
  function shutdown(signal) {
    if (isShuttingDown) {
      console.log(`[Shutdown] Already shutting down. Ignoring ${signal}.`);
      return;
    }
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Graceful shutdown initiated...`);

    // Set a force-kill timeout to prevent indefinite hanging if connections
    // refuse to drain. The timer is unref'd so it does not prevent the
    // process from exiting normally when server.close() completes first.
    const forceKillTimer = setTimeout(() => {
      console.error(`[Shutdown] Force-killing after ${FORCE_KILL_TIMEOUT}ms timeout.`);
      process.exit(1);
    }, FORCE_KILL_TIMEOUT);
    forceKillTimer.unref();

    // Stop accepting new connections and wait for in-flight requests to complete.
    // The callback fires once all active connections have been closed.
    server.close((err) => {
      if (err) {
        console.error(`[Shutdown] Error during server close: ${err.message}`);
        process.exit(1);
      }
      console.log('[Shutdown] HTTP server closed. All connections drained.');
      process.exit(0);
    });
  }

  // Store named references so teardownGracefulShutdown() can remove them later
  listeners.sigint = () => shutdown('SIGINT');
  listeners.sigterm = () => shutdown('SIGTERM');
  listeners.uncaughtException = (err) => {
    console.error(`[Error] Uncaught exception: ${err.message}`);
    console.error(err.stack);
    shutdown('uncaughtException');
  };
  listeners.unhandledRejection = (reason, promise) => {
    console.error(`[Error] Unhandled rejection: ${reason}`);
    shutdown('unhandledRejection');
  };

  // Signal handlers — ensure proper shutdown on Ctrl+C and container/PM stops
  process.on('SIGINT', listeners.sigint);
  process.on('SIGTERM', listeners.sigterm);

  // Global error handlers (AAP §0.7.3 Error Handling Gap Analysis)
  // Catches unhandled exceptions that would otherwise crash the process
  process.on('uncaughtException', listeners.uncaughtException);

  // Catches unhandled promise rejections that would otherwise only warn to stderr
  process.on('unhandledRejection', listeners.unhandledRejection);
}

/**
 * Removes all process-level event listeners that were registered by
 * setupGracefulShutdown(). Also resets the isShuttingDown flag so that a
 * subsequent setupGracefulShutdown() call (e.g., in a new test) can
 * register fresh listeners without the stale flag blocking shutdown.
 *
 * This function MUST be called during test teardown (afterAll) to prevent
 * Jest "worker process failed to exit gracefully" warnings caused by
 * leaked SIGINT/SIGTERM/uncaughtException/unhandledRejection listeners.
 *
 * Safe to call multiple times — silently no-ops if no listeners are registered.
 *
 * @returns {void}
 */
function teardownGracefulShutdown() {
  if (listeners.sigint) {
    process.removeListener('SIGINT', listeners.sigint);
  }
  if (listeners.sigterm) {
    process.removeListener('SIGTERM', listeners.sigterm);
  }
  if (listeners.uncaughtException) {
    process.removeListener('uncaughtException', listeners.uncaughtException);
  }
  if (listeners.unhandledRejection) {
    process.removeListener('unhandledRejection', listeners.unhandledRejection);
  }
  listeners = { sigint: null, sigterm: null, uncaughtException: null, unhandledRejection: null };
  isShuttingDown = false;
}

module.exports = { setupGracefulShutdown, teardownGracefulShutdown };
