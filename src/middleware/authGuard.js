'use strict';

/**
 * src/middleware/authGuard.js — API Key Authentication Middleware
 *
 * Protects sensitive workflow endpoints (approve, reject, promote) by
 * validating the x-api-key header from incoming HTTP requests against
 * the BLITZY_CLIENT_API_KEY environment variable.
 *
 * Security design:
 * - Constant-time comparison via crypto.timingSafeEqual() prevents timing attacks
 * - Fail-closed behavior: authentication rejects when no key is configured
 * - API key values are never logged, exposed in responses, or included in errors
 * - Dummy comparison performed when key lengths differ to prevent length-oracle attacks
 *
 * Traceability:
 *   AAP §0.2.2  — New Source Files (src/middleware/authGuard.js)
 *   AAP §0.5.1  — Group 3 Middleware
 *   AAP §0.4.3  — approve/reject/promote require Auth
 *   AAP §0.7.1  — Authentication on Sensitive Endpoints
 *   AAP §0.7.3  — Security Requirements (constant-time comparison, no key logging)
 *
 * @module middleware/authGuard
 */

const crypto = require('crypto');
const config = require('../config');

/**
 * Authenticates an incoming HTTP request by validating the x-api-key header
 * against the configured BLITZY_CLIENT_API_KEY.
 *
 * Uses crypto.timingSafeEqual() for constant-time comparison to prevent
 * timing attacks (AAP §0.7.3). When the provided key and expected key have
 * different lengths, a dummy comparison is performed against the provided
 * key itself to maintain constant execution time — this prevents an attacker
 * from distinguishing "wrong length" from "wrong content" based on timing.
 *
 * Fail-closed design: returns false when:
 * - No x-api-key header is present on the request
 * - The x-api-key header value is an empty string
 * - No BLITZY_CLIENT_API_KEY is configured in the environment
 * - The provided key does not match the expected key
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request object.
 *   Node.js normalizes all header names to lowercase, so the header is read
 *   as req.headers['x-api-key'].
 * @returns {boolean} true if the provided API key matches the configured key;
 *   false otherwise.
 */
function authenticate(req) {
  // Step 1: Extract the API key from the request header.
  // Node.js normalizes header names to lowercase, so 'x-api-key' is correct.
  // Per AAP §0.4.3, the authentication header is 'x-api-key'.
  const providedKey = req.headers['x-api-key'];

  // Step 2: Get the expected API key from the centralized config module.
  // config.apiKey reads process.env.BLITZY_CLIENT_API_KEY (defaults to '').
  const expectedKey = config.apiKey;

  // Step 3: Early exit — fail closed when no key is provided.
  // If the header is absent, Node.js returns undefined for the header value.
  // If the header is present but empty, it will be an empty string.
  // Both cases must be rejected.
  if (!providedKey || providedKey.length === 0) {
    return false;
  }

  // Step 4: Early exit — fail closed when no expected key is configured.
  // If BLITZY_CLIENT_API_KEY is not set in the environment, config.apiKey
  // defaults to '' (empty string). In this state, all authentication
  // attempts must be rejected rather than allowing open access.
  if (!expectedKey || expectedKey.length === 0) {
    return false;
  }

  // Step 5: Constant-time comparison using crypto.timingSafeEqual().
  // CRITICAL SECURITY REQUIREMENT (AAP §0.7.3):
  // - Never use === or == for API key comparison (vulnerable to timing attacks)
  // - crypto.timingSafeEqual() requires both arguments to be Buffer instances
  //   of the same byte length
  const providedBuffer = Buffer.from(providedKey, 'utf-8');
  const expectedBuffer = Buffer.from(expectedKey, 'utf-8');

  // Step 6: Handle different-length keys.
  // crypto.timingSafeEqual() throws if buffer lengths differ. We must still
  // maintain constant-time behavior to prevent a length-oracle attack where
  // an attacker could determine the expected key length from response timing.
  // Perform a dummy self-comparison to consume equivalent CPU time before
  // returning false.
  if (providedBuffer.length !== expectedBuffer.length) {
    // Dummy comparison to maintain constant execution time.
    // Compares the provided buffer against itself (always true, result discarded).
    crypto.timingSafeEqual(providedBuffer, providedBuffer);
    return false;
  }

  // Step 7: Perform the actual constant-time comparison.
  // Returns true only when every byte of the provided key matches the expected key.
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

module.exports = { authenticate };
