'use strict';

/**
 * src/controllers/approvalController.js — Approval Workflow Controller
 *
 * Handles the three most sensitive endpoints in the Staging-Approval Workflow:
 *   - POST /api/approve/:id  — Transition a staged requirement to approved
 *   - POST /api/reject/:id   — Transition a staged requirement to rejected (terminal)
 *   - POST /api/promote/:id  — Promote an approved requirement to production
 *
 * This controller enforces the approval gate — the ONLY path by which prototype
 * content can reach the production endpoint. All three endpoints are protected
 * by API key authentication via the authGuard middleware.
 *
 * State machine pipeline (AAP §0.4.2):
 *   submitted → staged → approved → production
 *                      → rejected  (terminal branch)
 *
 * Security (AAP §0.7.3):
 *   - All handlers require valid x-api-key header
 *   - API key values are NEVER logged or included in response bodies
 *   - Constant-time comparison delegated to authGuard.js
 *
 * Traceability:
 *   AAP §0.2.2  — New Source Files
 *   AAP §0.4.3  — API Route Registry
 *   AAP §0.5.1  — Group 4 Controllers
 *   AAP §0.7.1  — Feature-Specific Rules
 *   AAP §0.7.3  — Security Requirements
 *
 * @module controllers/approvalController
 */

const store = require('../models/requirementStore');
const { parseBody } = require('../middleware/bodyParser');
const { authenticate } = require('../middleware/authGuard');
const { sendJSON, sendError } = require('../utils/responseHelper');
const config = require('../config');

/**
 * Approve handler — POST /api/approve/:id
 *
 * Transitions a staged requirement to the 'approved' state, enforcing the
 * mandatory staging-approval gate. Only requirements in 'staged' state can
 * be approved. Idempotent: approving an already-approved requirement returns
 * the current state without error (AAP §0.7.1).
 *
 * Authentication: Required (x-api-key header validated against BLITZY_CLIENT_API_KEY)
 *
 * @param {import('http').IncomingMessage} req - HTTP request with params.id set by router
 * @param {import('http').ServerResponse} res - HTTP response object
 * @returns {Promise<void>}
 *
 * @example
 * // Success: 200 { id, status: 'approved', message: '...' }
 * // Auth fail: 401 { error: 'Unauthorized', message: 'Invalid or missing API key' }
 * // Not found: 404 { error: 'Not Found', message: 'Requirement not found' }
 * // Bad state: 409 { error: 'Conflict', message: '...' }
 */
async function approve(req, res) {
  try {
    /* Step 1: Authenticate — all sensitive endpoints require API key (AAP §0.7.1) */
    if (!authenticate(req)) {
      sendError(res, 401, 'Invalid or missing API key');
      return;
    }

    /* Step 2: Extract the requirement ID from router-parsed params */
    var id = req.params && req.params.id ? req.params.id : null;
    if (!id) {
      sendError(res, 400, 'Requirement ID is required');
      return;
    }

    /* Step 3: Validate that the requirement exists in the store */
    var requirement = store.getById(id);
    if (!requirement) {
      sendError(res, 404, 'Requirement not found');
      return;
    }

    /* Step 4: Attempt the state transition to approved
     * store.transition() enforces:
     *   - Idempotent: same-state → returns current state (AAP §0.7.1)
     *   - Terminal guard: rejected/production → throws
     *   - Valid transitions: only staged → approved is allowed
     */
    var updated = store.transition(id, config.states.APPROVED);

    /* Step 5: Return success with the updated requirement data */
    sendJSON(res, 200, {
      id: updated.id,
      status: updated.status,
      message: 'Requirement approved successfully'
    });
  } catch (err) {
    /* State machine rejection → 409 Conflict (invalid transition) */
    if (err.message && (
      err.message.indexOf('Invalid transition') !== -1 ||
      err.message.indexOf('Cannot transition from terminal state') !== -1
    )) {
      sendError(res, 409, err.message);
      return;
    }
    /* Unexpected errors → 500 Internal Server Error */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * Reject handler — POST /api/reject/:id
 *
 * Transitions a staged requirement to the 'rejected' terminal state with
 * an optional rejection reason. Once rejected, the requirement cannot be
 * transitioned to any other state (AAP §0.7.1 — Terminal States are Final).
 *
 * The rejection reason is an optional field in the request body. If the
 * body is empty or parsing fails, the reason defaults to an empty string.
 *
 * Authentication: Required (x-api-key header validated against BLITZY_CLIENT_API_KEY)
 *
 * @param {import('http').IncomingMessage} req - HTTP request with params.id and optional body { reason }
 * @param {import('http').ServerResponse} res - HTTP response object
 * @returns {Promise<void>}
 *
 * @example
 * // Success: 200 { id, status: 'rejected', reason: '...', message: '...' }
 * // Auth fail: 401 { error: 'Unauthorized', message: 'Invalid or missing API key' }
 * // Not found: 404 { error: 'Not Found', message: 'Requirement not found' }
 * // Bad state: 409 { error: 'Conflict', message: '...' }
 */
async function reject(req, res) {
  try {
    /* Step 1: Authenticate — all sensitive endpoints require API key (AAP §0.7.1) */
    if (!authenticate(req)) {
      sendError(res, 401, 'Invalid or missing API key');
      return;
    }

    /* Step 2: Extract the requirement ID from router-parsed params */
    var id = req.params && req.params.id ? req.params.id : null;
    if (!id) {
      sendError(res, 400, 'Requirement ID is required');
      return;
    }

    /* Step 3: Parse request body for optional rejection reason.
     * The reason field is optional per AAP §0.4.3. If the body is empty,
     * malformed, or missing the reason field, we default to an empty string.
     * parseBody() returns {} for empty bodies and rejects on malformed JSON. */
    var reason = '';
    try {
      var body = await parseBody(req);
      if (body && typeof body.reason === 'string') {
        reason = body.reason.trim();
      }
    } catch (parseErr) {
      /* Body parsing failure is non-fatal for reject since reason is optional.
       * Default reason remains empty string. */
      reason = '';
    }

    /* Step 4: Validate that the requirement exists in the store */
    var requirement = store.getById(id);
    if (!requirement) {
      sendError(res, 404, 'Requirement not found');
      return;
    }

    /* Step 5: Store the rejection reason on the requirement object.
     * Access the actual requirement in the store's Map (not the defensive copy)
     * so the reason persists. The store is a singleton with a public Map. */
    var internalRequirement = store.requirements.get(id);
    if (internalRequirement) {
      internalRequirement.rejectionReason = reason;
    }

    /* Step 6: Attempt the state transition to rejected.
     * store.transition() enforces:
     *   - Idempotent: same-state → returns current state (AAP §0.7.1)
     *   - Terminal guard: rejected/production → throws
     *   - Valid transitions: only staged → rejected is allowed */
    var updated = store.transition(id, config.states.REJECTED);

    /* Step 7: Return success with the rejection details */
    sendJSON(res, 200, {
      id: updated.id,
      status: updated.status,
      reason: updated.rejectionReason || '',
      message: 'Requirement rejected'
    });
  } catch (err) {
    /* State machine rejection → 409 Conflict (invalid transition) */
    if (err.message && (
      err.message.indexOf('Invalid transition') !== -1 ||
      err.message.indexOf('Cannot transition from terminal state') !== -1
    )) {
      sendError(res, 409, err.message);
      return;
    }
    /* Unexpected errors → 500 Internal Server Error */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * Promote handler — POST /api/promote/:id
 *
 * Promotes an approved requirement to production — the ONLY path to update
 * the production endpoint response. This is the paramount constraint of the
 * entire Staging-Approval Workflow (AAP §0.1.2).
 *
 * Enforces the complete pipeline: submitted → staged → approved → production.
 * No shortcuts are permitted. Only requirements in the 'approved' state can
 * be promoted. Once promoted, the requirement becomes terminal and cannot
 * transition further.
 *
 * Single Active Production (AAP §0.7.1): Only one requirement may be in the
 * 'production' state at any time. The store automatically updates the
 * currentProductionId pointer when a new requirement is promoted.
 *
 * Authentication: Required (x-api-key header validated against BLITZY_CLIENT_API_KEY)
 *
 * @param {import('http').IncomingMessage} req - HTTP request with params.id set by router
 * @param {import('http').ServerResponse} res - HTTP response object
 * @returns {Promise<void>}
 *
 * @example
 * // Success: 200 { id, status: 'production', message: '...' }
 * // Auth fail: 401 { error: 'Unauthorized', message: 'Invalid or missing API key' }
 * // Not found: 404 { error: 'Not Found', message: 'Requirement not found' }
 * // Not approved: 409 { error: 'Conflict', message: 'Requirement must be in approved state...' }
 */
async function promote(req, res) {
  try {
    /* Step 1: Authenticate — all sensitive endpoints require API key (AAP §0.7.1) */
    if (!authenticate(req)) {
      sendError(res, 401, 'Invalid or missing API key');
      return;
    }

    /* Step 2: Extract the requirement ID from router-parsed params */
    var id = req.params && req.params.id ? req.params.id : null;
    if (!id) {
      sendError(res, 400, 'Requirement ID is required');
      return;
    }

    /* Step 3: Validate that the requirement exists in the store */
    var requirement = store.getById(id);
    if (!requirement) {
      sendError(res, 404, 'Requirement not found');
      return;
    }

    /* Step 4: Validate that the requirement is in the 'approved' state.
     * This enforces the full pipeline: submitted → staged → approved → production.
     * No shortcuts are permitted (AAP §0.7.1). */
    if (requirement.status !== config.states.APPROVED) {
      sendError(res, 409, 'Requirement must be in approved state to promote');
      return;
    }

    /* Step 5: Attempt the state transition to production.
     * store.transition() handles:
     *   - Validating approved → production is a valid transition
     *   - Setting currentProductionId to this requirement's ID
     *   - Single Active Production: auto-updates pointer (AAP §0.7.1) */
    var updated = store.transition(id, config.states.PRODUCTION);

    /* Step 6: Return success — GET / will now serve this requirement's prototype */
    sendJSON(res, 200, {
      id: updated.id,
      status: updated.status,
      message: 'Requirement promoted to production'
    });
  } catch (err) {
    /* State machine rejection → 409 Conflict (invalid transition) */
    if (err.message && (
      err.message.indexOf('Invalid transition') !== -1 ||
      err.message.indexOf('Cannot transition from terminal state') !== -1
    )) {
      sendError(res, 409, err.message);
      return;
    }
    /* Unexpected errors → 500 Internal Server Error */
    sendError(res, 500, 'An unexpected error occurred');
  }
}

/**
 * Module exports — CommonJS pattern as mandated by AAP §0.7.1.
 *
 * Export names match the router's expected handler references:
 *   - POST /api/approve/:id → approvalController.approve
 *   - POST /api/reject/:id  → approvalController.reject
 *   - POST /api/promote/:id → approvalController.promote
 */
module.exports = {
  approve: approve,
  reject: reject,
  promote: promote
};
