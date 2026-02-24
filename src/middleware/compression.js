'use strict';

/**
 * Gzip/Deflate Response Compression Middleware
 *
 * Checks the incoming request's `Accept-Encoding` header and applies gzip or
 * deflate compression to the HTTP response body using the Node.js built-in
 * `zlib` module. This middleware reduces network payload size, improving
 * performance for clients on bandwidth-constrained connections.
 *
 * How it works:
 *   1. Reads the `Accept-Encoding` request header.
 *   2. Selects the best supported encoding (gzip preferred over deflate).
 *   3. If a supported encoding is found, monkey-patches `res.end` so that the
 *      response body is compressed via `zlib.gzip()` or `zlib.deflate()` before
 *      being sent to the client.
 *   4. If no supported encoding is found, the response is sent uncompressed
 *      with `res.end` left untouched.
 *
 * Supported encodings (in priority order):
 *   - gzip  (most widely supported by HTTP clients)
 *   - deflate
 *
 * Fallback behavior:
 *   When the client does not advertise gzip or deflate support (or omits the
 *   `Accept-Encoding` header entirely), the middleware is a no-op and the
 *   response passes through uncompressed and byte-identical to the original.
 *
 * @module src/middleware/compression
 */

const zlib = require('zlib');

/**
 * Applies response compression based on the client's `Accept-Encoding` header.
 *
 * Must be called BEFORE the route handler so that `res.end` is wrapped prior to
 * the handler invoking it. In the middleware pipeline this runs after the logger
 * and before the request handler (logger → compression → handler).
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request object.
 * @param {import('http').ServerResponse}  res - The outgoing HTTP response object.
 * @returns {void}
 */
function compressResponse(req, res) {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  /*
   * Determine the best encoding — gzip takes priority over deflate.
   *
   * Note: This uses simple substring matching and does not parse RFC 7231
   * quality factors (e.g., 'gzip;q=0' would still match as supported).
   * In practice, clients virtually never send q=0 to explicitly disable an
   * encoding. Full quality-factor parsing is a future improvement if strict
   * HTTP content negotiation compliance is required.
   */
  let encoding = null;

  if (acceptEncoding.includes('gzip')) {
    encoding = 'gzip';
  } else if (acceptEncoding.includes('deflate')) {
    encoding = 'deflate';
  }

  /* No supported encoding advertised — leave res.end untouched */
  if (!encoding) {
    return;
  }

  /* Capture the current res.end (may already be wrapped by earlier middleware) */
  const originalEnd = res.end;

  /**
   * Patched `res.end` that compresses the response body before sending.
   *
   * @param {string|Buffer|null|undefined} chunk        - Response body data.
   * @param {string}                       [encodingArg] - Character encoding when chunk is a string.
   * @param {Function}                     [callback]    - Optional callback invoked after the response ends.
   * @returns {*} The return value of the original `res.end`.
   */
  res.end = function patchedEnd(chunk, encodingArg, callback) {
    /* Empty body — nothing to compress, pass through directly */
    if (!chunk) {
      return originalEnd.call(res, chunk, encodingArg, callback);
    }

    /* Normalise chunk to a Buffer for the zlib one-shot functions */
    const body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encodingArg === 'string' ? encodingArg : undefined);

    /* Select the appropriate one-shot compression function */
    const compressFn = encoding === 'gzip' ? zlib.gzip : zlib.deflate;

    compressFn(body, function onCompressed(err, compressed) {
      if (err) {
        /* Compression failed — fall back to the uncompressed body */
        return originalEnd.call(res, chunk, encodingArg, callback);
      }

      /* Set the Content-Encoding header so the client knows to decompress */
      res.setHeader('Content-Encoding', encoding);

      /* Remove Content-Length — compressed size differs from the original */
      res.removeHeader('Content-Length');

      /* Send the compressed payload via the original (or outer-wrapped) res.end */
      return originalEnd.call(res, compressed, callback);
    });
  };
}

module.exports = { compressResponse };
