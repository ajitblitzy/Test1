/**
 * Schema Changes Route Handler
 *
 * HTTP endpoint handlers for the `/api/schema-changes` resource. Implements
 * GET (with optional table_id and date range filters), POST, and DELETE
 * operations against the schema_changes table via the schemaChanges model.
 *
 * The schema_changes table uses a COMPOSITE primary key on (table_id,
 * change_date), so operations differ from standard integer PK tables:
 *   - No getById endpoint (no single-integer ID lookup)
 *   - No PUT/update endpoint (model does not export update)
 *   - DELETE uses query parameters for both composite key columns
 *   - GET supports filtering by table_id OR by date range
 *
 * Supported endpoints:
 *   GET    /api/schema-changes                              — List all records
 *   GET    /api/schema-changes?table_id=X                   — Filter by table
 *   GET    /api/schema-changes?start_date=X&end_date=Y      — Filter by range
 *   POST   /api/schema-changes                              — Create record
 *   DELETE /api/schema-changes?table_id=X&change_date=Y     — Delete by PK
 *
 * Called by: src/routes/index.js (central dispatcher)
 * Depends on: src/models/schemaChanges.js (data access layer)
 *
 * @module src/routes/schemaChanges
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports
// ---------------------------------------------------------------------------

/**
 * Data access module for the schema_changes table providing CRUD operations
 * with composite primary key (table_id, change_date).
 *
 * Exports:
 *   getAll()                            — Retrieve all schema change records
 *   getByTableId(tableId)               — Filter records by table_id
 *   getByDateRange(startDate, endDate)  — Filter records by ISO 8601 range
 *   create(data)                        — Insert a new record
 *   deleteByTableAndDate(tableId, date) — Delete by composite PK
 */
const schemaChanges = require('../models/schemaChanges');

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handle HTTP requests for the `/api/schema-changes` resource.
 *
 * Dispatches to the appropriate operation based on `req.method`:
 *   GET    — Retrieve records (all, by table_id, or by date range)
 *   POST   — Create a new schema change record
 *   DELETE  — Remove a record by composite primary key
 *
 * @param {import('http').IncomingMessage} req  - The incoming HTTP request.
 * @param {import('http').ServerResponse}  res  - The server response object.
 * @param {Object} helpers - Utility functions provided by the dispatcher.
 * @param {Function} helpers.sendJson   - Send a JSON response: (res, status, data).
 * @param {Function} helpers.sendError  - Send a JSON error: (res, status, message).
 * @param {Function} helpers.parseBody  - Parse JSON request body: (req) => Promise.
 */
const handleSchemaChanges = (req, res, helpers) => {
  const { sendJson, sendError, parseBody } = helpers;

  // Parse URL to separate pathname from query string
  const [pathname, queryString] = req.url.split('?');
  const params = new URLSearchParams(queryString || '');

  // -----------------------------------------------------------------------
  // GET /api/schema-changes — List records with optional filters
  // -----------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      // Priority order: table_id filter > date range filter > all records
      const tableIdParam = params.get('table_id');
      const startDate = params.get('start_date');
      const endDate = params.get('end_date');

      let records;

      // Mode A: Filter by table_id (highest priority)
      if (tableIdParam !== null && tableIdParam !== undefined) {
        const tableId = parseInt(tableIdParam, 10);
        if (isNaN(tableId)) {
          sendError(res, 400, 'Invalid table_id');
          return;
        }
        records = schemaChanges.getByTableId(tableId);

      // Mode B: Filter by date range (both start_date and end_date required)
      } else if (startDate && endDate) {
        records = schemaChanges.getByDateRange(startDate, endDate);

      // Mode C: No filters — return all records
      } else {
        records = schemaChanges.getAll();
      }

      sendJson(res, 200, records);
    } catch (err) {
      sendError(res, 500, 'Internal Server Error');
    }
    return;
  }

  // -----------------------------------------------------------------------
  // POST /api/schema-changes — Create a new schema change record
  // -----------------------------------------------------------------------
  if (req.method === 'POST') {
    parseBody(req)
      .then((data) => {
        try {
          // Validate required fields — both form the composite PK
          if (data.table_id === undefined || data.table_id === null ||
              data.change_date === undefined || data.change_date === null ||
              data.change_date === '') {
            sendError(res, 400, 'table_id and change_date are required');
            return;
          }

          const result = schemaChanges.create(data);
          sendJson(res, 201, data);
        } catch (err) {
          // Handle UNIQUE constraint violation (duplicate composite key)
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            sendError(res, 400, 'Schema change record already exists');
          } else {
            sendError(res, 500, 'Internal Server Error');
          }
        }
      })
      .catch((err) => {
        sendError(res, 400, 'Invalid JSON in request body');
      });
    return;
  }

  // -----------------------------------------------------------------------
  // DELETE /api/schema-changes?table_id=X&change_date=YYYY-MM-DD
  // -----------------------------------------------------------------------
  if (req.method === 'DELETE') {
    try {
      const tableIdParam = params.get('table_id');
      const changeDate = params.get('change_date');

      // Validate both composite key parameters are present
      if (tableIdParam === null || tableIdParam === undefined ||
          changeDate === null || changeDate === undefined || changeDate === '') {
        sendError(res, 400, 'table_id and change_date are required');
        return;
      }

      const tableId = parseInt(tableIdParam, 10);
      if (isNaN(tableId)) {
        sendError(res, 400, 'Invalid table_id');
        return;
      }

      const result = schemaChanges.deleteByTableAndDate(tableId, changeDate);

      if (result.changes === 0) {
        sendError(res, 404, 'Record not found');
        return;
      }

      sendJson(res, 200, { message: 'Record deleted successfully' });
    } catch (err) {
      sendError(res, 500, 'Internal Server Error');
    }
    return;
  }

  // -----------------------------------------------------------------------
  // Method Not Allowed — PUT and any other unrecognized methods
  // -----------------------------------------------------------------------
  sendError(res, 400, 'Method not allowed');
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = handleSchemaChanges;
