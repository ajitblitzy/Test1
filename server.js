'use strict';

/**
 * Application entry point.
 *
 * Thin orchestrator that reads the centralized configuration and delegates
 * to either the multi-core clustering module or the single-process HTTP
 * server factory.  Running `node server.js` (Rule R-006) starts the
 * application in the mode determined by the ENABLE_CLUSTERING environment
 * variable (default: single-process, Rule R-008).
 *
 * @see {@link module:config}       for environment-based configuration
 * @see {@link module:src/cluster}  for multi-core worker forking
 * @see {@link module:src/app}      for the HTTP server factory
 */

const config = require('./config');

if (config.enableClustering) {
  const { startCluster } = require('./src/cluster');
  startCluster();
} else {
  const { createApp } = require('./src/app');
  createApp();
}
