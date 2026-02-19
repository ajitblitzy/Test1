'use strict';

/**
 * src/router.js — Request Router Module
 *
 * URL pattern router that dispatches incoming HTTP requests to the correct
 * controller handler based on method + URL path matching.  This module
 * replaces the monolithic single-handler pattern from the original server.js
 * with a structured routing mechanism.
 *
 * server.js wires this module via:
 *   const router = require('./src/router');
 *   http.createServer((req, res) => router.handle(req, res));
 *
 * Route matching algorithm:
 *   1. Parse req.url using url.parse() to extract the pathname.
 *   2. Normalize the pathname (strip trailing slashes except root '/').
 *   3. Iterate through registered routes in definition order.
 *   4. For each route, test the pathname against the pre-compiled regex.
 *   5. If a path matches:
 *      a. If the HTTP method also matches → dispatch to handler.
 *      b. If the method differs → record a 405 candidate.
 *   6. If no path matched at all → 404 Not Found.
 *   7. If path matched but method didn't → 405 Method Not Allowed.
 *   8. Wrap handler dispatch in try/catch (+ promise catch) for 500 errors.
 *
 * Parameterized routes (e.g. /api/requirements/:id) are converted to regexes
 * at registration time.  Extracted parameter values are attached to req.params.
 *
 * Traceability:
 *   AAP §0.2.2  — New Source Files (src/router.js)
 *   AAP §0.4.3  — API Route Registry (10 routes)
 *   AAP §0.5.1  — Group 5 Routing
 *   AAP §0.7.1  — CommonJS, Zero External Dependencies
 *
 * @module src/router
 */

/* ---------------------------------------------------------------------------
 * External Imports — Node.js built-in only (AAP §0.7.1)
 * --------------------------------------------------------------------------- */
var url = require('url');

/* ---------------------------------------------------------------------------
 * Internal Imports — from depends_on_files only
 * --------------------------------------------------------------------------- */
var productionController    = require('./controllers/productionController');
var requirementsController  = require('./controllers/requirementsController');
var stagingController       = require('./controllers/stagingController');
var approvalController      = require('./controllers/approvalController');
var responseHelper          = require('./utils/responseHelper');
var sendJSON                = responseHelper.sendJSON;

/* ---------------------------------------------------------------------------
 * Route Compilation Utilities
 *
 * Converts human-readable route patterns (e.g. '/api/requirements/:id') into
 * pre-compiled RegExp objects for O(1)-per-character matching at request time.
 * Parameter names are captured so that matched groups can be mapped back to
 * named params on req.params.
 * --------------------------------------------------------------------------- */

/**
 * Converts a route pattern string into a compiled regex and an ordered list
 * of parameter names extracted from ':paramName' segments.
 *
 * Examples:
 *   patternToRegex('/')
 *     → { regex: /^\/$/, paramNames: [] }
 *
 *   patternToRegex('/api/requirements/:id')
 *     → { regex: /^\/api\/requirements\/([^\/]+)$/, paramNames: ['id'] }
 *
 * @param {string} pattern - Route pattern string, e.g. '/api/requirements/:id'
 * @returns {{ regex: RegExp, paramNames: string[] }}
 */
function patternToRegex(pattern) {
  var paramNames = [];

  /* Escape forward slashes for regex, then replace :param placeholders with
   * capture groups.  Each :paramName is replaced by ([^/]+) to capture one
   * or more non-slash characters as the parameter value. */
  var regexStr = pattern.replace(/:([^/]+)/g, function (match, paramName) {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  return {
    regex: new RegExp('^' + regexStr + '$'),
    paramNames: paramNames
  };
}

/* ---------------------------------------------------------------------------
 * Route Table
 *
 * Each entry defines a method, a human-readable path pattern, the compiled
 * regex + param names (computed once at module load), and the handler function
 * that the router should invoke when both method and path match.
 *
 * IMPORTANT — Route order matters:
 *   Static routes (e.g. '/api/requirements') MUST appear before parameterized
 *   routes (e.g. '/api/requirements/:id') for the same path prefix to avoid
 *   the static segment being captured as a parameter value.
 *
 * All 10 routes per AAP §0.4.3:
 * --------------------------------------------------------------------------- */
var routes = [
  /* --- Production & Health (productionController) --- */
  {
    method: 'GET',
    pattern: '/',
    compiled: patternToRegex('/'),
    handler: productionController.getProduction
  },
  {
    method: 'GET',
    pattern: '/health',
    compiled: patternToRegex('/health'),
    handler: productionController.getHealth
  },

  /* --- Requirements API (requirementsController) --- */
  {
    method: 'POST',
    pattern: '/api/requirements',
    compiled: patternToRegex('/api/requirements'),
    handler: requirementsController.create
  },
  {
    method: 'GET',
    pattern: '/api/requirements',
    compiled: patternToRegex('/api/requirements'),
    handler: requirementsController.list
  },
  {
    method: 'GET',
    pattern: '/api/requirements/:id',
    compiled: patternToRegex('/api/requirements/:id'),
    handler: requirementsController.getById
  },

  /* --- Staging API (stagingController) --- */
  {
    method: 'GET',
    pattern: '/staging',
    compiled: patternToRegex('/staging'),
    handler: stagingController.list
  },
  {
    method: 'GET',
    pattern: '/staging/:id',
    compiled: patternToRegex('/staging/:id'),
    handler: stagingController.getById
  },

  /* --- Approval Workflow API (approvalController) --- */
  {
    method: 'POST',
    pattern: '/api/approve/:id',
    compiled: patternToRegex('/api/approve/:id'),
    handler: approvalController.approve
  },
  {
    method: 'POST',
    pattern: '/api/reject/:id',
    compiled: patternToRegex('/api/reject/:id'),
    handler: approvalController.reject
  },
  {
    method: 'POST',
    pattern: '/api/promote/:id',
    compiled: patternToRegex('/api/promote/:id'),
    handler: approvalController.promote
  }
];

/* ---------------------------------------------------------------------------
 * Pathname Normalization
 *
 * Strips trailing slashes from the pathname so that '/api/requirements/' and
 * '/api/requirements' match the same route.  The root path '/' is preserved
 * as-is since stripping its slash would produce an empty string.
 * --------------------------------------------------------------------------- */

/**
 * Normalizes a URL pathname by removing a trailing slash (if present)
 * unless the pathname is exactly '/'.
 *
 * @param {string} pathname - The URL pathname to normalize
 * @returns {string} Normalized pathname
 */
function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.charAt(pathname.length - 1) === '/') {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/* ---------------------------------------------------------------------------
 * Route Matching and Dispatching
 * --------------------------------------------------------------------------- */

/**
 * Extracts named parameters from a regex match result using the route's
 * paramNames list.
 *
 * @param {RegExpExecArray} matchResult - Result of regex.exec(pathname)
 * @param {string[]} paramNames - Ordered list of parameter names
 * @returns {Object.<string, string>} Map of param name → decoded value
 */
function extractParams(matchResult, paramNames) {
  var params = {};
  for (var i = 0; i < paramNames.length; i++) {
    /* matchResult[0] is the full match; capture groups start at index 1 */
    params[paramNames[i]] = decodeURIComponent(matchResult[i + 1]);
  }
  return params;
}

/**
 * Main request handler — dispatched by http.createServer.
 *
 * Parses the request URL, iterates the route table to find a matching
 * method + path combination, extracts any parameterized segments, attaches
 * them to req.params, and invokes the matched controller handler.
 *
 * Error handling:
 *   - 404 Not Found: No route pattern matches the pathname.
 *   - 405 Method Not Allowed: A route pattern matches but with a different
 *     HTTP method (e.g. POSTing to a GET-only route).
 *   - 500 Internal Server Error: The matched handler throws synchronously
 *     or returns a rejected promise.
 *
 * @param {import('http').IncomingMessage} req - Node.js HTTP request object
 * @param {import('http').ServerResponse} res - Node.js HTTP server response object
 * @returns {void}
 */
function handle(req, res) {
  try {
    /* Step 1: Parse the URL to extract the pathname (strips query string) */
    var parsedUrl = url.parse(req.url, true);
    var pathname = normalizePath(parsedUrl.pathname || '/');
    var method = (req.method || 'GET').toUpperCase();

    /* Step 2: Iterate routes looking for a match */
    var pathMatchFound = false;
    var matchedRoute = null;
    var matchResult = null;

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var execResult = route.compiled.regex.exec(pathname);

      if (execResult) {
        /* Path pattern matches — record that we found at least one path match */
        pathMatchFound = true;

        if (route.method === method) {
          /* Both path AND method match — this is the handler to call */
          matchedRoute = route;
          matchResult = execResult;
          break;
        }
        /* Path matches but method doesn't — continue searching in case
         * a later route matches both path AND method (e.g. GET and POST
         * on the same path like /api/requirements). */
      }
    }

    /* Step 3: Dispatch or return error */
    if (matchedRoute) {
      /* Extract parameters from the URL and attach to req.params */
      req.params = extractParams(matchResult, matchedRoute.compiled.paramNames);

      /* Invoke the handler — may be sync or async (returns a Promise) */
      var result = matchedRoute.handler(req, res);

      /* If the handler returns a Promise, catch any rejections to avoid
       * unhandled promise rejection crashes. */
      if (result && typeof result.then === 'function') {
        result.then(null, function (asyncErr) {
          /* Guard: only send 500 if headers haven't already been sent */
          if (!res.headersSent) {
            sendJSON(res, 500, {
              error: 'Internal Server Error',
              message: 'An unexpected error occurred',
              statusCode: 500
            });
          }
        });
      }
    } else if (pathMatchFound) {
      /* A route pattern matched the pathname but no route matched the method
       * → 405 Method Not Allowed */
      sendJSON(res, 405, {
        error: 'Method Not Allowed',
        message: 'Method not allowed for this route',
        statusCode: 405
      });
    } else {
      /* No route pattern matched the pathname at all → 404 Not Found */
      sendJSON(res, 404, {
        error: 'Not Found',
        message: 'Route not found',
        statusCode: 404
      });
    }
  } catch (syncErr) {
    /* Synchronous exception in route matching or handler invocation
     * → 500 Internal Server Error.
     * Guard: only send response if headers haven't been sent yet. */
    if (!res.headersSent) {
      sendJSON(res, 500, {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    }
  }
}

/* ---------------------------------------------------------------------------
 * Module Exports — CommonJS pattern (AAP §0.7.1)
 *
 * The router exposes a single function 'handle' that is compatible with
 * http.createServer's callback signature: (req, res) => void
 *
 * Usage in server.js:
 *   const router = require('./src/router');
 *   const server = http.createServer((req, res) => router.handle(req, res));
 * --------------------------------------------------------------------------- */
module.exports = {
  handle: handle
};
