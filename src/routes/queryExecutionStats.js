/**
 * Query Execution Stats Route Handler — HTTP Endpoints for `/api/query-execution-stats`
 *
 * Implements RESTful HTTP endpoint handlers for the query_execution_stats resource.
 * Parses HTTP method (GET, POST, PUT, DELETE) and URL path parameters, reads
 * JSON request bodies for write operations, calls the corresponding model
 * functions from `src/models/queryExecutionStats.js`, and returns JSON responses
 * with appropriate HTTP status codes.
 *
 * This module follows the Repository pattern (AAP §0.4.3): the route handler
 * delegates all data access to model functions without any direct SQL knowledge.
 *
 * In addition to standard CRUD, this resource supports a `table_id` query
 * parameter filter on the GET collection endpoint, enabling lookup of all
 * query statistics associated with a specific monitored table.
 *
 * Endpoint summary:
 *   GET    /api/query-execution-stats              — List all records (with optional ?table_id= filter)
 *   GET    /api/query-execution-stats/:id           — Retrieve a single record by query_id
 *   POST   /api/query-execution-stats               — Create a new query execution stats record
 *   PUT    /api/query-execution-stats/:id           — Update an existing record by query_id
 *   DELETE /api/query-execution-stats/:id           — Delete a record by query_id
 *
 * Called by: src/routes/index.js (central dispatcher) which passes (req, res, helpers)
 * Imports from: src/models/queryExecutionStats.js
 *
 * @module src/routes/queryExecutionStats
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports — ONLY from depends_on_files whitelist
// ---------------------------------------------------------------------------

/**
 * Data access module for the query_execution_stats table.
 * Provides getAll(), getById(), getByTableId(), create(), update(),
 * deleteById() functions using better-sqlite3 prepared statements.
 *
 * @see src/models/queryExecutionStats.js
 */
const queryExecutionStats = require('../models/queryExecutionStats');

// ---------------------------------------------------------------------------
// Helper: Extract resource ID from URL path
// ---------------------------------------------------------------------------

/**
 * Extracts the resource ID segment from a request URL path.
 *
 * For URLs like `/api/query-execution-stats/42`, returns `'42'`.
 * For URLs like `/api/query-execution-stats` or `/api/query-execution-stats/`, returns `undefined`.
 * Query strings are stripped before parsing to prevent interference.
 *
 * URL path structure: ['', 'api', 'query-execution-stats', ':id']
 *                       0     1            2                  3
 *
 * @param {string} url - The raw request URL (may include query string).
 * @returns {string|undefined} The ID segment string, or undefined if absent/empty.
 */
const extractId = (url) => {
  // Strip query string before parsing path segments
  const pathname = url.split('?')[0];
  const parts = pathname.split('/');
  // parts[3] is the ID segment: /api/query-execution-stats/:id
  const idSegment = parts[3];
  // Return undefined for absent or empty segments (e.g., trailing slash)
  return (idSegment && idSegment.length > 0) ? idSegment : undefined;
};

// ---------------------------------------------------------------------------
// Helper: Parse query parameters from URL
// ---------------------------------------------------------------------------

/**
 * Parses query parameters from the request URL and extracts the `table_id`
 * filter parameter if present.
 *
 * Supports URLs like:
 *   `/api/query-execution-stats?table_id=5`  → returns 5
 *   `/api/query-execution-stats`              → returns undefined
 *   `/api/query-execution-stats?table_id=abc` → returns NaN (caller validates)
 *
 * @param {string} url - The raw request URL (may include query string).
 * @returns {number|undefined} The parsed table_id integer, or undefined if not provided.
 */
const extractTableIdParam = (url) => {
  const [, queryString] = url.split('?');
  const params = new URLSearchParams(queryString || '');
  const tableIdParam = params.get('table_id');
  if (tableIdParam === null || tableIdParam === undefined) {
    return undefined;
  }
  return parseInt(tableIdParam, 10);
};

// ---------------------------------------------------------------------------
// Route Handler Function
// ---------------------------------------------------------------------------

/**
 * Main route handler for all `/api/query-execution-stats` HTTP requests.
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
const handleQueryExecutionStats = (req, res, helpers) => {
  const { sendJson, sendError, parseBody } = helpers;
  const method = req.method;
  const urlId = extractId(req.url);

  // -------------------------------------------------------------------------
  // GET — Retrieve records
  // -------------------------------------------------------------------------
  if (method === 'GET') {
    if (urlId) {
      // GET /api/query-execution-stats/:id — Retrieve a single record by ID
      const id = parseInt(urlId, 10);
      if (isNaN(id)) {
        return sendError(res, 400, 'Invalid ID');
      }
      try {
        const record = queryExecutionStats.getById(id);
        if (record === undefined) {
          return sendError(res, 404, 'Record not found');
        }
        return sendJson(res, 200, record);
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    } else {
      // GET /api/query-execution-stats — List all records
      // Check for optional ?table_id= filter query parameter
      const tableIdFilter = extractTableIdParam(req.url);
      if (tableIdFilter !== undefined) {
        // Validate the table_id query parameter is a valid integer
        if (isNaN(tableIdFilter)) {
          return sendError(res, 400, 'Invalid table_id parameter');
        }
        // Filtered query: return only records matching the given table_id
        try {
          const records = queryExecutionStats.getByTableId(tableIdFilter);
          return sendJson(res, 200, records);
        } catch (err) {
          return sendError(res, 500, 'Internal Server Error');
        }
      } else {
        // No filter: return all records
        try {
          const records = queryExecutionStats.getAll();
          return sendJson(res, 200, records);
        } catch (err) {
          return sendError(res, 500, 'Internal Server Error');
        }
      }
    }

  // -------------------------------------------------------------------------
  // POST — Create a new record
  // -------------------------------------------------------------------------
  } else if (method === 'POST') {
    parseBody(req).then((data) => {
      // Validate required fields: table_id and execution_count must be present
      if (data.table_id === undefined || data.table_id === null) {
        return sendError(res, 400, 'table_id is required');
      }
      if (data.execution_count === undefined || data.execution_count === null) {
        return sendError(res, 400, 'execution_count is required');
      }
      try {
        // Model create() auto-generates query_id PK via INTEGER PRIMARY KEY autoincrement
        // Returns { id: <number>, changes: <number>, lastInsertRowid: <BigInt> }
        const result = queryExecutionStats.create(data);
        return sendJson(res, 201, { id: result.id, ...data });
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
      // Validate required fields: table_id and execution_count must be present
      if (data.table_id === undefined || data.table_id === null) {
        return sendError(res, 400, 'table_id is required');
      }
      if (data.execution_count === undefined || data.execution_count === null) {
        return sendError(res, 400, 'execution_count is required');
      }
      try {
        // Model update() returns { changes: <number> }
        const result = queryExecutionStats.update(id, data);
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
      const result = queryExecutionStats.deleteById(id);
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

module.exports = handleQueryExecutionStats;
