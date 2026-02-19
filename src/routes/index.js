/**
 * Central Route Dispatcher — Request Router for the Database Metadata Service
 *
 * Replaces the original monolithic universal handler from server.js (which
 * returned "Hello, World!" for every request) with a URL-prefix-based
 * routing dispatcher that delegates to table-specific route handler modules.
 *
 * Routing table:
 *   /api/tables-metadata        → tablesMetadataRoutes
 *   /api/query-execution-stats  → queryExecutionStatsRoutes
 *   /api/table-dependencies     → tableDependenciesRoutes
 *   /api/schema-changes         → schemaChangesRoutes
 *   (all other paths)           → 404 JSON response
 *
 * This module also provides three utility helper functions (parseBody,
 * sendJson, sendError) that are passed to each route handler as a
 * `helpers` parameter object, avoiding circular dependency issues.
 *
 * Consumed by: server.js via `const { handleRequest } = require('./src/routes');`
 *
 * @module src/routes/index
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal imports — Route handler modules from depends_on_files whitelist
// ---------------------------------------------------------------------------

/**
 * Route handler for /api/tables-metadata endpoints.
 * Signature: (req, res, helpers) => void
 * Handles GET (all/by-id), POST, PUT, DELETE for tables_metadata resource.
 * @see src/routes/tablesMetadata.js
 */
const tablesMetadataRoutes = require('./tablesMetadata');

/**
 * Route handler for /api/query-execution-stats endpoints.
 * Signature: (req, res, helpers) => void
 * Handles GET (all/by-id/by-table-id), POST, PUT, DELETE for query_execution_stats resource.
 * @see src/routes/queryExecutionStats.js
 */
const queryExecutionStatsRoutes = require('./queryExecutionStats');

/**
 * Route handler for /api/table-dependencies endpoints.
 * Signature: (req, res, helpers) => void
 * Handles GET (all/by-parent-id), POST, DELETE for table_dependencies resource.
 * @see src/routes/tableDependencies.js
 */
const tableDependenciesRoutes = require('./tableDependencies');

/**
 * Route handler for /api/schema-changes endpoints.
 * Signature: (req, res, helpers) => void
 * Handles GET (all/by-table-id/by-date-range), POST, DELETE for schema_changes resource.
 * @see src/routes/schemaChanges.js
 */
const schemaChangesRoutes = require('./schemaChanges');

// ---------------------------------------------------------------------------
// Helper: JSON Body Parser
// ---------------------------------------------------------------------------

/**
 * Reads and parses the incoming HTTP request body as JSON.
 *
 * Collects streaming request data chunks, concatenates them into a single
 * string, and attempts JSON.parse(). Empty bodies resolve to an empty object
 * `{}` to support requests with no payload (e.g., DELETE with query params).
 * Invalid JSON causes the returned Promise to reject, which callers should
 * handle by returning a 400 "Invalid JSON" error response.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request.
 * @returns {Promise<Object>} Resolves with the parsed JSON object, or rejects
 *   with a SyntaxError if the body contains invalid JSON.
 */
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
};

// ---------------------------------------------------------------------------
// Helper: JSON Response Sender
// ---------------------------------------------------------------------------

/**
 * Sends a JSON-formatted HTTP response with the specified status code and data.
 *
 * Sets the `Content-Type` header to `application/json` (AAP §0.7.1) and
 * serializes the data payload via JSON.stringify(). This is the single
 * response mechanism for all API endpoints, ensuring consistent formatting.
 *
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * @param {number} statusCode - The HTTP status code (200, 201, 400, 404, 500).
 * @param {*} data - The response payload to serialize as JSON.
 */
const sendJson = (res, statusCode, data) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

// ---------------------------------------------------------------------------
// Helper: JSON Error Response Sender
// ---------------------------------------------------------------------------

/**
 * Sends a JSON error response with a standardized `{ error: message }` format.
 *
 * Wraps `sendJson` to ensure every error response conforms to the AAP §0.7.1
 * requirement that "Error responses must include an `error` field with a
 * descriptive message."
 *
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * @param {number} statusCode - The HTTP error status code (400, 404, 500).
 * @param {string} message - A human-readable error description.
 */
const sendError = (res, statusCode, message) => {
  sendJson(res, statusCode, { error: message });
};

// ---------------------------------------------------------------------------
// Main Dispatcher: handleRequest
// ---------------------------------------------------------------------------

/**
 * Central HTTP request dispatcher for the database metadata service.
 *
 * Parses `req.url` and delegates to the appropriate table-specific route
 * handler module based on URL prefix matching (AAP §0.4.3 Dispatcher pattern).
 * Each matched route handler receives the request, response, and a helpers
 * object containing `sendJson`, `sendError`, and `parseBody` utilities.
 *
 * URL prefix matching order:
 *   1. `/api/tables-metadata`        → tablesMetadataRoutes
 *   2. `/api/query-execution-stats`  → queryExecutionStatsRoutes
 *   3. `/api/table-dependencies`     → tableDependenciesRoutes
 *   4. `/api/schema-changes`         → schemaChangesRoutes
 *   5. (no match)                    → 404 JSON error
 *
 * The entire dispatch is wrapped in a try/catch to ensure that any unexpected
 * synchronous error within the routing logic returns a 500 JSON error rather
 * than crashing the server process.
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request.
 * @param {import('http').ServerResponse} res - The HTTP response object.
 */
const handleRequest = (req, res) => {
  // Helpers object passed to each route handler to avoid circular dependencies
  const helpers = { sendJson, sendError, parseBody };

  try {
    // URL prefix matching — delegate to the first matching route handler
    if (req.url.startsWith('/api/tables-metadata')) {
      tablesMetadataRoutes(req, res, helpers);
    } else if (req.url.startsWith('/api/query-execution-stats')) {
      queryExecutionStatsRoutes(req, res, helpers);
    } else if (req.url.startsWith('/api/table-dependencies')) {
      tableDependenciesRoutes(req, res, helpers);
    } else if (req.url.startsWith('/api/schema-changes')) {
      schemaChangesRoutes(req, res, helpers);
    } else {
      // No matching route prefix — return 404 (AAP §0.5.1)
      sendError(res, 404, 'Not Found');
    }
  } catch (err) {
    // Catch-all for unexpected synchronous errors — return 500 (AAP §0.7.1)
    sendError(res, 500, 'Internal Server Error');
  }
};

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { handleRequest };
