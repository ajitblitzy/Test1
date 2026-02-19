'use strict';

/**
 * src/config.js — Centralized Application Configuration
 *
 * Foundation layer module that exports all application settings for the
 * staging-approval workflow system. Imported by server.js, router.js,
 * controllers, and middleware modules throughout the application.
 *
 * Design decisions:
 * - Zero external dependencies: uses only process.env (Node.js global)
 * - CommonJS module pattern: module.exports = { ... }
 * - Backward compatible defaults: hostname and port match original server.js
 * - API key values read from environment only — never hardcoded or logged
 * - State machine constants centralized here for cross-module consistency
 *
 * @module config
 */

/**
 * Application configuration object.
 *
 * All values have sensible defaults that preserve backward compatibility
 * with the original server.js implementation. Environment variables
 * override defaults when present.
 *
 * @type {Object}
 */
module.exports = {

  // ---------------------------------------------------------------------------
  // Server Binding Configuration
  // Defaults match original server.js lines 3-4 for backward compatibility
  // (AAP §0.7.2). The existing startup log format and server behavior are
  // preserved when no environment variables are set.
  // ---------------------------------------------------------------------------

  /**
   * Server hostname/IP address to bind to.
   * Defaults to '127.0.0.1' (loopback) matching the original server.js.
   * Override via HOSTNAME environment variable.
   * @type {string}
   */
  hostname: process.env.HOSTNAME || '127.0.0.1',

  /**
   * Server port number to listen on.
   * Defaults to 3000 matching the original server.js.
   * Override via PORT environment variable.
   * Parsed as base-10 integer to ensure numeric type.
   * @type {number}
   */
  port: parseInt(process.env.PORT, 10) || 3000,

  // ---------------------------------------------------------------------------
  // API Authentication — Secret Keys
  // Read from environment secrets per AAP §0.1.2. Values are never hardcoded
  // and must never be logged or included in response bodies (AAP §0.7.3).
  // Default to empty string when not set — authentication middleware will
  // reject requests gracefully when keys are unconfigured.
  // ---------------------------------------------------------------------------

  /**
   * Primary API key for authenticating sensitive workflow endpoints
   * (approve, reject, promote). Read from BLITZY_CLIENT_API_KEY env var.
   * @type {string}
   */
  apiKey: process.env.BLITZY_CLIENT_API_KEY || '',

  /**
   * Secondary API key. Read from BLITZY_CLIENT_API_KEY2 env var.
   * Provides additional valid key for authentication flexibility.
   * @type {string}
   */
  apiKey2: process.env.BLITZY_CLIENT_API_KEY2 || '',

  /**
   * Tertiary API key. Read from BLITZY_CLIENT_API_KEY3 env var.
   * Provides additional valid key for authentication flexibility.
   * @type {string}
   */
  apiKey3: process.env.BLITZY_CLIENT_API_KEY3 || '',

  // ---------------------------------------------------------------------------
  // General Environment Variables
  // User-provided environment variables per AAP §0.8.3. Available for
  // application-level configuration or feature flags.
  // ---------------------------------------------------------------------------

  /**
   * Environment variable 'c'. Default: empty string.
   * @type {string}
   */
  envC: process.env.c || '',

  /**
   * Environment variable 'd'. Default: empty string.
   * @type {string}
   */
  envD: process.env.d || '',

  /**
   * Environment variable 'r'. Default: empty string.
   * @type {string}
   */
  envR: process.env.r || '',

  // ---------------------------------------------------------------------------
  // Default Production Content
  // The original Hello, World! response that the production endpoint serves
  // until a prototype is explicitly approved and promoted through the
  // staging-approval workflow. This preserves backward compatibility with
  // the original server.js behavior (AAP §0.7.2).
  // ---------------------------------------------------------------------------

  /**
   * Default content served by GET / when no prototype has been promoted.
   * Exactly matches the original server.js response: 'Hello, World!\n'
   * @type {string}
   */
  defaultProductionContent: 'Hello, World!\n',

  // ---------------------------------------------------------------------------
  // State Machine — Lifecycle States
  // Constants representing the five states in the requirement lifecycle.
  // Used by requirementStore.js and controllers to ensure consistent state
  // references across the entire application (AAP §0.4.2).
  // ---------------------------------------------------------------------------

  /**
   * Requirement lifecycle states.
   * @type {Object}
   * @property {string} SUBMITTED  - Initial state when a requirement is created
   * @property {string} STAGED     - Prototype generated and available for review
   * @property {string} APPROVED   - Prototype approved by reviewer, eligible for promotion
   * @property {string} REJECTED   - Prototype rejected; terminal state, no further transitions
   * @property {string} PRODUCTION - Prototype promoted to production; terminal state
   */
  states: {
    SUBMITTED: 'submitted',
    STAGED: 'staged',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PRODUCTION: 'production'
  },

  // ---------------------------------------------------------------------------
  // State Machine — Valid Transitions
  // Defines which state transitions are permitted for the requirement lifecycle.
  // Each key is the current state; the value is an array of valid target states.
  // The requirementStore.js module uses this map to enforce transition guards,
  // preventing any invalid state changes (AAP §0.4.2, §0.7.1).
  //
  // Transition flow:
  //   submitted → staged       (system generates prototype)
  //   staged    → approved     (reviewer approves)
  //   staged    → rejected     (reviewer rejects)
  //   approved  → production   (promoter pushes to production)
  //   rejected  → (none)       (terminal state)
  //   production→ (none)       (terminal state)
  //
  // No backward transitions are allowed. Terminal states have empty arrays.
  // ---------------------------------------------------------------------------

  /**
   * Valid state transitions map.
   * Keys are current states; values are arrays of allowed target states.
   * Empty arrays indicate terminal states with no further transitions.
   * @type {Object.<string, string[]>}
   */
  validTransitions: {
    submitted: ['staged'],
    staged: ['approved', 'rejected'],
    approved: ['production'],
    rejected: [],
    production: []
  }
};
