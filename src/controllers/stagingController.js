'use strict';

/**
 * src/controllers/stagingController.js — Staging API Controller
 *
 * Provides the prototype review interface for the Staging-Approval Workflow.
 * Handles the staging-specific endpoints that allow reviewers to inspect and
 * evaluate prototypes before approval. These endpoints are publicly accessible
 * (no authentication required) so that reviewers can easily view staged prototypes.
 *
 * Endpoints handled:
 *   GET /staging      — List all requirements in 'staged' state (list)
 *   GET /staging/:id  — View a specific staged prototype for review (getById)
 *
 * This controller is READ-ONLY — it never mutates store state. It queries the
 * requirement store for staged prototypes and returns formatted responses.
 *
 * Traceability:
 *   AAP §0.2.2 (New Source Files)
 *   AAP §0.4.3 (API Route Registry)
 *   AAP §0.5.1 Group 4 (Controllers — Business Logic)
 *   AAP §0.7.1 (Feature-Specific Rules)
 *   AAP §0.1.2 ("Share the prototype for approval")
 *
 * @module src/controllers/stagingController
 */

/* -----------------------------------------------------------------------
 * Module Imports — CommonJS ONLY (AAP §0.7.1)
 *
 * Zero external dependencies — only local project modules.
 * No Node.js built-in modules needed directly in this controller.
 * No middleware imports needed — these endpoints require no body parsing
 * and no authentication (AAP §0.4.3).
 * ----------------------------------------------------------------------- */
const store = require('../models/requirementStore');
const { sendJSON, sendText, sendError } = require('../utils/responseHelper');

/* -----------------------------------------------------------------------
 * Handler Functions
 * ----------------------------------------------------------------------- */

/**
 * GET /staging — List all staged prototypes available for review.
 *
 * Retrieves every requirement currently in the 'staged' lifecycle state
 * from the in-memory store and returns them as a JSON array. When no
 * requirements are staged, returns an empty array [].
 *
 * This endpoint is intentionally unauthenticated to allow easy access
 * by any reviewer. The security gate is at the approval/promote stage,
 * not at the review stage.
 *
 * Route Registry (AAP §0.4.3):
 *   Method: GET
 *   Path:   /staging
 *   Auth:   No
 *   Body:   None
 *   Response: [{ "id", "prompt", "prototype", "status": "staged" }]
 *
 * @param {import('http').IncomingMessage} req - Node.js HTTP request object
 * @param {import('http').ServerResponse} res - Node.js HTTP response object
 * @returns {void}
 */
function list(req, res) {
  try {
    /* Retrieve all requirements with status 'staged' from the store */
    var staged = store.getStaged();

    /* Return the staged list; getStaged() returns an empty array when none exist */
    sendJSON(res, 200, staged);
  } catch (err) {
    /* Unexpected server error — return generic 500 without exposing internals */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * GET /staging/:id — View a specific staged prototype for reviewer inspection.
 *
 * This is the primary "share the prototype for approval" endpoint (AAP §0.1.2).
 * Allows reviewers to see exactly what would be promoted to production by
 * retrieving the full context of a staged requirement: the original prompt,
 * the generated prototype content, timestamps, and current status.
 *
 * Only requirements in the 'staged' state are viewable through this endpoint.
 * Approved, rejected, or production requirements are NOT served here — they
 * have progressed beyond the staging review phase.
 *
 * Route Registry (AAP §0.4.3):
 *   Method: GET
 *   Path:   /staging/:id
 *   Auth:   No
 *   Body:   None
 *   Response: { id, prompt, description, prototype, status, createdAt, updatedAt }
 *
 * Per AAP §0.5.3: "The staging endpoint (GET /staging/:id) serves as the
 * review interface, rendering the prototype content in plain text or JSON
 * format for inspection." — JSON chosen for richer review context.
 *
 * @param {import('http').IncomingMessage} req - Node.js HTTP request object (req.params.id set by router)
 * @param {import('http').ServerResponse} res - Node.js HTTP response object
 * @returns {void}
 */
function getById(req, res) {
  try {
    /* Extract the requirement ID from router-provided params */
    var id = req.params && req.params.id;

    /* Guard: if no ID was provided (should not happen with proper routing) */
    if (!id) {
      sendError(res, 404, 'Staged prototype not found');
      return;
    }

    /* Retrieve the requirement from the store by its UUID */
    var requirement = store.getById(id);

    /* If no requirement exists with this ID, return 404 */
    if (!requirement) {
      sendError(res, 404, 'Staged prototype not found');
      return;
    }

    /* Only staged prototypes are viewable through the staging endpoint.
     * Approved, rejected, or production requirements are filtered out. */
    if (requirement.status !== 'staged') {
      sendError(res, 404, 'No staged prototype found for this requirement');
      return;
    }

    /*
     * Return the full prototype context as JSON for reviewer inspection.
     * Includes: what was requested (prompt/description), what was generated
     * (prototype), current status, and timestamps for audit trail.
     */
    sendJSON(res, 200, {
      id: requirement.id,
      prompt: requirement.prompt,
      description: requirement.description,
      prototype: requirement.prototype,
      status: requirement.status,
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt
    });
  } catch (err) {
    /* Unexpected server error — return generic 500 without exposing internals */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/* -----------------------------------------------------------------------
 * Module Exports — CommonJS pattern (AAP §0.7.1)
 *
 * Export names MUST be exactly: list, getById
 * The router imports this module and registers:
 *   GET /staging     → stagingController.list
 *   GET /staging/:id → stagingController.getById
 * ----------------------------------------------------------------------- */
module.exports = {
  list: list,
  getById: getById
};
