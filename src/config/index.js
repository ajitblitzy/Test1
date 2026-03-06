'use strict';

/**
 * Centralized application configuration.
 *
 * Reads from environment variables with sensible defaults matching
 * the original server.js hardcoded constants (hostname = '127.0.0.1',
 * port = 3000). The exported config object is frozen via Object.freeze()
 * to prevent accidental runtime mutation by consuming modules.
 *
 * Environment variables:
 *   HOST     — Server bind address   (default: '127.0.0.1')
 *   PORT     — Server listen port    (default: 3000)
 *   NODE_ENV — Runtime environment    (default: 'development')
 *
 * @module config
 */

/* Parse PORT early so the ternary inside the config literal stays clean */
const parsedPort = parseInt(process.env.PORT, 10);

const config = Object.freeze({
  /** @type {string} Server bind address — defaults to loopback */
  host: process.env.HOST || '127.0.0.1',

  /** @type {number} Server listen port — validated as numeric, falls back to 3000 */
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,

  /** @type {string} Runtime environment identifier */
  nodeEnv: process.env.NODE_ENV || 'development',
});

module.exports = config;
