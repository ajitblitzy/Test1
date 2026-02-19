/**
 * Table Dependencies Route Handler — HTTP Endpoints for `/api/table-dependencies`
 *
 * Implements HTTP endpoint handlers for the table_dependencies resource.
 * This table uses a **composite primary key** (parent_table_id, dependent_object),
 * so CRUD operations differ from single-integer PK tables:
 *   - No single-ID get-by-id endpoint
 *   - No PUT/update endpoint (model does not support updates)
 *   - DELETE uses query parameters for composite key identification
 *   - GET supports optional parent_table_id query parameter filtering
 *
 * Only THREE HTTP methods are supported: GET, POST, DELETE.
 *
 * This module follows the Repository pattern (AAP §0.4.3): the route handler
 * delegates all data access to model functions without any direct SQL knowledge.
 *
 * Endpoint summary:
 *   GET    /api/table-dependencies                                             — List all records (optionally filtered by parent_table_id)
 *   POST   /api/table-dependencies                                             — Create a new dependency record
 *   DELETE /api/table-dependencies?parent_table_id=X&dependent_object=Y        — Delete by composite key
 *
 * Called by: src/routes/index.js (central dispatcher) which passes (req, res, helpers)
 * Imports from: src/models/tableDependencies.js
 *
 * @module src/routes/tableDependencies
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports — ONLY from depends_on_files whitelist
// ---------------------------------------------------------------------------

/**
 * Data access module for the table_dependencies table providing composite-key
 * CRUD operations. Provides getAll(), getByParentId(), create(), and
 * deleteByParentAndObject() functions called by this route handler to execute
 * database operations without direct SQL, following the Repository pattern.
 *
 * @see src/models/tableDependencies.js
 */
const tableDependencies = require('../models/tableDependencies');

// ---------------------------------------------------------------------------
// Route Handler Function
// ---------------------------------------------------------------------------

/**
 * Main route handler for all `/api/table-dependencies` HTTP requests.
 *
 * Dispatched by src/routes/index.js. Receives the raw Node.js HTTP request
 * and response objects along with helper functions for JSON responses and
 * body parsing.
 *
 * Supports GET (list all / filter by parent_table_id), POST (create), and
 * DELETE (by composite key via query parameters). PUT and other methods
 * return a 400 "Method not allowed" response because the composite primary
 * key table does not support single-record updates.
 *
 * @param {import('http').IncomingMessage} req - The HTTP request object.
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * @param {Object} helpers - Utility functions provided by the central dispatcher.
 * @param {Function} helpers.sendJson - Sends a JSON response: sendJson(res, statusCode, data).
 * @param {Function} helpers.sendError - Sends a JSON error response: sendError(res, statusCode, message).
 * @param {Function} helpers.parseBody - Reads and parses the request body as JSON (returns Promise).
 */
const handleTableDependencies = (req, res, helpers) => {
  const { sendJson, sendError, parseBody } = helpers;
  const method = req.method;

  // Parse URL to separate pathname from query string for all methods
  const [pathname, queryString] = req.url.split('?');
  const params = new URLSearchParams(queryString || '');

  // -------------------------------------------------------------------------
  // GET — Retrieve records (all or filtered by parent_table_id)
  // -------------------------------------------------------------------------
  if (method === 'GET') {
    const parentIdParam = params.get('parent_table_id');

    if (parentIdParam !== null && parentIdParam !== undefined) {
      // GET /api/table-dependencies?parent_table_id=X — Filtered by parent
      const parentTableId = parseInt(parentIdParam, 10);
      if (isNaN(parentTableId)) {
        return sendError(res, 400, 'Invalid parent_table_id');
      }
      try {
        const records = tableDependencies.getByParentId(parentTableId);
        return sendJson(res, 200, records);
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    } else {
      // GET /api/table-dependencies — List all dependency records
      try {
        const records = tableDependencies.getAll();
        return sendJson(res, 200, records);
      } catch (err) {
        return sendError(res, 500, 'Internal Server Error');
      }
    }

  // -------------------------------------------------------------------------
  // POST — Create a new dependency record
  // -------------------------------------------------------------------------
  } else if (method === 'POST') {
    parseBody(req).then((data) => {
      // Validate required fields: both parts of the composite primary key
      if (data.parent_table_id === undefined || data.parent_table_id === null) {
        return sendError(res, 400, 'parent_table_id and dependent_object are required');
      }
      if (!data.dependent_object || (typeof data.dependent_object === 'string' && data.dependent_object.trim().length === 0)) {
        return sendError(res, 400, 'parent_table_id and dependent_object are required');
      }
      try {
        const result = tableDependencies.create(data);
        // Return the created record data with 201 status (composite PK — no auto-generated ID)
        return sendJson(res, 201, {
          parent_table_id: data.parent_table_id,
          dependent_object: data.dependent_object,
        });
      } catch (err) {
        // Handle UNIQUE constraint violation (duplicate composite key)
        if (err.message && err.message.includes('UNIQUE constraint')) {
          return sendError(res, 400, 'Dependency already exists');
        }
        return sendError(res, 500, 'Internal Server Error');
      }
    }).catch(() => {
      sendError(res, 400, 'Invalid JSON in request body');
    });

  // -------------------------------------------------------------------------
  // DELETE — Remove a specific dependency record by composite key
  // -------------------------------------------------------------------------
  } else if (method === 'DELETE') {
    // Composite PK deletion uses query parameters:
    // DELETE /api/table-dependencies?parent_table_id=5&dependent_object=some_view
    const parentIdParam = params.get('parent_table_id');
    const dependentObjectParam = params.get('dependent_object');

    // Validate both parameters are present
    if (parentIdParam === null || parentIdParam === undefined ||
        dependentObjectParam === null || dependentObjectParam === undefined ||
        dependentObjectParam.trim().length === 0) {
      return sendError(res, 400, 'parent_table_id and dependent_object are required');
    }

    // Parse and validate parent_table_id as integer
    const parentTableId = parseInt(parentIdParam, 10);
    if (isNaN(parentTableId)) {
      return sendError(res, 400, 'Invalid parent_table_id');
    }

    try {
      const result = tableDependencies.deleteByParentAndObject(parentTableId, dependentObjectParam);
      // Check if any record was actually deleted
      if (result.changes === 0) {
        return sendError(res, 404, 'Record not found');
      }
      return sendJson(res, 200, { message: 'Record deleted successfully' });
    } catch (err) {
      return sendError(res, 500, 'Internal Server Error');
    }

  // -------------------------------------------------------------------------
  // Unsupported method (PUT and all others)
  // -------------------------------------------------------------------------
  } else {
    return sendError(res, 400, 'Method not allowed');
  }
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = handleTableDependencies;
