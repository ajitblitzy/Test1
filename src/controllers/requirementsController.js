'use strict';

/**
 * src/controllers/requirementsController.js — Requirements API Controller
 *
 * The intake point of the Staging-Approval Workflow. Handles submission,
 * listing, and detail retrieval of requirements. When a new requirement is
 * submitted via POST /api/requirements, this controller:
 *   1. Parses and validates the JSON request body
 *   2. Creates the requirement in the store (status: submitted)
 *   3. Auto-generates a prototype from the submitted prompt
 *   4. Auto-stages the requirement (status: staged) for reviewer inspection
 *   5. Returns the fully staged requirement with HTTP 201
 *
 * The automatic staging means reviewers can immediately inspect prototypes
 * at GET /staging/:id after a requirement is submitted.
 *
 * Traceability:
 *   AAP §0.2.2 (New Source Files)
 *   AAP §0.4.3 (API Route Registry)
 *   AAP §0.5.1 Group 4 (Controllers — Business Logic)
 *   AAP §0.7.1 (Feature-Specific Rules)
 *   AAP §0.7.3 (Security — untrusted input handling)
 *
 * Security:
 *   - All user-submitted prompt text is treated as untrusted input
 *   - Prompt content is NEVER evaluated or executed
 *   - No authentication required for these endpoints (AAP §0.4.3)
 *
 * @module src/controllers/requirementsController
 */

// Internal imports — CommonJS only (AAP §0.7.1)
// Zero external dependencies — only local project modules
const store = require('../models/requirementStore');
const { parseBody } = require('../middleware/bodyParser');
const { sendJSON, sendError } = require('../utils/responseHelper');

/**
 * POST /api/requirements — Create a new requirement.
 *
 * Accepts a JSON body with a required "prompt" field and optional "description"
 * field. Creates the requirement in the store, auto-generates a prototype from
 * the prompt, auto-stages it for reviewer inspection, and returns the fully
 * staged requirement with HTTP 201 Created.
 *
 * Request body:
 *   { "prompt": "string (required)", "description": "string (optional)" }
 *
 * Success response (201):
 *   { "id": "uuid", "status": "staged", "prompt": "...", "description": "...",
 *     "prototype": "...", "createdAt": "ISO 8601" }
 *
 * Error responses:
 *   400 — Invalid JSON, missing prompt, prompt not a string, or empty prompt
 *   500 — Unexpected server error
 *
 * @param {import('http').IncomingMessage} req - Incoming HTTP request
 * @param {import('http').ServerResponse} res - HTTP server response
 * @returns {Promise<void>}
 */
async function create(req, res) {
  try {
    // Step 1: Parse the JSON request body from the incoming stream.
    // parseBody returns a Promise that resolves with the parsed object
    // or rejects with an Error on malformed JSON.
    var body;
    try {
      body = await parseBody(req);
    } catch (parseErr) {
      sendError(res, 400, 'Invalid JSON in request body');
      return;
    }

    // Step 2: Validate the "prompt" field — required, must be a string.
    // All user-submitted prompt text is treated as untrusted input (AAP §0.7.3).
    // We validate type and content but NEVER evaluate or execute prompt content.
    if (body.prompt === undefined || body.prompt === null) {
      sendError(res, 400, 'Missing required field: prompt');
      return;
    }

    if (typeof body.prompt !== 'string') {
      sendError(res, 400, 'Prompt must be a string');
      return;
    }

    var trimmedPrompt = body.prompt.trim();

    if (trimmedPrompt.length === 0) {
      sendError(res, 400, 'Missing required field: prompt');
      return;
    }

    // Step 3: Handle optional "description" field — default to empty string.
    var description = (body.description && typeof body.description === 'string')
      ? body.description
      : '';

    // Step 4: Create the requirement in the store.
    // store.create() generates a UUID, sets status to 'submitted', and persists.
    var requirement = store.create(trimmedPrompt, description);

    // Step 5: Auto-generate prototype content from the prompt.
    // Per AAP §0.1.3: "constructs a prototype response representing the
    // enhanced functionality". This is a formatted string incorporating the
    // prompt text — in a production system this would be more sophisticated.
    var prototypeContent = '[Prototype] Enhanced server response: ' + trimmedPrompt;

    // Step 6: Auto-stage the requirement.
    // store.stageRequirement() sets the prototype field AND transitions from
    // 'submitted' to 'staged', making it available at GET /staging/:id.
    store.stageRequirement(requirement.id, prototypeContent);

    // Step 7: Return the fully staged requirement with HTTP 201 Created.
    // Re-read from store to get the updated state after staging.
    var stagedRequirement = store.getById(requirement.id);

    sendJSON(res, 201, {
      id: stagedRequirement.id,
      status: stagedRequirement.status,
      prompt: stagedRequirement.prompt,
      description: stagedRequirement.description,
      prototype: stagedRequirement.prototype,
      createdAt: stagedRequirement.createdAt
    });

  } catch (err) {
    // Catch-all for unexpected errors — returns 500 Internal Server Error.
    // Error details are NOT exposed to the client for security.
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * GET /api/requirements — List all requirements.
 *
 * Returns all requirements in the system with their current lifecycle states
 * for audit and tracking purposes. No authentication required (AAP §0.4.3).
 * Returns an empty array when no requirements exist.
 *
 * Success response (200):
 *   [{ "id", "prompt", "status", "createdAt", ... }]
 *
 * Error responses:
 *   500 — Unexpected server error
 *
 * @param {import('http').IncomingMessage} req - Incoming HTTP request
 * @param {import('http').ServerResponse} res - HTTP server response
 * @returns {Promise<void>}
 */
async function list(req, res) {
  try {
    // Retrieve all requirements from the store.
    // store.getAll() returns defensive copies sorted by createdAt descending.
    // Returns an empty array when no requirements exist.
    var requirements = store.getAll();
    sendJSON(res, 200, requirements);

  } catch (err) {
    // Catch-all for unexpected errors — returns 500 Internal Server Error.
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * GET /api/requirements/:id — Get a single requirement by ID.
 *
 * Retrieves a single requirement's full details including prototype content
 * and current lifecycle status. No authentication required (AAP §0.4.3).
 * The requirement ID is extracted from req.params.id, set by the router's
 * parameterized route matching.
 *
 * Success response (200):
 *   { "id", "prompt", "status", "prototype", "description",
 *     "rejectionReason", "createdAt", "updatedAt" }
 *
 * Error responses:
 *   404 — Requirement not found
 *   500 — Unexpected server error
 *
 * @param {import('http').IncomingMessage} req - Incoming HTTP request with params.id
 * @param {import('http').ServerResponse} res - HTTP server response
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  try {
    // Extract the requirement ID from the router's parsed parameters.
    // The router sets req.params = { id: "..." } for parameterized routes.
    var id = req.params && req.params.id ? req.params.id : null;

    if (!id) {
      sendError(res, 400, 'Missing requirement ID');
      return;
    }

    // Retrieve the requirement from the store.
    // store.getById() returns a defensive copy or null if not found.
    var requirement = store.getById(id);

    if (!requirement) {
      sendError(res, 404, 'Requirement not found');
      return;
    }

    // Return the full requirement details.
    sendJSON(res, 200, requirement);

  } catch (err) {
    // Catch-all for unexpected errors — returns 500 Internal Server Error.
    sendError(res, 500, 'An unexpected error occurred');
  }
}

// CommonJS module export (AAP §0.7.1 — NO ES module syntax)
// Function names MUST be exactly: create, list, getById — the router uses these names.
module.exports = {
  create: create,
  list: list,
  getById: getById
};
