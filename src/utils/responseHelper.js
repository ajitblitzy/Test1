'use strict';

/**
 * Shared Response Helper Utilities
 *
 * Foundation layer module that standardizes all HTTP response formatting
 * across the application. Imported by every controller and the router
 * for consistent JSON, text, and error responses.
 *
 * This module has ZERO dependencies — it operates solely on the Node.js
 * http.ServerResponse object passed as an argument to each function.
 *
 * @module src/utils/responseHelper
 */

/**
 * Internal lookup table mapping HTTP error status codes to their
 * standard human-readable labels. Used by sendError to derive the
 * "error" field in standardized error response bodies.
 *
 * Not exported — internal implementation detail only.
 * @type {Object.<number, string>}
 */
const HTTP_ERROR_LABELS = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error'
};

/**
 * Sends a JSON response with proper Content-Type header and status code.
 *
 * Sets the HTTP status code and 'Content-Type: application/json' header
 * atomically via res.writeHead, then serializes the provided data object
 * to a JSON string and sends it as the response body.
 *
 * @param {import('http').ServerResponse} res - Node.js HTTP server response object
 * @param {number} statusCode - HTTP status code (e.g., 200, 201, 400, 404)
 * @param {Object|Array} data - JavaScript object or array to be JSON-serialized
 * @returns {void}
 */
function sendJSON(res, statusCode, data) {
  var jsonString = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(jsonString);
}

/**
 * Sends a plain text response with proper Content-Type header and status code.
 *
 * Sets the HTTP status code and 'Content-Type: text/plain' header atomically
 * via res.writeHead, then sends the provided text string as the response body.
 *
 * This function generalizes the original server.js response pattern:
 *   res.statusCode = 200;
 *   res.setHeader('Content-Type', 'text/plain');
 *   res.end('Hello, World!\n');
 *
 * Calling sendText(res, 200, 'Hello, World!\n') produces the exact same
 * HTTP response as the original server.js handler, preserving backward
 * compatibility.
 *
 * @param {import('http').ServerResponse} res - Node.js HTTP server response object
 * @param {number} statusCode - HTTP status code (e.g., 200)
 * @param {string} text - String to send as the response body
 * @returns {void}
 */
function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
  res.end(text);
}

/**
 * Sends a standardized error JSON response with a human-readable error label.
 *
 * Builds a structured error response object containing:
 *   - error: Human-readable label derived from the HTTP status code
 *   - message: Descriptive error message provided by the caller
 *   - statusCode: The numeric HTTP status code
 *
 * The error label is resolved from the internal HTTP_ERROR_LABELS lookup
 * table. If the status code is not mapped, the generic label 'Error' is used.
 *
 * Delegates to sendJSON internally for actual response delivery, ensuring
 * consistent Content-Type headers and serialization across all error responses.
 *
 * @param {import('http').ServerResponse} res - Node.js HTTP server response object
 * @param {number} statusCode - HTTP error status code (e.g., 400, 401, 404, 500)
 * @param {string} message - Descriptive error message string
 * @returns {void}
 */
function sendError(res, statusCode, message) {
  var errorLabel = HTTP_ERROR_LABELS[statusCode] || 'Error';
  var errorObject = {
    error: errorLabel,
    message: message,
    statusCode: statusCode
  };
  sendJSON(res, statusCode, errorObject);
}

/**
 * Module exports — CommonJS pattern as mandated by AAP §0.7.1.
 *
 * Export names MUST be exactly: sendJSON, sendText, sendError.
 * Other modules import them by these exact names:
 *   - Router:      const { sendJSON } = require('./utils/responseHelper');
 *   - Controllers: const { sendJSON, sendText, sendError } = require('../utils/responseHelper');
 */
module.exports = {
  sendJSON: sendJSON,
  sendText: sendText,
  sendError: sendError
};
