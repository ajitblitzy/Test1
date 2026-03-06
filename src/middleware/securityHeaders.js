'use strict';

/**
 * Security Headers Middleware
 *
 * Sets production-grade HTTP security headers on every response to mitigate
 * common web vulnerabilities including MIME-type sniffing, clickjacking,
 * cross-site scripting (XSS), and server technology disclosure.
 *
 * This middleware is designed to be the FIRST in the pipeline so that all
 * responses — including error responses — carry the full set of security
 * headers.
 *
 * Pipeline position: securityHeaders → requestLogger → helloHandler → errorHandler
 *
 * @module middleware/securityHeaders
 */

/**
 * Middleware that applies security-oriented HTTP response headers.
 *
 * Headers set:
 *  - X-Content-Type-Options: nosniff          — prevents MIME-type sniffing
 *  - X-Frame-Options: DENY                    — prevents iframe embedding (clickjacking)
 *  - X-XSS-Protection: 0                      — disables legacy browser XSS filter
 *  - Strict-Transport-Security: max-age=...   — enforces HTTPS for 1 year
 *  - Content-Security-Policy: default-src 'none' — restricts all resource loading
 *  - Removes X-Powered-By                     — prevents server technology disclosure
 *
 * @param {import('http').IncomingMessage} req  - The incoming HTTP request object.
 * @param {import('http').ServerResponse}  res  - The outgoing HTTP response object.
 * @param {Function}                       next - Callback to pass control to the next middleware.
 * @returns {void}
 */
function securityHeaders(req, res, next) {
  // Prevent browsers from MIME-type sniffing the response, reducing the risk
  // of XSS attacks that exploit content-type mismatches.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Deny all iframe embedding to protect against clickjacking attacks.
  res.setHeader('X-Frame-Options', 'DENY');

  // Disable the legacy XSS auditor in older browsers. Modern best practice
  // recommends setting this to '0' because the filter can introduce
  // additional vulnerabilities rather than preventing them.
  res.setHeader('X-XSS-Protection', '0');

  // Instruct browsers to only access this server over HTTPS for one year
  // (31 536 000 seconds), including all subdomains. This provides forward
  // compatibility for when TLS termination is added via a reverse proxy.
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Restrict the browser from loading any resources (scripts, styles, images,
  // etc.) in the context of this response. Appropriate for a plain-text API
  // that serves no HTML or embedded resources.
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Remove the X-Powered-By header to prevent disclosure of the server
  // technology stack. While Node.js core HTTP does not set this header by
  // default, removing it defensively guards against upstream proxies or
  // future middleware that might add it.
  res.removeHeader('X-Powered-By');

  // Pass control to the next middleware in the pipeline.
  next();
}

module.exports = { securityHeaders };
