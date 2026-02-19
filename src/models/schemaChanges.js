/**
 * Schema Changes Model
 *
 * Data access module implementing the Repository pattern for the schema_changes
 * table.  Encapsulates all SQL operations for schema change history tracking
 * using better-sqlite3 prepared statements with parameterized queries.
 *
 * The schema_changes table uses a COMPOSITE primary key on (table_id, change_date):
 *   - Records are uniquely identified by the combination of both columns
 *   - table_id is a foreign key referencing tables_metadata(table_id)
 *   - change_date is stored as TEXT in ISO 8601 format (YYYY-MM-DD)
 *
 * Table Schema:
 *   schema_changes (
 *     table_id    INTEGER REFERENCES tables_metadata(table_id),
 *     change_date TEXT NOT NULL,
 *     PRIMARY KEY (table_id, change_date)
 *   )
 *
 * Exported functions:
 *   getAll()                              — Retrieve all schema change records
 *   getByTableId(tableId)                 — Filter by table_id foreign key
 *   getByDateRange(startDate, endDate)    — Filter by ISO 8601 date range
 *   create(data)                          — Insert a new record (both PK columns required)
 *   deleteByTableAndDate(tableId, date)   — Delete by composite PK
 *
 * Consumed by: src/routes/schemaChanges.js
 *
 * @module src/models/schemaChanges
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
 * always receive the current (initialized) instance.  We store a reference to
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
 * Retrieve all schema change records from the schema_changes table.
 *
 * @returns {Array<Object>} Array of all schema change records.  Each object
 *   contains { table_id: number, change_date: string }.  Returns an empty
 *   array when no records exist.
 * @throws {Error} If the database query fails (propagated to the route layer
 *   for HTTP error response generation).
 */
const getAll = () => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM schema_changes');
    return stmt.all();
  } catch (err) {
    throw err;
  }
};

/**
 * Retrieve all schema change records associated with a specific table.
 *
 * @param {number} tableId - The table_id to filter by.  Must correspond to a
 *   valid tables_metadata.table_id value.
 * @returns {Array<Object>} Array of matching schema change records.  Returns
 *   an empty array when no records match the given tableId.
 * @throws {Error} If the database query fails.
 */
const getByTableId = (tableId) => {
  try {
    const stmt = connection.db.prepare('SELECT * FROM schema_changes WHERE table_id = ?');
    return stmt.all(tableId);
  } catch (err) {
    throw err;
  }
};

/**
 * Retrieve schema change records within an inclusive date range.
 *
 * Leverages the fact that ISO 8601 date strings (YYYY-MM-DD) sort
 * lexicographically, making TEXT comparisons with >= and <= correct for
 * date range filtering in SQLite without requiring a native DATE type.
 *
 * @param {string} startDate - Inclusive start of the range in ISO 8601 format
 *   (YYYY-MM-DD).
 * @param {string} endDate - Inclusive end of the range in ISO 8601 format
 *   (YYYY-MM-DD).
 * @returns {Array<Object>} Array of schema change records whose change_date
 *   falls within [startDate, endDate].  Returns an empty array when no
 *   records match.
 * @throws {Error} If the database query fails.
 */
const getByDateRange = (startDate, endDate) => {
  try {
    const stmt = connection.db.prepare(
      'SELECT * FROM schema_changes WHERE change_date >= ? AND change_date <= ?'
    );
    return stmt.all(startDate, endDate);
  } catch (err) {
    throw err;
  }
};

/**
 * Insert a new schema change record.
 *
 * Both table_id and change_date are mandatory because they form the composite
 * primary key.  Attempting to insert a duplicate (table_id, change_date)
 * combination will throw a UNIQUE constraint violation error.
 *
 * @param {Object} data - The schema change data to insert.
 * @param {number} data.table_id - Foreign key referencing
 *   tables_metadata.table_id.  Must reference an existing table_id when
 *   foreign key enforcement is enabled.
 * @param {string} data.change_date - The date of the schema change in
 *   ISO 8601 format (YYYY-MM-DD).
 * @returns {Object} The better-sqlite3 run result: { changes: 1 } on success.
 * @throws {Error} If the insert fails — common causes include UNIQUE
 *   constraint violation (duplicate composite key) or FOREIGN KEY constraint
 *   violation (invalid table_id).
 */
const create = (data) => {
  try {
    const stmt = connection.db.prepare(
      'INSERT INTO schema_changes (table_id, change_date) VALUES (?, ?)'
    );
    return stmt.run(data.table_id, data.change_date);
  } catch (err) {
    throw err;
  }
};

/**
 * Delete a specific schema change record identified by its composite primary
 * key (table_id, change_date).
 *
 * @param {number} tableId - The table_id component of the composite key.
 * @param {string} changeDate - The change_date component of the composite key
 *   in ISO 8601 format (YYYY-MM-DD).
 * @returns {Object} The better-sqlite3 run result: { changes: 1 } when a
 *   record was deleted, or { changes: 0 } when no matching record exists.
 * @throws {Error} If the delete operation encounters a database error.
 */
const deleteByTableAndDate = (tableId, changeDate) => {
  try {
    const stmt = connection.db.prepare(
      'DELETE FROM schema_changes WHERE table_id = ? AND change_date = ?'
    );
    return stmt.run(tableId, changeDate);
  } catch (err) {
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  getAll,
  getByTableId,
  getByDateRange,
  create,
  deleteByTableAndDate,
};
