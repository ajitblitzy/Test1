/**
 * SQLite Database Connection Singleton
 *
 * Creates and manages a singleton SQLite database connection via better-sqlite3.
 * Reads the database file path from the centralized config module, ensures the
 * target directory exists on disk, opens the connection with performance and
 * integrity PRAGMAs (WAL mode, foreign keys), and exports the database instance
 * for use by all model modules and the schema module.
 *
 * Consumers:
 *   - src/db/schema.js           — executes DDL statements
 *   - src/models/tablesMetadata.js       — CRUD on tables_metadata
 *   - src/models/queryExecutionStats.js  — CRUD on query_execution_stats
 *   - src/models/tableDependencies.js    — CRUD on table_dependencies
 *   - src/models/schemaChanges.js        — CRUD on schema_changes
 *   - server.js                          — calls initializeDatabase() on startup
 *
 * Design decisions:
 *   - Singleton via Node.js module caching: every require('./connection') returns
 *     the same cached module, so the `db` variable is shared across the process.
 *   - Initialization is deferred to initializeDatabase() so that server.js can
 *     control the startup sequence explicitly.  Model modules access `db` through
 *     the exported getter which guards against use before initialization.
 *
 * @module src/db/connection
 */

'use strict';

// ---------------------------------------------------------------------------
// External imports
// ---------------------------------------------------------------------------

/** Synchronous SQLite3 database driver — provides the Database constructor. */
const Database = require('better-sqlite3');

/** Built-in Node.js path utilities — used for path.dirname(). */
const path = require('path');

/** Built-in Node.js filesystem utilities — used for fs.mkdirSync(). */
const fs = require('fs');

// ---------------------------------------------------------------------------
// Internal imports
// ---------------------------------------------------------------------------

/**
 * Database file path from centralized config (default: './data/metadata.db').
 * @see src/config/index.js
 */
const { dbPath } = require('../config');

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/**
 * The singleton better-sqlite3 Database instance.
 * Initialized to `null` and set by initializeDatabase().
 * @type {import('better-sqlite3').Database | null}
 */
let db = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initializes the SQLite database connection.
 *
 * Performs the following steps in order:
 *   1. Derives the directory path from dbPath and creates it recursively
 *      if it does not already exist (fs.mkdirSync with { recursive: true }).
 *   2. Opens (or creates) the SQLite database file at the configured path
 *      using the better-sqlite3 Database constructor.
 *   3. Enables WAL (Write-Ahead Logging) journal mode for improved
 *      concurrent-read performance.
 *   4. Enables foreign key constraint enforcement (disabled by default
 *      in SQLite) to uphold referential integrity across all four tables.
 *
 * This function is idempotent — calling it more than once will close any
 * previously opened connection and re-initialize a fresh one.  In normal
 * operation it is called exactly once from server.js at startup.
 *
 * @returns {import('better-sqlite3').Database} The initialized database instance.
 * @throws {Error} If the directory cannot be created or the database cannot
 *   be opened (e.g. permission issues, corrupt file).
 */
const initializeDatabase = () => {
  // If a connection already exists, close it before re-initializing to
  // prevent resource leaks during repeated calls or testing scenarios.
  if (db !== null) {
    try {
      db.close();
    } catch (_closeErr) {
      // Swallow close errors — the connection may already be invalid.
    }
  }

  // Step 1 — Auto-create the data directory.
  // Per AAP §0.7.2 this MUST happen before the database file is opened.
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  // Step 2 — Open / create the SQLite database file.
  // The better-sqlite3 constructor is synchronous — no callback needed.
  db = new Database(dbPath);

  // Step 3 — Enable WAL journal mode for concurrent-read performance.
  db.pragma('journal_mode = WAL');

  // Step 4 — Enable foreign key constraint enforcement.
  db.pragma('foreign_keys = ON');

  return db;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Module exports use a property descriptor for `db` so that consumers always
 * receive the current value of the module-level `db` variable, even though it
 * starts as `null` and is assigned later inside initializeDatabase().
 *
 * Usage by consumers:
 *   const { db } = require('../db/connection');            // models, schema
 *   const { initializeDatabase } = require('./src/db/connection'); // server.js
 */
module.exports = {
  /**
   * The singleton better-sqlite3 Database instance.
   * Will be `null` until initializeDatabase() has been called.
   * Exposes pragma(), exec(), and prepare() methods from better-sqlite3.
   */
  get db() {
    return db;
  },

  /**
   * Explicit initialization entry point called by server.js at startup.
   * @type {Function}
   */
  initializeDatabase,
};
