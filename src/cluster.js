'use strict';

/**
 * Multi-core clustering module.
 *
 * Leverages the Node.js built-in `cluster` module to fork one worker process
 * per available CPU core, distributing incoming HTTP connections across all
 * workers via round-robin scheduling (default on Linux). Each worker runs an
 * independent HTTP server instance created by the `createApp()` factory from
 * `src/app.js`.
 *
 * The primary process is responsible for:
 *   - Detecting the number of available CPU cores via `os.cpus().length`
 *   - Forking one worker per core
 *   - Monitoring worker lifecycle via `cluster.on('exit', ...)`
 *   - Automatically respawning any worker that exits unexpectedly
 *
 * Worker processes are responsible for:
 *   - Calling `createApp()` to create and start their own HTTP server instance
 *   - Handling incoming requests independently of other workers
 *
 * Performance characteristics (AAP §0.7.1):
 *   - Throughput scales near-linearly with worker count
 *   - 2 workers ≈ 1.9x, 4 workers ≈ 3.7x, 8 workers ≈ 7.2x baseline
 *   - Minimal IPC overhead between primary and workers
 *
 * This module is only loaded when `config.enableClustering === true`.
 * The conditional import in `server.js` prevents loading this module in
 * single-process mode, satisfying Rule R-008.
 *
 * @module src/cluster
 * @see {@link module:src/app} for the HTTP server factory
 * @see {@link module:config} for the enableClustering flag
 */

const cluster = require('cluster');
const os = require('os');
const { createApp } = require('./app');
const config = require('../config');

/**
 * Starts the clustered HTTP server.
 *
 * When called from the primary process, determines the available CPU core
 * count, forks one worker per core, and sets up an exit handler to
 * automatically respawn any crashed worker. When called from a worker
 * process (after being forked), invokes `createApp()` to create and start
 * an independent HTTP server instance within the worker.
 *
 * The `config` import is used to confirm clustering is enabled and to
 * make the configuration object available in the worker process context
 * (each forked worker re-requires all modules independently).
 *
 * @returns {void}
 *
 * @example
 * // In server.js (entry point):
 * const config = require('./config');
 * if (config.enableClustering) {
 *   const { startCluster } = require('./src/cluster');
 *   startCluster();
 * } else {
 *   const { createApp } = require('./src/app');
 *   createApp();
 * }
 */
function startCluster() {
  if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;

    console.log(
      '[Primary ' + process.pid + '] Clustering enabled (' +
      config.enableClustering + '). Starting ' + numCPUs + ' workers...'
    );

    /* Fork one worker per available CPU core for maximum throughput */
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    /**
     * Worker exit handler.
     *
     * Monitors all worker processes for unexpected exits. When a worker
     * crashes or is killed, the primary logs the event with the worker PID,
     * exit code, and signal, then immediately forks a replacement worker to
     * maintain full cluster capacity.
     *
     * @param {cluster.Worker} worker - The worker that exited.
     * @param {number|null}    code   - Exit code of the worker process, or null if killed by signal.
     * @param {string|null}    signal - Signal that killed the worker, or null if exited normally.
     */
    cluster.on('exit', (worker, code, signal) => {
      console.log(
        '[Primary] Worker ' + worker.process.pid +
        ' exited (code: ' + code + ', signal: ' + signal + ')'
      );
      console.log('[Primary] Forking replacement worker...');
      cluster.fork();
    });
  } else {
    /*
     * Worker process path.
     * Each worker creates its own independent HTTP server instance via
     * the createApp() factory. The config module is available in the
     * worker context since each forked process re-requires all modules.
     */
    createApp();
    console.log('[Worker ' + process.pid + '] Started');
  }
}

module.exports = { startCluster };
