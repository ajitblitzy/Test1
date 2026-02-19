/**
 * Tables Metadata Model — CRUD Operations for `tables_metadata` Table
 *
 * Implements the Repository pattern for the `tables_metadata` table, which is
 * the foundational table in the database metadata monitoring service. All other
 * tables (`query_execution_stats`, `table_dependencies`, `schema_changes`)
 * reference `tables_metadata.table_id` via foreign keys.
 *
 * Exposes five CRUD functions via better-sqlite3 prepared statements:
 *   - getAll()          — Retrieve all table metadata records
 *   - getById(id)       — Retrieve a single record by table_id
 *   - create(data)      — Insert a new table metadata record
 *   - update(id, data)  — Update an existing record by table_id
 *   - deleteById(id)    — Delete a record by table_id
 *
 * All SQL operations use parameterized queries (`.prepare()` with `?`
 * placeholders) to prevent SQL injection. All database calls are wrapped
 * in try/catch blocks to propagate errors to the route layer for proper
 * HTTP error response handling.
 *
 * Table schema:
 *   table_id       INTEGER PRIMARY KEY  (auto-increment via SQLite rowid alias)
 *   table_name     TEXT NOT NULL         (translated from VARCHAR(100))
 *   row_count      INTEGER              (translated from BIGINT)
 *   last_modified  TEXT                 (stored as ISO 8601 'YYYY-MM-DD')
 *
 * Consumed by: src/routes/tablesMetadata.js
 * Depends on:  src/db/connection.js (the `db` singleton instance)
 *
 * @module src/models/tablesMetadata
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports
// ---------------------------------------------------------------------------

/**
 * Database connection module providing the singleton better-sqlite3 Database
 * instance via a getter property.
 *
 * IMPORTANT: The connection module exports `db` as a getter so that consumers
 * always receive the current (initialized) instance. We store a reference to
 * the module object and access `.db` inside each function at call time, rather
 * than destructuring at module load time (which would capture `null` before
 * initializeDatabase() has been called by server.js).
 *
 * @see src/db/connection.js
 */
const connection = require('../db/connection');

// ---------------------------------------------------------------------------
// CRUD Functions
// ---------------------------------------------------------------------------

/**
 * Retrieve all table metadata records.
 *
 * Executes: SELECT * FROM tables_metadata
 *
 * @returns {Array<Object>} Array of row objects. Each object contains
 *   { table_id, table_name, row_count, last_modified }. Returns an empty
 *   array if no records exist.
 * @throws {Error} If the database query fails (e.g. table does not exist,
 *   connection not initialized).
 */
const getAll = () => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM tables_metadata');
    return stmt.all();
  } catch (err) {
    throw err;
  }
};

/**
 * Retrieve a single table metadata record by its table_id.
 *
 * Executes: SELECT * FROM tables_metadata WHERE table_id = ?
 *
 * @param {number} id - The table_id of the record to retrieve.
 * @returns {Object|undefined} A single row object containing
 *   { table_id, table_name, row_count, last_modified }, or `undefined`
 *   if no record matches the given id.
 * @throws {Error} If the database query fails.
 */
const getById = (id) => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM tables_metadata WHERE table_id = ?');
    return stmt.get(id);
  } catch (err) {
    throw err;
  }
};

/**
 * Insert a new table metadata record.
 *
 * Executes: INSERT INTO tables_metadata (table_name, row_count, last_modified) VALUES (?, ?, ?)
 *
 * The table_id column is an INTEGER PRIMARY KEY (SQLite rowid alias) and
 * auto-increments automatically — it is NOT included in the INSERT statement.
 *
 * @param {Object} data - The record data to insert.
 * @param {string} data.table_name - Name of the database table (required, NOT NULL).
 * @param {number|null} data.row_count - Number of rows in the table.
 * @param {string|null} data.last_modified - Last modification date as ISO 8601 string (YYYY-MM-DD).
 * @returns {Object} An object containing the auto-generated id and the input data:
 *   { id: <lastInsertRowid>, table_name, row_count, last_modified }.
 * @throws {Error} If the insert fails (e.g. NOT NULL constraint violation on table_name,
 *   or database connection is not initialized).
 */
const create = (data) => {
  try {
    const stmt = connection.db.prepare(
      'INSERT INTO tables_metadata (table_name, row_count, last_modified) VALUES (?, ?, ?)'
    );
    const info = stmt.run(data.table_name, data.row_count, data.last_modified);
    return { id: info.lastInsertRowid, ...data };
  } catch (err) {
    throw err;
  }
};

/**
 * Update an existing table metadata record by its table_id.
 *
 * Executes: UPDATE tables_metadata SET table_name = ?, row_count = ?, last_modified = ? WHERE table_id = ?
 *
 * @param {number} id - The table_id of the record to update.
 * @param {Object} data - The updated record data.
 * @param {string} data.table_name - Updated table name.
 * @param {number|null} data.row_count - Updated row count.
 * @param {string|null} data.last_modified - Updated last modification date (YYYY-MM-DD).
 * @returns {Object} The better-sqlite3 run result: { changes: <number> }.
 *   `changes` is 1 if a matching record was found and updated, 0 if no
 *   record matched the given id.
 * @throws {Error} If the update fails (e.g. constraint violation, connection not initialized).
 */
const update = (id, data) => {
  try {
    const stmt = connection.db.prepare(
      'UPDATE tables_metadata SET table_name = ?, row_count = ?, last_modified = ? WHERE table_id = ?'
    );
    return stmt.run(data.table_name, data.row_count, data.last_modified, id);
  } catch (err) {
    throw err;
  }
};

/**
 * Delete a table metadata record by its table_id.
 *
 * Executes: DELETE FROM tables_metadata WHERE table_id = ?
 *
 * NOTE: Because tables_metadata is the foundational table referenced by
 * foreign keys in query_execution_stats, table_dependencies, and
 * schema_changes, deletion may fail with a FOREIGN KEY constraint error
 * if dependent records exist in those tables (SQLite default ON DELETE
 * behavior is RESTRICT when foreign keys are enabled).
 *
 * @param {number} id - The table_id of the record to delete.
 * @returns {Object} The better-sqlite3 run result: { changes: <number> }.
 *   `changes` is 1 if a matching record was found and deleted, 0 if no
 *   record matched the given id.
 * @throws {Error} If the deletion fails (e.g. foreign key constraint violation,
 *   connection not initialized).
 */
const deleteById = (id) => {
  try {
    const stmt = connection.db.prepare('DELETE FROM tables_metadata WHERE table_id = ?');
    return stmt.run(id);
  } catch (err) {
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { getAll, getById, create, update, deleteById };
