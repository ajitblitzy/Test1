/**
 * Database Schema Initialization Module
 *
 * Defines and executes CREATE TABLE IF NOT EXISTS DDL statements for all four
 * user-specified table schemas:
 *   1. tables_metadata       — database table metadata (row counts, timestamps)
 *   2. query_execution_stats  — query performance metrics per table
 *   3. table_dependencies     — parent-child table relationship mapping
 *   4. schema_changes         — schema modification history log
 *
 * All SQL type translations follow the SQLite convention:
 *   INT / BIGINT  → INTEGER
 *   VARCHAR(100)  → TEXT
 *   FLOAT         → REAL
 *   DATE          → TEXT  (ISO 8601 YYYY-MM-DD strings)
 *
 * Foreign key references link query_execution_stats, table_dependencies, and
 * schema_changes back to tables_metadata via table_id.  The tables_metadata
 * table is always created first to satisfy these foreign key constraints.
 *
 * This module exposes a single function, initializeSchema(), which is called
 * once during server startup after the database connection has been opened.
 *
 * @module src/db/schema
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports
// ---------------------------------------------------------------------------

/**
 * Connection module providing the singleton better-sqlite3 Database instance.
 * Access db via the getter property (connection.db) at function call time to
 * ensure the instance has been initialized by initializeDatabase() first.
 *
 * @see src/db/connection.js
 */
const connection = require('./connection');

// ---------------------------------------------------------------------------
// Schema DDL Definitions
// ---------------------------------------------------------------------------

/**
 * Combined DDL string containing all four CREATE TABLE IF NOT EXISTS
 * statements.  Tables are ordered so that the referenced table
 * (tables_metadata) is created before any table that declares a
 * REFERENCES constraint against it.
 *
 * Column mapping from user-provided schemas:
 *
 * tables_metadata:
 *   table_id       INT          → INTEGER PRIMARY KEY
 *   table_name     VARCHAR(100) → TEXT NOT NULL
 *   row_count      BIGINT       → INTEGER
 *   last_modified  DATE         → TEXT
 *
 * query_execution_stats:
 *   query_id              INT    → INTEGER PRIMARY KEY
 *   table_id              INT    → INTEGER REFERENCES tables_metadata(table_id)
 *   avg_execution_time_ms FLOAT  → REAL
 *   execution_count       INT    → INTEGER
 *   error_count           INT    → INTEGER
 *
 * table_dependencies:
 *   parent_table_id  INT          → INTEGER REFERENCES tables_metadata(table_id)
 *   dependent_object VARCHAR(100) → TEXT NOT NULL
 *   Composite PRIMARY KEY (parent_table_id, dependent_object)
 *
 * schema_changes:
 *   table_id    INT  → INTEGER REFERENCES tables_metadata(table_id)
 *   change_date DATE → TEXT NOT NULL
 *   Composite PRIMARY KEY (table_id, change_date)
 */
const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS tables_metadata (
    table_id INTEGER PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_count INTEGER,
    last_modified TEXT
  );

  CREATE TABLE IF NOT EXISTS query_execution_stats (
    query_id INTEGER PRIMARY KEY,
    table_id INTEGER REFERENCES tables_metadata(table_id),
    avg_execution_time_ms REAL,
    execution_count INTEGER,
    error_count INTEGER
  );

  CREATE TABLE IF NOT EXISTS table_dependencies (
    parent_table_id INTEGER REFERENCES tables_metadata(table_id),
    dependent_object TEXT NOT NULL,
    PRIMARY KEY (parent_table_id, dependent_object)
  );

  CREATE TABLE IF NOT EXISTS schema_changes (
    table_id INTEGER REFERENCES tables_metadata(table_id),
    change_date TEXT NOT NULL,
    PRIMARY KEY (table_id, change_date)
  );
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initializes the database schema by executing all four CREATE TABLE IF NOT
 * EXISTS statements against the active SQLite database connection.
 *
 * Prerequisites:
 *   - initializeDatabase() from src/db/connection.js MUST have been called
 *     before this function is invoked so that `connection.db` returns a valid
 *     better-sqlite3 Database instance.
 *
 * Execution order:
 *   1. tables_metadata         (no foreign key dependencies)
 *   2. query_execution_stats   (references tables_metadata)
 *   3. table_dependencies      (references tables_metadata)
 *   4. schema_changes          (references tables_metadata)
 *
 * The function is synchronous — better-sqlite3 provides a synchronous API,
 * so no async/await or callbacks are needed.
 *
 * The function is idempotent — CREATE TABLE IF NOT EXISTS ensures repeated
 * calls do not fail or duplicate tables.
 *
 * @returns {void}
 * @throws {Error} If the database connection is not initialized or if any
 *   DDL statement fails (e.g. disk full, permission denied).  Errors are
 *   allowed to propagate to the caller (server.js) for centralized handling.
 */
const initializeSchema = () => {
  const db = connection.db;

  if (!db) {
    throw new Error(
      'Database connection is not initialized. Call initializeDatabase() before initializeSchema().'
    );
  }

  db.exec(SCHEMA_DDL);
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { initializeSchema };
