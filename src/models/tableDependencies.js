/**
 * Table Dependencies Data Access Model
 *
 * Implements the Repository pattern for the `table_dependencies` table,
 * encapsulating all SQL operations for table dependency relationships.
 * This table uses a composite primary key on (parent_table_id, dependent_object)
 * rather than a single auto-increment integer PK.
 *
 * All database interactions use better-sqlite3 prepared statements with
 * parameterized queries to prevent SQL injection and ensure performance.
 *
 * Exported functions:
 *   - getAll()                                    — retrieve all dependency records
 *   - getByParentId(parentTableId)                — retrieve dependencies for a specific parent table
 *   - create(data)                                — insert a new dependency record
 *   - deleteByParentAndObject(parentTableId, obj) — delete a specific dependency by composite key
 *
 * Table schema reference:
 *   table_dependencies (
 *     parent_table_id INTEGER REFERENCES tables_metadata(table_id),
 *     dependent_object TEXT NOT NULL,
 *     PRIMARY KEY (parent_table_id, dependent_object)
 *   )
 *
 * @module src/models/tableDependencies
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
// Data access functions
// ---------------------------------------------------------------------------

/**
 * Retrieves all records from the table_dependencies table.
 *
 * Executes: SELECT * FROM table_dependencies
 *
 * @returns {Array<Object>} An array of all table dependency records, each
 *   containing { parent_table_id, dependent_object }. Returns an empty
 *   array if the table is empty.
 * @throws {Error} If the database query fails (e.g. database not initialized,
 *   table does not exist, or connection is closed).
 */
const getAll = () => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM table_dependencies');
    return stmt.all();
  } catch (err) {
    throw new Error(`Failed to retrieve all table dependencies: ${err.message}`);
  }
};

/**
 * Retrieves all dependency records for a specific parent table.
 *
 * Executes: SELECT * FROM table_dependencies WHERE parent_table_id = ?
 *
 * @param {number} parentTableId - The table_id of the parent table to filter by.
 *   Must correspond to a valid table_id in the tables_metadata table.
 * @returns {Array<Object>} An array of dependency records matching the given
 *   parent_table_id, each containing { parent_table_id, dependent_object }.
 *   Returns an empty array if no dependencies exist for the given parent.
 * @throws {Error} If the database query fails.
 */
const getByParentId = (parentTableId) => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM table_dependencies WHERE parent_table_id = ?');
    return stmt.all(parentTableId);
  } catch (err) {
    throw new Error(`Failed to retrieve dependencies for parent_table_id ${parentTableId}: ${err.message}`);
  }
};

/**
 * Inserts a new record into the table_dependencies table.
 *
 * Executes: INSERT INTO table_dependencies (parent_table_id, dependent_object) VALUES (?, ?)
 *
 * Both parent_table_id and dependent_object are required because they form
 * the composite primary key. Attempting to insert a duplicate combination
 * will result in a UNIQUE constraint violation error.
 *
 * @param {Object} data - The dependency record to insert.
 * @param {number} data.parent_table_id - The table_id of the parent table.
 *   Must reference a valid table_id in the tables_metadata table (enforced
 *   by foreign key constraint when PRAGMA foreign_keys = ON).
 * @param {string} data.dependent_object - The name or identifier of the
 *   dependent object (e.g. view name, stored procedure, or child table).
 * @returns {Object} The result of the INSERT operation from better-sqlite3,
 *   containing { changes: 1 } on success.
 * @throws {Error} If the insert fails due to a UNIQUE constraint violation
 *   (duplicate composite key), a foreign key constraint violation (invalid
 *   parent_table_id), or any other database error.
 */
const create = (data) => {
  try {
    const stmt = connection.db.prepare(
      'INSERT INTO table_dependencies (parent_table_id, dependent_object) VALUES (?, ?)'
    );
    return stmt.run(data.parent_table_id, data.dependent_object);
  } catch (err) {
    throw new Error(`Failed to create table dependency: ${err.message}`);
  }
};

/**
 * Deletes a specific dependency record identified by its composite primary key.
 *
 * Executes: DELETE FROM table_dependencies WHERE parent_table_id = ? AND dependent_object = ?
 *
 * Both parameters are required to uniquely identify a single record in the
 * table, as the primary key is the combination of (parent_table_id, dependent_object).
 *
 * @param {number} parentTableId - The table_id of the parent table.
 * @param {string} dependentObject - The name or identifier of the dependent object.
 * @returns {Object} The result of the DELETE operation from better-sqlite3,
 *   containing { changes: 1 } if a matching record was found and deleted,
 *   or { changes: 0 } if no record matched the given composite key.
 * @throws {Error} If the database delete operation fails.
 */
const deleteByParentAndObject = (parentTableId, dependentObject) => {
  try {
    const stmt = connection.db.prepare(
      'DELETE FROM table_dependencies WHERE parent_table_id = ? AND dependent_object = ?'
    );
    return stmt.run(parentTableId, dependentObject);
  } catch (err) {
    throw new Error(`Failed to delete table dependency (parent_table_id: ${parentTableId}, dependent_object: ${dependentObject}): ${err.message}`);
  }
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  getAll,
  getByParentId,
  create,
  deleteByParentAndObject,
};
