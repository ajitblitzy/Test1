# Blitzy Project Guide

---

## 1. Executive Summary

### 1.1 Project Overview

This project refactors a minimal 14-line monolithic Node.js HTTP server (`server.js`) into a production-grade, modular application following Clean Architecture and SOLID principles. The refactoring decomposes all concerns — configuration, server infrastructure, request handling, middleware pipeline, structured logging, security headers, error handling, and graceful shutdown — into dedicated modules within a `src/` directory, while preserving 100% behavioral compatibility: every HTTP request returns `200 OK`, `Content-Type: text/plain`, and `Hello, World!\n`. Zero external npm dependencies are introduced; all functionality uses Node.js built-in modules. A comprehensive test suite of 79 tests validates every module independently and as an integrated system.

### 1.2 Completion Status

```mermaid
pie title Project Completion — 87.7%
    "Completed (64h)" : 64
    "Remaining (9h)" : 9
```

| Metric | Value |
|--------|-------|
| **Total Project Hours** | **73h** |
| **Completed Hours (AI)** | **64h** |
| **Remaining Hours** | **9h** |
| **Completion Percentage** | **87.7%** |

**Calculation:** 64h completed ÷ 73h total = 87.7% complete

### 1.3 Key Accomplishments

- ✅ Decomposed monolithic 14-line `server.js` into 10 modular source files across `src/` following Clean Architecture
- ✅ Implemented middleware pipeline: `securityHeaders` → `requestLogger` → `helloHandler` → `errorHandler`
- ✅ Added 5 production security headers and X-Powered-By removal
- ✅ Created structured logging utility with ISO timestamps and log levels (info, warn, error)
- ✅ Implemented graceful shutdown on SIGINT/SIGTERM with configurable drain timeout
- ✅ Added EADDRINUSE and EACCES error handling on server startup
- ✅ Externalized configuration via environment variables (HOST, PORT, NODE_ENV) with sensible defaults
- ✅ Created comprehensive test suite: 79 tests across 7 test files — 100% pass rate
- ✅ Zero external dependencies — all tests use Node.js built-in `node:test` and `node:assert`
- ✅ Updated README.md with full architecture documentation, setup, and configuration reference
- ✅ Added project configuration: `package.json`, `.gitignore`, `.env.example`, `.nvmrc`
- ✅ 100% behavioral preservation: all HTTP methods on all paths return identical Hello World response

### 1.4 Critical Unresolved Issues

| Issue | Impact | Owner | ETA |
|-------|--------|-------|-----|
| No code coverage metrics generated | Cannot verify exact line/branch coverage percentages | Human Developer | 1h |
| Default bind to 127.0.0.1 blocks external access | Production deployment requires HOST override | DevOps / Human Developer | 0.5h |

### 1.5 Access Issues

No access issues identified. The project uses zero external npm packages, zero external services, and zero API keys. All functionality relies exclusively on Node.js built-in modules. Repository access is confirmed and all git operations succeed.

### 1.6 Recommended Next Steps

1. **[High]** Conduct human code review of all 10 source modules and 7 test files for production sign-off
2. **[High]** Configure production environment variables (HOST, PORT, NODE_ENV) for deployment target
3. **[Medium]** Run security compliance audit to validate headers meet organizational standards
4. **[Medium]** Execute load/performance testing to establish production baseline metrics
5. **[Low]** Review and finalize README.md for any organization-specific documentation standards

---

## 2. Project Hours Breakdown

### 2.1 Completed Work Detail

| Component | Hours | Description |
|-----------|-------|-------------|
| Architecture Design & Planning | 3 | Clean Architecture decomposition, SOLID mapping, middleware pipeline design, module dependency graph |
| Configuration Module (`src/config/index.js`) | 2 | Environment-variable-backed config with HOST/PORT/NODE_ENV defaults, PORT validation, Object.freeze immutability |
| Logger Utility (`src/utils/logger.js`) | 2 | Structured logging with ISO 8601 timestamps, info/warn/error levels wrapping console methods |
| Graceful Shutdown (`src/utils/gracefulShutdown.js`) | 4 | SIGINT/SIGTERM signal handlers, configurable drain timeout, shutdown lifecycle logging |
| Hello Handler (`src/handlers/helloHandler.js`) | 1 | Pure function extraction preserving exact 200/text-plain/Hello World response behavior |
| Security Headers Middleware (`src/middleware/securityHeaders.js`) | 3 | 5 production security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Strict-Transport-Security, Content-Security-Policy) + X-Powered-By removal |
| Request Logger Middleware (`src/middleware/requestLogger.js`) | 2 | HTTP method/URL/status/duration logging via response finish event |
| Error Handler Middleware (`src/middleware/errorHandler.js`) | 3 | Catch-all 500 handler, stack trace suppression in production, headersSent guard |
| HTTP Server Module (`src/server.js`) | 5 | Server factory with `http.createServer()`, EADDRINUSE/EACCES error handling, keepAlive and timeout configuration |
| Application Factory (`src/app.js`) | 5 | Middleware composition pipeline, dependency injection of logger and config, server lifecycle management |
| Root Entry Point Refactor (`server.js`) | 1 | Thin bootstrapper importing and calling `startServer()` from `src/app.js` |
| Project Configuration Files | 2 | `package.json`, `.gitignore`, `.env.example`, `.nvmrc`, `package-lock.json` |
| README.md Documentation Update | 3 | Full rewrite with architecture diagram, installation, configuration, testing, and usage documentation (276 lines) |
| Unit Tests — Handler (7 cases) | 3 | Status code 200, Content-Type text/plain, body verification, res.end() call, method/path agnostic |
| Unit Tests — Security Headers (9 cases) | 3 | All 5 headers set, X-Powered-By removal, next() call, comprehensive validation |
| Unit Tests — Request Logger (8 cases) | 4 | next() invocation, finish event handling, log format, methods, paths |
| Unit Tests — Error Handler (10 cases) | 4 | 500 status, Content-Type, body, error logging, headersSent guard, no stack trace leakage |
| Unit Tests — Config (9 cases) | 3 | Default values, env var overrides, PORT validation/fallback, Object.freeze immutability |
| Unit Tests — Logger (18 cases) | 3 | Structure validation, info/warn/error delegation, ISO timestamps, variadic arguments |
| Integration Tests (18 cases) | 6 | Full HTTP lifecycle, all HTTP methods (GET/POST/PUT/DELETE), all paths, security headers, graceful shutdown |
| Validation & Runtime Verification | 2 | Syntax validation of 17 files, runtime behavioral testing, curl verification |
| **Total** | **64** | |

### 2.2 Remaining Work Detail

| Category | Base Hours | Priority | After Multiplier |
|----------|-----------|----------|-----------------|
| Human Code Review & Approval | 2.5 | High | 3.0 |
| Production Environment Configuration | 1.5 | High | 2.0 |
| Security Compliance Audit | 1.0 | Medium | 1.5 |
| Performance & Load Testing | 1.0 | Medium | 1.5 |
| Documentation Final Review | 0.5 | Low | 1.0 |
| **Total** | **7.5** | | **9.0** |

### 2.3 Enterprise Multipliers Applied

| Multiplier | Value | Rationale |
|-----------|-------|-----------|
| Compliance Review | 1.10x | Production deployment requires organizational security and code quality compliance checks |
| Uncertainty Buffer | 1.10x | Conservative buffer for environment-specific configuration issues and unforeseen integration challenges |
| **Combined** | **1.21x** | Applied to all remaining base hour estimates, rounded up to nearest 0.5h |

---

## 3. Test Results

All tests were executed by Blitzy's autonomous validation system using the Node.js v20.20.0 built-in test runner (`node --test`).

| Test Category | Framework | Total Tests | Passed | Failed | Coverage % | Notes |
|--------------|-----------|-------------|--------|--------|-----------|-------|
| Unit — Config | node:test / node:assert | 9 | 9 | 0 | N/A | Defaults, env overrides, PORT validation, Object.freeze |
| Unit — Logger | node:test / node:assert | 18 | 18 | 0 | N/A | Structure, info/warn/error delegation, timestamps, variadic args |
| Unit — Hello Handler | node:test / node:assert | 7 | 7 | 0 | N/A | Status 200, Content-Type, body, res.end(), method/path agnostic |
| Unit — Request Logger | node:test / node:assert | 8 | 8 | 0 | N/A | next() call, finish event, log format, methods, paths |
| Unit — Security Headers | node:test / node:assert | 9 | 9 | 0 | N/A | All 5 headers, X-Powered-By removal, next(), comprehensive |
| Unit — Error Handler | node:test / node:assert | 10 | 10 | 0 | N/A | 500 status, Content-Type, body, logging, headersSent, no leak |
| Integration — Server | node:test / node:assert | 18 | 18 | 0 | N/A | Full HTTP lifecycle, all methods, all paths, security headers, graceful shutdown |
| **Totals** | | **79** | **79** | **0** | | **100% pass rate — 0 failures, 0 skipped, 0 cancelled** |

> **Note:** Code coverage percentages are not available because `--experimental-test-coverage` was not included in the test script. All 79 tests originate from Blitzy's autonomous validation execution (`npm test`).

---

## 4. Runtime Validation & UI Verification

### Runtime Health

- ✅ `node server.js` — Server starts and binds to `127.0.0.1:3000`
- ✅ `npm start` — Equivalent startup via package.json script
- ✅ Startup log output: `[ISO_TIMESTAMP] [INFO] Server running at http://127.0.0.1:3000/`
- ✅ `PORT=4000 node server.js` — Environment variable override works correctly
- ✅ Process exits cleanly on SIGTERM with shutdown logging

### HTTP Response Validation

- ✅ `GET /` → `200 OK`, `Content-Type: text/plain`, body `Hello, World!\n`
- ✅ `POST /anything` → Identical response (method-agnostic)
- ✅ `PUT /foo/bar` → Identical response (path-agnostic)
- ✅ `DELETE /test` → Identical response (universal handler)
- ✅ Response body is exactly 14 bytes (`Hello, World!\n`)

### Security Headers Validation

- ✅ `X-Content-Type-Options: nosniff` — Present on all responses
- ✅ `X-Frame-Options: DENY` — Present on all responses
- ✅ `X-XSS-Protection: 0` — Present on all responses
- ✅ `Strict-Transport-Security: max-age=31536000; includeSubDomains` — Present on all responses
- ✅ `Content-Security-Policy: default-src 'none'` — Present on all responses
- ✅ `X-Powered-By` — Removed (not present in response headers)

### Error Handling Validation

- ✅ EADDRINUSE — Logs clear error message and exits with code 1
- ✅ Graceful shutdown on SIGTERM — Logs shutdown events, closes server cleanly
- ✅ Request logging — Outputs method, path, status code, and duration in ms

### UI Verification

Not applicable — this is a backend-only HTTP server with no user interface components.

---

## 5. Compliance & Quality Review

| Compliance Area | AAP Requirement | Status | Evidence |
|----------------|----------------|--------|----------|
| Clean Architecture | Decompose monolithic server.js into separated layers | ✅ Pass | 10 source modules in `src/` with clear separation of concerns |
| SOLID — Single Responsibility | Each module owns one concern | ✅ Pass | Each of 10 source files has exactly one responsibility |
| SOLID — Open/Closed | Extensible middleware pipeline without modifying core | ✅ Pass | `src/app.js` composes middleware chain; new middleware added without modifying existing |
| SOLID — Dependency Inversion | Inject dependencies like logger and config | ✅ Pass | Logger and config imported by modules that need them, not hardcoded |
| Behavioral Preservation | Response: 200 OK, text/plain, "Hello, World!\n" | ✅ Pass | Runtime curl verification + 18 integration tests confirm identical behavior |
| Zero External Dependencies | No unnecessary npm packages | ✅ Pass | package.json has zero dependencies/devDependencies; uses only Node.js built-ins |
| Error Handling | EADDRINUSE, uncaught exceptions, graceful shutdown | ✅ Pass | `src/server.js` handles bind errors; `src/utils/gracefulShutdown.js` handles signals |
| Security Headers | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, CSP | ✅ Pass | `src/middleware/securityHeaders.js` sets all 5 + removes X-Powered-By |
| Structured Logging | Timestamp + level + message for startup, requests, errors, shutdown | ✅ Pass | `src/utils/logger.js` provides info/warn/error with ISO 8601 timestamps |
| Configuration Externalization | HOST, PORT, NODE_ENV via environment variables | ✅ Pass | `src/config/index.js` reads process.env with fallback defaults |
| Testability | Factory pattern, pure handlers, injectable dependencies | ✅ Pass | `createApp()` returns server without binding; handler is pure function |
| Test Coverage | Unit + integration tests for all modules | ✅ Pass | 79 tests across 7 files; 100% pass rate |
| package.json | Scripts (start, test), engines constraint | ✅ Pass | `npm start`, `npm test`, `engines.node >= 18.0.0` |
| .gitignore | Exclude node_modules, .env, coverage, logs | ✅ Pass | All 4 patterns present |
| .env.example | Document HOST, PORT, NODE_ENV | ✅ Pass | Template file with all 3 variables and example values |
| .nvmrc | Pin Node.js version | ✅ Pass | Contains `20` |
| README.md | Updated structure, install, config, test, usage | ✅ Pass | Full rewrite: 276 lines covering all sections |
| Code Simplicity | No unnecessary abstractions; standard patterns | ✅ Pass | One level of indirection; standard `(req, res, next)` middleware signature |
| CommonJS Modules | require/module.exports (no TypeScript, no ESM) | ✅ Pass | All files use `'use strict'` + CommonJS |
| Backward Compatibility | `node server.js` startup command preserved | ✅ Pass | Root `server.js` remains entry point |

**Autonomous Validation Fixes Applied:** ZERO — all source code agents delivered production-ready, fully functional code on first pass. No fixes were required during validation.

---

## 6. Risk Assessment

| Risk | Category | Severity | Probability | Mitigation | Status |
|------|----------|----------|-------------|------------|--------|
| No code coverage metrics tool configured | Technical | Low | High | Add `--experimental-test-coverage` flag to npm test script or integrate c8/istanbul | Open |
| Default 127.0.0.1 binding blocks external traffic | Operational | Medium | High | Set `HOST=0.0.0.0` in production environment; document in deployment guide | Open |
| No HTTPS/TLS termination | Security | Medium | Medium | Deploy behind a reverse proxy (nginx, HAProxy) that terminates TLS; HSTS header already set | Open |
| No process manager for crash recovery | Operational | Medium | Medium | Use systemd, PM2, or container orchestration to auto-restart on failure | Open |
| No rate limiting on endpoints | Security | Low | Low | Add rate limiting middleware or use reverse proxy rate limiting for production exposure | Open |
| Stdout-only logging without rotation | Operational | Low | Medium | Pipe stdout to a log aggregator or use logrotate for file-based logging | Open |
| No CI/CD pipeline for automated testing | Integration | Low | High | Set up GitHub Actions or similar CI to run `npm test` on every PR (out of AAP scope) | Open |
| Node.js built-in test runner maturity | Technical | Low | Low | `node:test` is stable since v20.0.0; extensive community adoption; minimal risk | Mitigated |

---

## 7. Visual Project Status

### Project Hours Distribution

```mermaid
pie title Project Hours Breakdown
    "Completed Work" : 64
    "Remaining Work" : 9
```

### Remaining Work by Priority

| Priority | Hours (After Multiplier) | Categories |
|----------|------------------------|------------|
| 🔴 High | 5.0 | Human Code Review (3.0h), Production Environment Config (2.0h) |
| 🟡 Medium | 3.0 | Security Compliance Audit (1.5h), Performance & Load Testing (1.5h) |
| 🟢 Low | 1.0 | Documentation Final Review (1.0h) |
| **Total** | **9.0** | |

### Test Results Summary

```
Tests:    79 passed | 0 failed | 0 skipped | 0 cancelled
Suites:   18
Duration: 117ms
Result:   ✅ ALL PASSING
```

---

## 8. Summary & Recommendations

### Achievement Summary

The Blitzy autonomous agents successfully completed **all 22 deliverables** specified in the Agent Action Plan, delivering a fully refactored production-grade Node.js HTTP server architecture. The project is **87.7% complete** (64h completed out of 73h total), with the remaining 9 hours consisting entirely of human-driven path-to-production tasks — no AAP deliverables are outstanding.

The refactoring transformed a 14-line monolithic `server.js` into a well-structured 10-module application with 778 lines of production source code and 1,876 lines of test code. All 79 tests pass with zero failures, the server demonstrates correct runtime behavior across all HTTP methods and paths, and zero issues were found during the Final Validator's comprehensive review.

### Critical Path to Production

1. **Human Code Review (3.0h):** All 10 source modules and 7 test files require human sign-off before production deployment. Code is clean and well-documented, but organizational review processes must be completed.
2. **Production Environment Configuration (2.0h):** Configure `HOST`, `PORT`, and `NODE_ENV` for the production environment. Change `HOST` from `127.0.0.1` to `0.0.0.0` (or specific interface) for external access.
3. **Security Compliance Audit (1.5h):** Validate that the 5 security headers meet organizational security policies. Review Strict-Transport-Security max-age and Content-Security-Policy directives for production requirements.

### Production Readiness Assessment

| Dimension | Rating | Rationale |
|-----------|--------|-----------|
| Code Quality | ⭐⭐⭐⭐⭐ | Clean Architecture, SOLID principles, comprehensive JSDoc, consistent patterns |
| Test Coverage | ⭐⭐⭐⭐ | 79 tests covering all modules; missing formal coverage metrics |
| Security | ⭐⭐⭐⭐ | Security headers present; needs TLS termination and rate limiting for public exposure |
| Operational Readiness | ⭐⭐⭐ | Graceful shutdown implemented; needs process manager and log aggregation |
| Documentation | ⭐⭐⭐⭐⭐ | Comprehensive README, inline JSDoc, env template, clear project structure |

### Key Metrics

- **Lines of Code:** 2,873 added, 31 removed (net +2,842)
- **Source Modules:** 10 files, 778 lines
- **Test Files:** 7 files, 1,876 lines, 79 test cases
- **External Dependencies:** 0 (zero)
- **Compilation Errors:** 0
- **Test Failures:** 0
- **Validation Issues Found:** 0

---

## 9. Development Guide

### 9.1 System Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | v20.x LTS (v20.20.0 recommended) | Runtime and built-in test runner |
| npm | v10.x+ (bundled with Node.js) | Package management and script execution |
| Git | v2.x+ | Version control |
| curl | Any | Runtime verification (optional) |

### 9.2 Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd Test1

# Verify Node.js version (must be v20.x or higher)
node -v
# Expected output: v20.20.0 (or similar v20.x)

# Install dependencies (creates node_modules/ — currently empty, no external deps)
npm install

# (Optional) Create environment file from template
cp .env.example .env
# Edit .env to customize HOST, PORT, NODE_ENV as needed
```

### 9.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Server bind address. Use `0.0.0.0` for external access. |
| `PORT` | `3000` | Server listen port. Must be numeric; invalid values fall back to 3000. |
| `NODE_ENV` | `development` | Runtime environment identifier (`development`, `production`, `test`). |

### 9.4 Application Startup

```bash
# Start the server (default: http://127.0.0.1:3000)
node server.js
# OR
npm start

# Start with custom port
PORT=8080 node server.js

# Start with external access
HOST=0.0.0.0 PORT=3000 node server.js

# Expected startup output:
# [2026-03-06T14:20:29.598Z] [INFO] Server running at http://127.0.0.1:3000/
```

### 9.5 Running Tests

```bash
# Run all tests (79 test cases)
npm test

# Expected output:
# tests 79
# suites 18
# pass 79
# fail 0
# cancelled 0
# skipped 0
# duration_ms ~120

# Run tests with coverage (experimental)
node --test --experimental-test-coverage tests/
```

### 9.6 Verification Steps

```bash
# Start the server in the background
node server.js &

# Verify GET response
curl -s http://127.0.0.1:3000/
# Expected: Hello, World!

# Verify response headers
curl -sI http://127.0.0.1:3000/
# Expected headers include:
#   HTTP/1.1 200 OK
#   X-Content-Type-Options: nosniff
#   X-Frame-Options: DENY
#   X-XSS-Protection: 0
#   Strict-Transport-Security: max-age=31536000; includeSubDomains
#   Content-Security-Policy: default-src 'none'
#   Content-Type: text/plain

# Verify POST (should return same response)
curl -s -X POST http://127.0.0.1:3000/anything
# Expected: Hello, World!

# Stop the server
kill %1
```

### 9.7 Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| `EADDRINUSE: address already in use` | Port 3000 is occupied by another process | Run `lsof -i :3000` to find the process, then `kill <PID>`, or use `PORT=3001 node server.js` |
| `EACCES: permission denied` | Trying to bind to a privileged port (<1024) | Use a port ≥1024, or run with elevated privileges (not recommended) |
| `npm test` shows 0 tests | Incorrect Node.js version (<20) | Upgrade to Node.js v20.x LTS; `node:test` is stable since v20.0.0 |
| Server unreachable from other machines | HOST defaults to 127.0.0.1 (loopback only) | Set `HOST=0.0.0.0` to bind to all interfaces |
| Non-numeric PORT value | PORT env var set to non-integer string | Config module auto-falls back to port 3000; set a valid integer |

---

## 10. Appendices

### A. Command Reference

| Command | Description |
|---------|-------------|
| `node server.js` | Start the HTTP server |
| `npm start` | Start the HTTP server via npm script |
| `npm test` | Run all 79 tests using Node.js built-in test runner |
| `node --test tests/` | Run tests directly (equivalent to `npm test`) |
| `node --test --experimental-test-coverage tests/` | Run tests with experimental coverage reporting |
| `node -c <file.js>` | Syntax-check a JavaScript file without executing |
| `PORT=8080 node server.js` | Start server on custom port |
| `HOST=0.0.0.0 node server.js` | Start server accessible on all network interfaces |

### B. Port Reference

| Port | Service | Default |
|------|---------|---------|
| 3000 | HTTP Server | Yes — configurable via `PORT` env var |

### C. Key File Locations

| File | Purpose |
|------|---------|
| `server.js` | Application entry point (thin bootstrapper) |
| `src/app.js` | Application factory — composes middleware pipeline |
| `src/server.js` | HTTP server creation and binding logic |
| `src/config/index.js` | Centralized configuration from environment variables |
| `src/handlers/helloHandler.js` | Request handler — returns Hello World response |
| `src/middleware/securityHeaders.js` | Security HTTP response headers |
| `src/middleware/requestLogger.js` | HTTP request/response lifecycle logging |
| `src/middleware/errorHandler.js` | Catch-all error handling middleware |
| `src/utils/logger.js` | Structured logging utility |
| `src/utils/gracefulShutdown.js` | SIGINT/SIGTERM graceful shutdown handler |
| `package.json` | Project manifest — scripts, engines, metadata |
| `.env.example` | Environment variable template |
| `.gitignore` | Git exclusion patterns |
| `.nvmrc` | Node.js version pin (20) |
| `tests/unit/` | Unit test files (6 files) |
| `tests/integration/` | Integration test files (1 file) |

### D. Technology Versions

| Technology | Version | Notes |
|-----------|---------|-------|
| Node.js | v20.20.0 LTS | Runtime; minimum >=18.0.0 per package.json engines |
| npm | v11.1.0 | Package manager (bundled with Node.js) |
| node:test | Built-in (Node.js v20+) | Test runner — stable since v20.0.0 |
| node:assert | Built-in | Assertion library — strictEqual, deepStrictEqual, match |
| http | Built-in | HTTP server creation (Node.js core module) |

### E. Environment Variable Reference

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `HOST` | String | `127.0.0.1` | No | Server bind address |
| `PORT` | Integer | `3000` | No | Server listen port (validated; non-numeric falls back to 3000) |
| `NODE_ENV` | String | `development` | No | Runtime environment (`development`, `production`, `test`) |

### F. Developer Tools Guide

| Tool | Usage | Command |
|------|-------|---------|
| Node.js built-in test runner | Execute test suites | `npm test` |
| Node.js syntax checker | Validate JS syntax without execution | `node -c src/app.js` |
| curl | HTTP request testing | `curl -sD - http://127.0.0.1:3000/` |
| lsof | Port conflict debugging | `lsof -i :3000` |
| nvm | Node.js version management | `nvm use` (reads `.nvmrc`) |

### G. Glossary

| Term | Definition |
|------|-----------|
| Clean Architecture | Software design philosophy separating concerns into layers with dependencies pointing inward |
| SOLID | Five principles of object-oriented design: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion |
| Middleware | Functions in the request processing pipeline with signature `(req, res, next)` that can modify request/response or pass control |
| Factory Pattern | Creational design pattern where a function creates and returns configured objects (here: `createApp()` returns an `http.Server`) |
| Graceful Shutdown | Process of stopping a server by completing in-flight requests before closing connections, triggered by OS signals |
| EADDRINUSE | Node.js error code indicating the requested port is already occupied by another process |
| HSTS | HTTP Strict Transport Security — header instructing browsers to only use HTTPS connections |
| CSP | Content Security Policy — header controlling which resources the browser is allowed to load |