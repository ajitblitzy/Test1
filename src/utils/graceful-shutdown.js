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

  // Signal handlers — ensure proper shutdown on Ctrl+C and container/PM stops
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Global error handlers (AAP §0.7.3 Error Handling Gap Analysis)
  // Catches unhandled exceptions that would otherwise crash the process
  process.on('uncaughtException', (err) => {
    console.error(`[Error] Uncaught exception: ${err.message}`);
    console.error(err.stack);
    shutdown('uncaughtException');
  });

  // Catches unhandled promise rejections that would otherwise only warn to stderr
  process.on('unhandledRejection', (reason, promise) => {
    console.error(`[Error] Unhandled rejection: ${reason}`);
    shutdown('unhandledRejection');
  });
}

module.exports = { setupGracefulShutdown };
