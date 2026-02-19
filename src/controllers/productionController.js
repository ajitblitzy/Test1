'use strict';

/**
 * src/controllers/productionController.js — Production Handler Controller
 *
 * Serves the current production content at GET / and provides a health
 * check endpoint at GET /health.  This is the most critical backward-
 * compatibility module — it preserves the original Hello, World!\n response
 * as the default until a prototype is explicitly promoted through the full
 * staging-approval pipeline.
 *
 * This controller is READ-ONLY.  It never mutates the store.  The production
 * content is controlled entirely by the approval workflow pipeline via
 * POST /api/promote/:id in the approvalController module.
 *
 * Traceability:
 *   AAP §0.2.2  — New Source Files
 *   AAP §0.4.3  — API Route Registry (GET /, GET /health)
 *   AAP §0.5.1  — Group 4 Controllers
 *   AAP §0.7.1  — Backward Compatibility, Zero Dependencies, CommonJS
 *   AAP §0.7.2  — Integration Requirements
 *
 * @module src/controllers/productionController
 */

/* ---------------------------------------------------------------------------
 * Module Imports — CommonJS only (AAP §0.7.1)
 *
 * - store:          Singleton in-memory data store (getProduction)
 * - sendText:       Plain-text response helper (production content)
 * - sendJSON:       JSON response helper (health check)
 * - sendError:      Standardized error response helper (500 fallback)
 * - config:         Centralised config (defaultProductionContent)
 * --------------------------------------------------------------------------- */
const store = require('../models/requirementStore');
const { sendText, sendJSON, sendError } = require('../utils/responseHelper');
const config = require('../config');

/**
 * GET / — Serve the current production content.
 *
 * This is the endpoint that end-users visit.  It defaults to the original
 * Hello, World!\n response until a prototype is explicitly promoted to
 * production through the approval pipeline.
 *
 * Backward compatibility contract (AAP §0.7.1, §0.7.2):
 *   HTTP Status  : 200 OK
 *   Content-Type : text/plain
 *   Body         : Hello, World!\n   (default, identical to original server.js)
 *
 * When a prototype has been promoted:
 *   HTTP Status  : 200 OK
 *   Content-Type : text/plain
 *   Body         : <promoted prototype content>
 *
 * No authentication required (AAP §0.4.3).
 * No body parsing required (GET request).
 *
 * @param {import('http').IncomingMessage}  req - Node.js HTTP request object
 * @param {import('http').ServerResponse}   res - Node.js HTTP response object
 * @returns {void}
 */
function getProduction(req, res) {
  try {
    /* Retrieve the currently promoted production requirement (or null) */
    var production = store.getProduction();

    if (production && production.prototype) {
      /*
       * A prototype has been promoted through the full approval pipeline.
       * Serve the promoted prototype content.
       */
      sendText(res, 200, production.prototype);
    } else {
      /*
       * Default state — no prototype promoted yet.
       * Serve the original Hello, World!\n response.
       * config.defaultProductionContent === 'Hello, World!\n'
       * This produces a byte-for-byte identical response to the original
       * server.js handler (lines 7-9).
       */
      sendText(res, 200, config.defaultProductionContent);
    }
  } catch (err) {
    /* Unexpected internal error — return a 500 JSON error response */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * GET /health — Health check endpoint for monitoring and tooling.
 *
 * Returns a simple JSON status object indicating the server is operational
 * along with the current process uptime in seconds.
 *
 * Response:
 *   HTTP Status  : 200 OK
 *   Content-Type : application/json
 *   Body         : { "status": "ok", "uptime": <number> }
 *
 * No authentication required (AAP §0.4.3).
 * No body parsing required (GET request).
 *
 * @param {import('http').IncomingMessage}  req - Node.js HTTP request object
 * @param {import('http').ServerResponse}   res - Node.js HTTP response object
 * @returns {void}
 */
function getHealth(req, res) {
  try {
    sendJSON(res, 200, {
      status: 'ok',
      uptime: process.uptime()
    });
  } catch (err) {
    /* Unexpected internal error — return a 500 JSON error response */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/* ---------------------------------------------------------------------------
 * Module Exports — CommonJS pattern (AAP §0.7.1)
 *
 * Export contract consumed by the router:
 *   const productionController = require('./controllers/productionController');
 *   GET  /       → productionController.getProduction
 *   GET  /health → productionController.getHealth
 *
 * Function names MUST be exactly: getProduction, getHealth
 * --------------------------------------------------------------------------- */
module.exports = {
  getProduction: getProduction,
  getHealth: getHealth
};
