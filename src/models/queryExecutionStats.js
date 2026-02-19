/**
 * Query Execution Stats Model
 *
 * Data access module implementing the Repository pattern for the
 * query_execution_stats table. Encapsulates all SQL operations for
 * query execution statistics records, exposing clean CRUD functions
 * via better-sqlite3 prepared statements.
 *
 * Table schema:
 *   query_execution_stats (
 *     query_id INTEGER PRIMARY KEY,
 *     table_id INTEGER REFERENCES tables_metadata(table_id),
 *     avg_execution_time_ms REAL,
 *     execution_count INTEGER,
 *     error_count INTEGER
 *   )
 *
 * Consumed by: src/routes/queryExecutionStats.js
 *
 * @module src/models/queryExecutionStats
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports
// ---------------------------------------------------------------------------

/**
 * Database connection module providing the singleton better-sqlite3
 * Database instance. Stored as a module reference so that the `db`
 * getter is invoked at function-call time (after initializeDatabase()
 * has been called by server.js) rather than at module-load time when
 * the internal db variable is still null.
 *
 * @see src/db/connection.js
 */
const connection = require('../db/connection');

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Retrieves all records from the query_execution_stats table.
 *
 * Executes: SELECT * FROM query_execution_stats
 *
 * @returns {Array<Object>} Array of all query execution stats records.
 *   Each object contains: query_id, table_id, avg_execution_time_ms,
 *   execution_count, error_count.
 * @throws {Error} If the database query fails.
 */
const getAll = () => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM query_execution_stats');
    return stmt.all();
  } catch (error) {
    throw new Error(`Failed to retrieve all query execution stats: ${error.message}`);
  }
};

/**
 * Retrieves a single query execution stats record by its query_id.
 *
 * Executes: SELECT * FROM query_execution_stats WHERE query_id = ?
 *
 * @param {number} id - The query_id of the record to retrieve.
 * @returns {Object|undefined} The matching record object, or undefined
 *   if no record exists with the given query_id.
 * @throws {Error} If the database query fails.
 */
const getById = (id) => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM query_execution_stats WHERE query_id = ?');
    return stmt.get(id);
  } catch (error) {
    throw new Error(`Failed to retrieve query execution stat with id ${id}: ${error.message}`);
  }
};

/**
 * Retrieves all query execution stats records for a given table_id.
 * Filters by the table_id foreign key column that references
 * tables_metadata(table_id).
 *
 * This is a specialized query unique to this model, enabling lookup
 * of all query statistics associated with a specific monitored table.
 *
 * Executes: SELECT * FROM query_execution_stats WHERE table_id = ?
 *
 * @param {number} tableId - The table_id to filter by.
 * @returns {Array<Object>} Array of records matching the given table_id.
 *   Returns an empty array if no records match.
 * @throws {Error} If the database query fails.
 */
const getByTableId = (tableId) => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM query_execution_stats WHERE table_id = ?');
    return stmt.all(tableId);
  } catch (error) {
    throw new Error(`Failed to retrieve query execution stats for table_id ${tableId}: ${error.message}`);
  }
};

/**
 * Inserts a new record into the query_execution_stats table.
 *
 * The query_id column is omitted from the INSERT statement as it is an
 * INTEGER PRIMARY KEY that auto-increments in SQLite (rowid alias).
 *
 * Executes: INSERT INTO query_execution_stats
 *   (table_id, avg_execution_time_ms, execution_count, error_count)
 *   VALUES (?, ?, ?, ?)
 *
 * @param {Object} data - The record data to insert.
 * @param {number} data.table_id - Foreign key referencing tables_metadata(table_id).
 * @param {number} data.avg_execution_time_ms - Average execution time in milliseconds.
 * @param {number} data.execution_count - Total number of query executions.
 * @param {number} data.error_count - Total number of errors encountered during execution.
 * @returns {Object} Result object with { id, changes, lastInsertRowid }.
 *   id is the numeric query_id of the newly created record.
 * @throws {Error} If the database insert fails (e.g., foreign key constraint violation).
 */
const create = (data) => {
  try {
    const stmt = connection.db.prepare(
      'INSERT INTO query_execution_stats (table_id, avg_execution_time_ms, execution_count, error_count) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(
      data.table_id,
      data.avg_execution_time_ms,
      data.execution_count,
      data.error_count
    );
    return {
      id: Number(result.lastInsertRowid),
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  } catch (error) {
    throw new Error(`Failed to create query execution stat: ${error.message}`);
  }
};

/**
 * Updates an existing query execution stats record identified by query_id.
 *
 * All mutable columns are updated in a single prepared statement.
 * If no record matches the given id, the operation succeeds with
 * changes === 0.
 *
 * Executes: UPDATE query_execution_stats SET table_id = ?,
 *   avg_execution_time_ms = ?, execution_count = ?, error_count = ?
 *   WHERE query_id = ?
 *
 * @param {number} id - The query_id of the record to update.
 * @param {Object} data - The updated field values.
 * @param {number} data.table_id - Updated foreign key to tables_metadata.
 * @param {number} data.avg_execution_time_ms - Updated average execution time.
 * @param {number} data.execution_count - Updated execution count.
 * @param {number} data.error_count - Updated error count.
 * @returns {Object} Result object with { changes }. changes is 0 if no
 *   record matched the given query_id.
 * @throws {Error} If the database update fails.
 */
const update = (id, data) => {
  try {
    const stmt = connection.db.prepare(
      'UPDATE query_execution_stats SET table_id = ?, avg_execution_time_ms = ?, execution_count = ?, error_count = ? WHERE query_id = ?'
    );
    const result = stmt.run(
      data.table_id,
      data.avg_execution_time_ms,
      data.execution_count,
      data.error_count,
      id
    );
    return { changes: result.changes };
  } catch (error) {
    throw new Error(`Failed to update query execution stat with id ${id}: ${error.message}`);
  }
};

/**
 * Deletes a query execution stats record by query_id.
 *
 * If no record matches the given id, the operation succeeds with
 * changes === 0.
 *
 * Executes: DELETE FROM query_execution_stats WHERE query_id = ?
 *
 * @param {number} id - The query_id of the record to delete.
 * @returns {Object} Result object with { changes }. changes is 0 if no
 *   record matched the given query_id.
 * @throws {Error} If the database delete fails.
 */
const deleteById = (id) => {
  try {
    const stmt = connection.db.prepare('DELETE FROM query_execution_stats WHERE query_id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
  } catch (error) {
    throw new Error(`Failed to delete query execution stat with id ${id}: ${error.message}`);
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getAll,
  getById,
  getByTableId,
  create,
  update,
  deleteById
};
