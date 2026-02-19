/**
 * Tables Metadata Route Handler — HTTP Endpoints for `/api/tables-metadata`
 *
 * Implements RESTful HTTP endpoint handlers for the tables_metadata resource.
 * Parses HTTP method (GET, POST, PUT, DELETE) and URL path parameters, reads
 * JSON request bodies for write operations, calls the corresponding model
 * functions from `src/models/tablesMetadata.js`, and returns JSON responses
 * with appropriate HTTP status codes.
 *
 * This module follows the Repository pattern (AAP §0.4.3): the route handler
 * delegates all data access to model functions without any direct SQL knowledge.
 *
 * Endpoint summary:
 *   GET    /api/tables-metadata        — List all table metadata records
 *   GET    /api/tables-metadata/:id    — Retrieve a single record by table_id
 *   POST   /api/tables-metadata        — Create a new table metadata record
 *   PUT    /api/tables-metadata/:id    — Update an existing record by table_id
 *   DELETE /api/tables-metadata/:id    — Delete a record by table_id
 *
 * Called by: src/routes/index.js (central dispatcher) which passes (req, res, helpers)
 * Imports from: src/models/tablesMetadata.js
 *
 * @module src/routes/tablesMetadata
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports — ONLY from depends_on_files whitelist
// ---------------------------------------------------------------------------

/**
 * Data access module for the tables_metadata table.
 * Provides getAll(), getById(), create(), update(), deleteById() functions
 * using better-sqlite3 prepared statements.
 *
 * @see src/models/tablesMetadata.js
 */
const tablesMetadata = require('../models/tablesMetadata');

// ---------------------------------------------------------------------------
// Helper: Extract resource ID from URL path
// ---------------------------------------------------------------------------

/**
 * Extracts the resource ID segment from a request URL path.
 *
 * For URLs like `/api/tables-metadata/123`, returns `'123'`.
 * For URLs like `/api/tables-metadata` or `/api/tables-metadata/`, returns `undefined`.
 * Query strings are stripped before parsing to prevent interference.
 *
 * URL path structure: ['', 'api', 'tables-metadata', ':id']
 *                       0     1          2              3
 *
 * @param {string} url - The raw request URL (may include query string).
 * @returns {string|undefined} The ID segment string, or undefined if absent/empty.
 */
const extractId = (url) => {
  // Strip query string before parsing path segments
  const pathname = url.split('?')[0];
  const parts = pathname.split('/');
  // parts[3] is the ID segment: /api/tables-metadata/:id
  const idSegment = parts[3];
  // Return undefined for absent or empty segments (e.g., trailing slash)
  return (idSegment && idSegment.length > 0) ? idSegment : undefined;
};

// ---------------------------------------------------------------------------
// Route Handler Function
// ---------------------------------------------------------------------------

/**
 * Main route handler for all `/api/tables-metadata` HTTP requests.
 *
 * Dispatched by src/routes/index.js. Receives the raw Node.js HTTP request
 * and response objects along with helper functions for JSON responses and
 * body parsing.
 *
 * @param {import('http').IncomingMessage} req - The HTTP request object.
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * @param {Object} helpers - Utility functions provided by the central dispatcher.
 * @param {Function} helpers.sendJson - Sends a JSON response: sendJson(res, statusCode, data).
 * @param {Function} helpers.sendError - Sends a JSON error response: sendError(res, statusCode, message).
 * @param {Function} helpers.parseBody - Reads and parses the request body as JSON (returns Promise).
 */
const handleTablesMetadata = (req, res, helpers) => {
  const { sendJson, sendError, parseBody } = helpers;
  const method = req.method;
  const urlId = extractId(req.url);

  // -------------------------------------------------------------------------
  // GET — Retrieve records
  // -------------------------------------------------------------------------
  if (method === 'GET') {
    if (urlId) {
      // GET /api/tables-metadata/:id — Retrieve a single record by ID
      const id = parseInt(urlId, 10);
      if (isNaN(id)) {
        return sendError(res, 400, 'Invalid ID');
      }
      try {
        const record = tablesMetadata.getById(id);
        if (record === undefined) {
          return sendError(res, 404, 'Record not found');
        }
        return sendJson(res, 200, record);
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    } else {
      // GET /api/tables-metadata — List all records
      try {
        const records = tablesMetadata.getAll();
        return sendJson(res, 200, records);
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    }

  // -------------------------------------------------------------------------
  // POST — Create a new record
  // -------------------------------------------------------------------------
  } else if (method === 'POST') {
    parseBody(req).then((data) => {
      // Validate required field: table_name must be present and non-empty
      if (!data.table_name || (typeof data.table_name === 'string' && data.table_name.trim().length === 0)) {
        return sendError(res, 400, 'table_name is required');
      }
      try {
        // Model create() returns { id: lastInsertRowid, ...data }
        const result = tablesMetadata.create(data);
        return sendJson(res, 201, result);
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    }).catch(() => {
      sendError(res, 400, 'Invalid JSON in request body');
    });

  // -------------------------------------------------------------------------
  // PUT — Update an existing record
  // -------------------------------------------------------------------------
  } else if (method === 'PUT') {
    // PUT requires an ID in the URL path
    if (!urlId) {
      return sendError(res, 400, 'ID is required for update');
    }
    const id = parseInt(urlId, 10);
    if (isNaN(id)) {
      return sendError(res, 400, 'Invalid ID');
    }
    parseBody(req).then((data) => {
      // Validate required field: table_name must be present and non-empty
      if (!data.table_name || (typeof data.table_name === 'string' && data.table_name.trim().length === 0)) {
        return sendError(res, 400, 'table_name is required');
      }
      try {
        // Model update() returns { changes: <number> }
        const result = tablesMetadata.update(id, data);
        if (result.changes === 0) {
          return sendError(res, 404, 'Record not found');
        }
        return sendJson(res, 200, { id, ...data });
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    }).catch(() => {
      sendError(res, 400, 'Invalid JSON in request body');
    });

  // -------------------------------------------------------------------------
  // DELETE — Remove a record
  // -------------------------------------------------------------------------
  } else if (method === 'DELETE') {
    // DELETE requires an ID in the URL path
    if (!urlId) {
      return sendError(res, 400, 'ID is required for delete');
    }
    const id = parseInt(urlId, 10);
    if (isNaN(id)) {
      return sendError(res, 400, 'Invalid ID');
    }
    try {
      // Model deleteById() returns { changes: <number> }
      const result = tablesMetadata.deleteById(id);
      if (result.changes === 0) {
        return sendError(res, 404, 'Record not found');
      }
      return sendJson(res, 200, { message: 'Record deleted successfully' });
    } catch (err) {
      return sendError(res, 500, 'Internal Server Error');
    }

  // -------------------------------------------------------------------------
  // Unsupported method
  // -------------------------------------------------------------------------
  } else {
    return sendError(res, 400, 'Method not allowed');
  }
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = handleTablesMetadata;
