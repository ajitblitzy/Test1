# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification

### 0.1.1 Core Refactoring Objective

Based on the prompt, the Blitzy platform understands that the refactoring objective is to transform a minimal, single-file Node.js HTTP server (`server.js` — 14 lines) into a **production-grade application** while preserving its existing behavior: responding with `200 OK`, `Content-Type: text/plain`, and `Hello, World!\n` to every HTTP request regardless of method, path, or payload.

- **Refactoring type:** Code structure + Design pattern + Modularity + Error handling + Security hardening
- **Target repository:** Same repository (in-place refactoring)
- **Refactoring goals with enhanced clarity:**
  - **Clean Architecture:** Decompose the monolithic `server.js` into separated layers — configuration, server infrastructure, request handling, middleware, logging, and application entry point — following separation of concerns
  - **SOLID Principles:** Apply Single Responsibility (each module owns one concern), Open/Closed (extensible middleware pipeline without modifying core), and Dependency Inversion (inject dependencies like logger and config rather than hardcoding)
  - **Readability:** Replace the single anonymous callback pattern with named, well-documented modules and functions that clearly express intent
  - **Performance Optimization:** Add graceful shutdown hooks, proper connection management, and HTTP keep-alive awareness without over-engineering a static-response server
  - **Maintainability:** Introduce a coherent folder structure, consistent module patterns, and configuration externalization so future changes are localized
  - **Testability:** Structure the code so the HTTP handler, server creation, and configuration are independently testable without starting a live server
  - **Error Handling:** Add `server.on('error', ...)` listeners for `EADDRINUSE` and other startup failures, uncaught exception handlers, and graceful shutdown on `SIGINT`/`SIGTERM`
  - **Logging:** Replace the single `console.log` with a lightweight, structured logging approach that covers startup, request lifecycle, errors, and shutdown events
  - **Security Best Practices:** Add security-oriented HTTP response headers, restrict allowed HTTP methods where appropriate, and configure server timeouts to mitigate slowloris-style attacks

- **Implicit requirements surfaced:**
  - A `package.json` must be introduced to manage scripts, metadata, and any minimal production dependencies
  - Environment variable support must be added for configuration (hostname, port) to replace hardcoded constants
  - The `.gitignore` file should be created to exclude `node_modules/` and environment files
  - Unit test infrastructure must be scaffolded to demonstrate testability
  - README.md must be updated to reflect the new project structure and startup instructions

### 0.1.2 Technical Interpretation

This refactoring translates to the following technical transformation strategy:

- **Current architecture:** Single-file monolith (`server.js`) with all concerns (configuration, server creation, request handling, logging) inlined in 14 lines using only the Node.js built-in `http` module
- **Target architecture:** Layered modular structure following Clean Architecture principles, where each concern is isolated into its own module within a `src/` directory, with a thin entry-point file at the root that composes the layers together

**Architecture Mapping:**

| Current Concern | Current Location | Target Module | Target Location |
|----------------|-----------------|--------------|----------------|
| Configuration constants | `server.js` lines 3–4 | Config module | `src/config/index.js` |
| HTTP server creation | `server.js` lines 1, 6, 12 | Server module | `src/server.js` |
| Request handler | `server.js` lines 6–10 | Handler module | `src/handlers/helloHandler.js` |
| Startup logging | `server.js` lines 12–14 | Logger module | `src/utils/logger.js` |
| Middleware pipeline | Not present | Middleware modules | `src/middleware/*.js` |
| Error handling | Not present | Error handler | `src/middleware/errorHandler.js` |
| Security headers | Not present | Security middleware | `src/middleware/securityHeaders.js` |
| Graceful shutdown | Not present | Shutdown handler | `src/utils/gracefulShutdown.js` |
| Application bootstrap | `server.js` lines 1–14 | App entry point | `src/app.js` |
| Process entry point | `server.js` | Thin wrapper | `server.js` |

**Transformation rules:**
- Every distinct concern in `server.js` becomes its own module with a single, well-defined responsibility
- Configuration values become environment-variable-backed with sensible defaults matching the current hardcoded values (`127.0.0.1`, `3000`)
- The request handler is extracted as a pure function that receives `req` and `res` and can be tested in isolation
- Middleware is composed as a chain of functions applied before the handler, following the Node.js middleware pattern
- The entry-point `server.js` remains at the root but becomes a thin bootstrapper that imports and starts the app

## 0.2 Source Analysis

### 0.2.1 Comprehensive Source File Discovery

The repository contains **4 files across 3 directories**. The sole executable artifact is `server.js` (14 lines) — every other file is documentation. The following exhaustive inventory was derived through `get_source_folder_contents` on the root, `blitzy/`, and `blitzy/documentation/` directories, supplemented by `read_file` on `server.js` and `README.md`.

**Current Structure:**

```
Test1/
├── server.js                                    (14 lines — sole application code; ALL concerns inlined)
├── README.md                                    (121 lines — project documentation)
└── blitzy/
    └── documentation/
        ├── Project Guide.md                     (248 lines — task report, validation results, development guide)
        └── Technical Specifications.md          (437 lines — scope, constraints, coverage targets)
```

### 0.2.2 Source File Analysis

**`server.js` — Primary refactoring target (14 lines)**

| Line(s) | Concern | Code | Code Smell / Issue |
|---------|---------|------|-------------------|
| 1 | Module import | `const http = require('http');` | Only built-in import; no structure for extensibility |
| 3 | Configuration | `const hostname = '127.0.0.1';` | Hardcoded — not configurable via environment |
| 4 | Configuration | `const port = 3000;` | Hardcoded — not configurable via environment |
| 6–10 | Request handling | `http.createServer((req, res) => { ... })` | Anonymous callback mixes server creation with handling; `req` ignored entirely; no logging, no error handling, no security headers |
| 7 | Response status | `res.statusCode = 200;` | No handling for different request scenarios |
| 8 | Response header | `res.setHeader('Content-Type', 'text/plain');` | No security headers (X-Content-Type-Options, etc.) |
| 9 | Response body | `res.end('Hello, World!\n');` | Static response — correct for business logic preservation |
| 12–14 | Server binding + logging | `server.listen(port, hostname, () => { ... })` | No error listener for EADDRINUSE; no graceful shutdown; single console.log for startup only |

**Code smells and architectural issues identified:**

- **God file anti-pattern:** All application concerns (config, server, handler, logging) reside in a single 14-line file with no separation
- **No error handling:** Zero `try/catch` blocks, zero `server.on('error', ...)` listeners, zero uncaught exception handling — `EADDRINUSE` crashes the process silently
- **No graceful shutdown:** No `SIGINT`/`SIGTERM` handlers — server terminates immediately on Ctrl+C without closing connections
- **No request logging:** Incoming requests are completely invisible — no method, path, status, or response-time logging
- **Hardcoded configuration:** `hostname` and `port` are constants with no environment variable override
- **No security headers:** Response lacks `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, or `Content-Security-Policy`
- **No package.json:** No dependency manifest, no scripts, no metadata, no engine constraints
- **No test infrastructure:** Zero test files, zero testable module exports
- **No .gitignore:** No exclusion patterns for `node_modules/`, `.env`, or IDE files
- **Anonymous handler:** The request callback is not exported or named, making it untestable in isolation

**`README.md` — Documentation (121 lines)**

- Documents the current single-file architecture, prerequisites (Node.js v4+), configuration table, API behavior, and project structure
- Must be updated to reflect the new multi-module structure, new startup instructions, environment variable configuration, and testing commands

### 0.2.3 Complete Source File Inventory

| File Path | Type | Lines | Refactoring Action Required |
|-----------|------|-------|---------------------------|
| `server.js` | Application code | 14 | **Primary target** — decompose into modular structure |
| `README.md` | Documentation | 121 | **Update** — reflect new structure, config, scripts, tests |
| `blitzy/documentation/Project Guide.md` | Documentation | 248 | No changes required — historical record |
| `blitzy/documentation/Technical Specifications.md` | Documentation | 437 | No changes required — spec artifact |

## 0.3 Scope Boundaries

### 0.3.1 Exhaustively In Scope

**Source transformations:**
- `server.js` — Primary refactoring target; decompose into modular layers
- `src/**/*.js` — All new JavaScript source modules created during refactoring
- `src/config/*.js` — Configuration management module(s)
- `src/handlers/*.js` — Extracted request handler(s)
- `src/middleware/*.js` — New middleware modules (security, logging, error handling)
- `src/utils/*.js` — Utility modules (logger, graceful shutdown)
- `src/app.js` — Application composition and bootstrap
- `src/server.js` — Server creation and binding logic

**Test infrastructure:**
- `tests/**/*.test.js` — New unit and integration test files
- `tests/handlers/*.test.js` — Handler-specific tests
- `tests/middleware/*.test.js` — Middleware-specific tests
- `tests/config/*.test.js` — Configuration module tests
- `tests/integration/*.test.js` — Server integration tests (HTTP response validation)

**Configuration and project setup:**
- `package.json` — New dependency manifest with scripts, metadata, and engine constraints
- `.gitignore` — New Git exclusion patterns for `node_modules/`, `.env`, coverage output
- `.env.example` — New template for environment variable configuration
- `.nvmrc` — Node.js version pinning file

**Documentation updates:**
- `README.md` — Update to reflect new project structure, installation, configuration, testing, and usage instructions

**Import corrections:**
- Every new module under `src/` that references another module requires correct relative imports
- The root `server.js` must import the composed application from `src/app.js`

### 0.3.2 Explicitly Out of Scope

The following items are explicitly excluded from this refactoring, as directed by the user's constraints and the preservation-of-behavior requirement:

| Category | Exclusion | Rationale |
|----------|-----------|-----------|
| Business logic changes | Response body, status code, or Content-Type modification | User constraint: "Do not change business logic" |
| Framework adoption | Express.js, Fastify, Koa, or any HTTP framework | User constraint: "Do not introduce unnecessary dependencies" |
| TypeScript migration | Converting to TypeScript with `tsconfig.json` | User constraint: "Keep the code simple and understandable" |
| Database integration | Adding any data persistence layer | No business requirement; static response server |
| Authentication/Authorization | Adding auth middleware or identity management | No business requirement for a Hello World server |
| Containerization | Dockerfile, docker-compose, or Kubernetes manifests | Beyond the scope of code refactoring |
| CI/CD pipeline | GitHub Actions, GitLab CI, or similar automation | Beyond the scope of code refactoring |
| HTTPS/TLS | SSL certificate management or HTTPS server | Can be added as a future enhancement; loopback default is sufficient |
| External logging services | Integration with ELK, Datadog, Splunk, etc. | User constraint: "Do not introduce unnecessary dependencies" |
| Routing logic | Adding path-based routing or method dispatch | Would change existing behavior (all paths return same response) |
| `blitzy/` documentation | Modifications to Project Guide.md or Technical Specifications.md | Historical documentation artifacts — not application code |

## 0.4 Target Design

### 0.4.1 Refactored Structure Planning

The target architecture follows Clean Architecture principles adapted for a lightweight Node.js HTTP server. Each module has a single responsibility, dependencies flow inward, and the core business logic (the Hello World response) remains untouched at the center.

**Target Architecture:**

```
Test1/
├── server.js                        (thin entry point — bootstraps app)
├── package.json                     (dependency manifest, scripts, engine constraints)
├── .env.example                     (environment variable template)
├── .gitignore                       (exclusion patterns)
├── .nvmrc                           (Node.js version pin)
├── README.md                        (updated documentation)
├── src/
│   ├── app.js                       (application factory — composes server with middleware and handler)
│   ├── server.js                    (HTTP server creation and binding logic)
│   ├── config/
│   │   └── index.js                 (centralized configuration from environment variables with defaults)
│   ├── handlers/
│   │   └── helloHandler.js          (extracted request handler — pure function)
│   ├── middleware/
│   │   ├── requestLogger.js         (HTTP request/response logging middleware)
│   │   ├── securityHeaders.js       (security-oriented HTTP response headers)
│   │   └── errorHandler.js          (catch-all error handling middleware)
│   └── utils/
│       ├── logger.js                (structured logging utility wrapping console)
│       └── gracefulShutdown.js      (SIGINT/SIGTERM shutdown handler)
├── tests/
│   ├── unit/
│   │   ├── handlers/
│   │   │   └── helloHandler.test.js (unit tests for the request handler)
│   │   ├── middleware/
│   │   │   ├── requestLogger.test.js
│   │   │   ├── securityHeaders.test.js
│   │   │   └── errorHandler.test.js
│   │   ├── config/
│   │   │   └── config.test.js       (configuration module tests)
│   │   └── utils/
│   │       └── logger.test.js       (logger utility tests)
│   └── integration/
│       └── server.test.js           (end-to-end HTTP response validation)
└── blitzy/
    └── documentation/               (unchanged — historical artifacts)
        ├── Project Guide.md
        └── Technical Specifications.md
```

### 0.4.2 Web Search Research Conducted

The following research informed the target design decisions:

- **Node.js production server clean architecture best practices (2025):** Confirmed the layered separation pattern — `config/`, `handlers/`, `middleware/`, `utils/` — as the recommended approach for modular Node.js servers. Key insight: separate server creation from server startup for testability.
- **Node.js SOLID principles refactoring patterns:** Validated the Single Responsibility decomposition strategy (one module per concern) and the Dependency Inversion approach (inject config and logger rather than importing global state). Research emphasized pragmatic application over dogmatic adherence — avoid premature abstraction for a minimal server.
- **Node.js best practices 2026:** Confirmed environment variable configuration via `.env.example` templates, structured logging over raw `console.log`, graceful shutdown handling via process signals, and `package.json` engine constraints as production essentials.

### 0.4.3 Design Pattern Applications

| Pattern | Application in Target | Benefit |
|---------|----------------------|---------|
| **Factory pattern** | `src/app.js` creates and returns a configured server instance | Enables test environments to create servers without binding to a port |
| **Middleware chain** | `requestLogger.js`, `securityHeaders.js`, `errorHandler.js` composed as a pipeline | Each middleware has single responsibility; new concerns added without modifying existing code (Open/Closed) |
| **Dependency injection** | Logger and config are passed as parameters to modules that need them | Modules are decoupled from concrete implementations; enables mocking in tests |
| **Configuration externalization** | `src/config/index.js` reads `process.env` with fallback defaults | Environment-specific settings without code changes; twelve-factor app compliance |
| **Separation of concerns** | Handler, middleware, config, logging, and server lifecycle each in own module | Changes to logging don't affect handlers; changes to security headers don't affect error handling |

### 0.4.4 SOLID Principles Mapping

| Principle | How It Is Applied |
|-----------|-------------------|
| **Single Responsibility (SRP)** | Each file has exactly one reason to change: `helloHandler.js` changes only if response logic changes; `logger.js` changes only if logging format changes; `config/index.js` changes only if new configuration keys are added |
| **Open/Closed (OCP)** | The middleware pipeline in `app.js` is open for extension (add new middleware) but closed for modification (existing middleware remains untouched) |
| **Liskov Substitution (LSP)** | The logger utility follows a consistent interface (`info`, `warn`, `error`) that could be swapped for any compatible implementation |
| **Interface Segregation (ISP)** | Each middleware exports a single function with a focused signature `(req, res, next)` — consumers depend only on what they need |
| **Dependency Inversion (DIP)** | High-level modules (`app.js`) depend on abstractions (config object, logger interface) rather than concrete implementations; the config module abstracts `process.env` access |

## 0.5 Transformation Mapping

### 0.5.1 File-by-File Transformation Plan

The entire refactoring is executed in **one phase**. Every target file is mapped to its source origin, transformation mode, and key changes.

| Target File | Transformation | Source File | Key Changes |
|------------|---------------|-------------|-------------|
| `server.js` | UPDATE | `server.js` | Reduce to a thin entry point that imports `src/app.js` and calls the start function; remove all inlined logic |
| `src/app.js` | CREATE | `server.js` | New application factory — composes the HTTP server with middleware pipeline (`securityHeaders` → `requestLogger` → `helloHandler` → `errorHandler`), exports `createApp()` and `startServer()` functions for testability |
| `src/server.js` | CREATE | `server.js` | Extract `http.createServer()` and `server.listen()` logic into a dedicated module; add `server.on('error', ...)` listener for `EADDRINUSE` and permission errors; export factory function |
| `src/config/index.js` | CREATE | `server.js` | Extract `hostname` and `port` constants; read from `process.env.HOST` and `process.env.PORT` with fallback defaults of `'127.0.0.1'` and `3000`; freeze the config object to prevent mutation |
| `src/handlers/helloHandler.js` | CREATE | `server.js` | Extract the anonymous `(req, res) => { ... }` callback into a named, exported function; preserve exact response behavior (`200`, `text/plain`, `Hello, World!\n`) |
| `src/middleware/requestLogger.js` | CREATE | — | New module — logs each incoming request (method, URL, status code, response time) using the logger utility; wraps the handler and calls next |
| `src/middleware/securityHeaders.js` | CREATE | — | New module — sets production security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, `Strict-Transport-Security`, `Content-Security-Policy: default-src 'none'`) on every response |
| `src/middleware/errorHandler.js` | CREATE | — | New module — catch-all error handler that logs unexpected errors and returns `500 Internal Server Error` with a safe message; prevents stack trace leakage |
| `src/utils/logger.js` | CREATE | — | New module — structured logging utility wrapping `console` methods; provides `info()`, `warn()`, `error()` with ISO timestamp prefix and log level; lightweight, zero-dependency |
| `src/utils/gracefulShutdown.js` | CREATE | — | New module — registers `SIGINT` and `SIGTERM` handlers; closes the HTTP server gracefully with a configurable timeout; logs shutdown events |
| `package.json` | CREATE | — | New dependency manifest with project name, version, description, `main` entry point, `scripts` (start, test), `engines` field constraining Node.js >=18.0.0, and test framework dependency |
| `.env.example` | CREATE | — | New environment variable template documenting `HOST`, `PORT`, and `NODE_ENV` with example values |
| `.gitignore` | CREATE | — | New exclusion patterns: `node_modules/`, `.env`, `coverage/`, `*.log` |
| `.nvmrc` | CREATE | — | Pin Node.js version to `20` for development environment consistency |
| `README.md` | UPDATE | `README.md` | Update project structure section, add installation instructions (`npm install`), document environment variables, add testing instructions (`npm test`), update configuration table |
| `tests/unit/handlers/helloHandler.test.js` | CREATE | `src/handlers/helloHandler.js` | Unit tests validating response status code, Content-Type header, and body for the extracted handler |
| `tests/unit/middleware/requestLogger.test.js` | CREATE | `src/middleware/requestLogger.js` | Unit tests verifying logging output for requests |
| `tests/unit/middleware/securityHeaders.test.js` | CREATE | `src/middleware/securityHeaders.js` | Unit tests verifying all security headers are set on responses |
| `tests/unit/middleware/errorHandler.test.js` | CREATE | `src/middleware/errorHandler.js` | Unit tests verifying error responses and stack trace suppression |
| `tests/unit/config/config.test.js` | CREATE | `src/config/index.js` | Tests for environment variable reading, defaults, and config immutability |
| `tests/unit/utils/logger.test.js` | CREATE | `src/utils/logger.js` | Tests for log output format, level methods, and timestamp inclusion |
| `tests/integration/server.test.js` | CREATE | `server.js` | Integration tests: start server, send HTTP requests, assert `200 OK`, `text/plain`, `Hello, World!\n`; test all methods (GET, POST, PUT, DELETE); test all paths |

### 0.5.2 Cross-File Dependencies

**Import statement updates (new modules):**

- `server.js` (root):
  - FROM: `const http = require('http');` (and all inline logic)
  - TO: `const { startServer } = require('./src/app');`

- `src/app.js`:
  - TO: `const config = require('./config');`
  - TO: `const { createServer } = require('./server');`
  - TO: `const { helloHandler } = require('./handlers/helloHandler');`
  - TO: `const { requestLogger } = require('./middleware/requestLogger');`
  - TO: `const { securityHeaders } = require('./middleware/securityHeaders');`
  - TO: `const { errorHandler } = require('./middleware/errorHandler');`
  - TO: `const { logger } = require('./utils/logger');`
  - TO: `const { gracefulShutdown } = require('./utils/gracefulShutdown');`

- `src/server.js`:
  - TO: `const http = require('http');` (built-in module moved here)
  - TO: `const { logger } = require('./utils/logger');`

- `src/middleware/requestLogger.js`:
  - TO: `const { logger } = require('../utils/logger');`

- `src/middleware/errorHandler.js`:
  - TO: `const { logger } = require('../utils/logger');`

- `src/utils/gracefulShutdown.js`:
  - TO: `const { logger } = require('./logger');`

**Configuration updates:**
- `package.json` → `scripts.start` points to `node server.js`
- `package.json` → `scripts.test` points to the test runner
- `package.json` → `engines.node` constrains to `>=18.0.0`

**Test file import corrections:**
- `tests/**/*.test.js` — Each test file imports its corresponding source module using relative paths from the `tests/` directory

### 0.5.3 Wildcard Pattern Summary

| Pattern | Transformation | Description |
|---------|---------------|-------------|
| `src/**/*.js` | CREATE | All new application source modules |
| `src/middleware/*.js` | CREATE | All middleware modules (security, logging, error) |
| `src/utils/*.js` | CREATE | All utility modules (logger, graceful shutdown) |
| `tests/unit/**/*.test.js` | CREATE | All unit test files |
| `tests/integration/*.test.js` | CREATE | All integration test files |

### 0.5.4 One-Phase Execution

The entire refactoring — all 22 files listed above — will be executed by Blitzy in a single phase. There is no phased rollout, no incremental migration, and no feature-flag gating. All source decomposition, test creation, configuration, and documentation updates ship together as one atomic change.

## 0.6 Dependency Inventory

### 0.6.1 Key Packages

The refactoring prioritizes the user's constraint — "Do not introduce unnecessary dependencies" — by leveraging Node.js built-in modules wherever possible. The project transitions from having zero dependencies and no `package.json` to a minimal dependency manifest that relies almost exclusively on Node.js core capabilities.

**Runtime Dependencies:**

| Registry | Package Name | Version | Purpose |
|----------|-------------|---------|---------|
| Node.js built-in | `http` | (bundled with Node.js) | HTTP server creation — already used in current `server.js` |
| Node.js built-in | `process` | (bundled with Node.js) | Environment variables (`process.env`), signal handling (`SIGINT`, `SIGTERM`) |
| Node.js built-in | `os` | (bundled with Node.js) | Hostname detection for logging context |

**Development Dependencies:**

| Registry | Package Name | Version | Purpose |
|----------|-------------|---------|---------|
| Node.js built-in | `node:test` | (bundled with Node.js >=20) | Built-in test runner — stable since Node.js v20; provides `describe()`, `it()`, `test()`, `mock`, hooks |
| Node.js built-in | `node:assert` | (bundled with Node.js) | Built-in assertion library — `strictEqual`, `deepStrictEqual`, `throws`, `match` |

**Zero external npm packages are introduced.** The Node.js v20 built-in test runner (`node:test`) and assertion module (`node:assert`) provide complete test infrastructure without requiring Jest, Mocha, Supertest, or any third-party testing framework. This directly honors the user's constraint against unnecessary dependencies while simultaneously eliminating all supply-chain security risk — a core security best practice.

### 0.6.2 Dependency Updates

**Import Refactoring:**

The current `server.js` contains a single import (`require('http')`). After refactoring, import statements are distributed across all new modules:

- `src/**/*.js` — Internal cross-module imports using relative paths
- `tests/**/*.test.js` — Test imports referencing source modules and `node:test`/`node:assert`

**Import transformation rules:**

| Module | Old Import | New Import | Applies To |
|--------|-----------|------------|------------|
| HTTP | `const http = require('http');` in root `server.js` | `const http = require('http');` in `src/server.js` | `src/server.js` only |
| App bootstrap | (all logic inline in `server.js`) | `const { startServer } = require('./src/app');` | Root `server.js` |
| Config | (hardcoded `const hostname`, `const port`) | `const config = require('./config');` | `src/app.js`, `src/server.js` |
| Logger | (single `console.log`) | `const { logger } = require('./utils/logger');` | `src/app.js`, `src/server.js`, `src/middleware/*.js` |
| Test runner | (not present) | `const { describe, it } = require('node:test');` | `tests/**/*.test.js` |
| Assertions | (not present) | `const assert = require('node:assert');` | `tests/**/*.test.js` |

### 0.6.3 External Reference Updates

| File Pattern | Update Required |
|-------------|----------------|
| `package.json` | New file — define `name`, `version`, `description`, `main`, `scripts` (`start`, `test`), `engines` (`node >=18.0.0`) |
| `README.md` | Update installation steps to include `npm install`; add `npm test` instruction; document environment variables |
| `.env.example` | New file — document `HOST=127.0.0.1`, `PORT=3000`, `NODE_ENV=development` |
| `.nvmrc` | New file — pin `20` for Node.js version management |
| `.gitignore` | New file — exclude `node_modules/`, `.env`, `coverage/`, `*.log` |

### 0.6.4 Package.json Specification

The new `package.json` will contain the following structure:

```json
{
  "name": "test1",
  "version": "1.0.0",
  "description": "Production-grade Node.js HTTP server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/**/*.test.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- **No `dependencies`** — all runtime functionality uses Node.js built-ins
- **No `devDependencies`** — testing uses the Node.js built-in `node:test` runner
- **`engines.node`** — constrains to `>=18.0.0` to guarantee access to the stable `node:test` runner (stable since v20, experimental since v18)

## 0.7 Refactoring Rules

### 0.7.1 User-Specified Refactoring Rules

The user has provided explicit constraints and directives that must be honored throughout every transformation. These are captured verbatim below and elaborated with their technical implications.

**User Rule: "Do not change business logic."**
- The sole business behavior is: every HTTP request (regardless of method, path, or headers) receives a `200 OK` response with `Content-Type: text/plain` and body `Hello, World!\n`
- After refactoring, this exact behavior must be preserved — same status code, same header, same body, same newline character
- The default hostname (`127.0.0.1`) and port (`3000`) must remain identical when no environment variables override them

**User Rule: "Do not introduce unnecessary dependencies."**
- Zero external npm packages are permitted in both runtime and development dependency manifests
- All test infrastructure must use the Node.js built-in `node:test` and `node:assert` modules exclusively
- All logging must use a thin wrapper around `console` — no external logging libraries (winston, pino, bunyan)
- All configuration must use `process.env` directly — no dotenv or config packages

**User Rule: "Keep the code simple and understandable."**
- Each module must have a single, clear responsibility (Single Responsibility Principle)
- No abstractions beyond one level of indirection — no abstract base classes, no complex inheritance hierarchies
- Middleware functions must follow the standard `(req, res, next)` signature pattern
- File names must clearly communicate purpose (`requestLogger.js`, `securityHeaders.js`, `errorHandler.js`)
- Prefer explicit named exports over default exports for clarity and grep-ability

### 0.7.2 Refactoring Quality Focus Areas

The user's prompt explicitly names the following quality dimensions. Each is mapped to concrete implementation criteria:

| Focus Area | Implementation Criteria |
|-----------|----------------------|
| Clean Architecture | Separate config → server → middleware → handler; no cross-cutting in handler |
| SOLID Principles | SRP (one file = one concern), OCP (middleware chain extensible), DIP (inject logger and config) |
| Readability | Descriptive function and file names; JSDoc comments on all exported functions; consistent formatting |
| Performance Optimization | Avoid synchronous I/O in hot path; pre-compute static response buffer; keep middleware pipeline lean |
| Maintainability | Modular file structure; clear import graph; no circular dependencies; consistent error propagation |
| Testability | Factory pattern for server creation; pure handler functions; injectable dependencies; exported units |
| Error Handling | `server.on('error', ...)` for bind errors; try/catch in middleware; uncaught exception handler; graceful shutdown |
| Logging | Structured log output with timestamp and request metadata; log levels (info, warn, error); request lifecycle logging |
| Security Best Practices | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `X-Powered-By` removal |

### 0.7.3 Behavioral Preservation Checklist

The following behaviors must be verified as identical before and after refactoring:

- `GET /` returns status `200`, body `Hello, World!\n`, header `Content-Type: text/plain`
- `POST /anything` returns the same response (universal handler, no route discrimination)
- `PUT /foo/bar` returns the same response
- Any HTTP method on any path returns the same response
- Server binds to `127.0.0.1:3000` by default
- Console output on startup includes the server URL

### 0.7.4 Special Instructions and Constraints

- **No TypeScript:** The refactoring stays within JavaScript (CommonJS `require`/`module.exports`) as documented in the tech spec
- **No framework adoption:** Express, Koa, Fastify, and Hapi are out of scope; the server must remain a raw `http.createServer()` implementation
- **No external process managers:** PM2, nodemon, and forever are not introduced — the server runs as a direct `node` process
- **Backward compatibility:** The refactored `server.js` at the project root remains the entry point (`node server.js`), preserving the same startup command
- **Environment variable defaults:** `HOST` defaults to `127.0.0.1`, `PORT` defaults to `3000`, `NODE_ENV` defaults to `development` — these match the current hardcoded values exactly

### 0.7.5 Unit Test Case Directives

The user requests unit test case suggestions. The following test cases must be created:

**Handler tests (`tests/unit/handlers/helloHandler.test.js`):**
- Responds with status code 200
- Responds with `Content-Type: text/plain`
- Response body is exactly `Hello, World!\n`
- Handler calls `res.end()` to complete the response

**Middleware tests (`tests/unit/middleware/`):**
- Security headers middleware sets all expected headers on the response
- Request logger middleware logs method, URL, and response time
- Error handler middleware returns 500 on unhandled errors

**Config tests (`tests/unit/config/config.test.js`):**
- Default hostname is `127.0.0.1` when `HOST` env var is unset
- Default port is `3000` when `PORT` env var is unset
- Environment variable overrides are applied correctly

**Integration tests (`tests/integration/server.test.js`):**
- Server starts and listens on the configured host and port
- Full HTTP request/response cycle returns expected output
- Server shuts down gracefully on SIGTERM

### 0.7.6 Edge Cases to Consider

- `PORT` set to a non-numeric value — config validation must fallback or throw
- `PORT` set to a privileged port (e.g., `80`) — bind error must be handled gracefully
- `EADDRINUSE` on startup — error handler must log a clear message and exit with non-zero code
- Extremely large request body — since the handler ignores `req`, no buffering occurs and no memory risk exists
- Concurrent connections — the Node.js event loop handles this natively; no special handling required
- Malformed HTTP requests — Node.js `http` module handles parsing; the handler is never invoked on parse failures

### 0.7.7 Security Vulnerability Assessment

The current server has the following security observations relevant to the refactoring:

- **No input processing:** The request object is completely ignored, eliminating injection and parsing attack vectors
- **Loopback binding:** Default bind to `127.0.0.1` prevents external network exposure
- **Missing security headers:** Currently absent — the refactoring adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, and `X-Powered-By` removal
- **No sensitive data exposure:** The static response body contains no sensitive information
- **No HTTPS:** SSL/TLS remains out of scope per scope boundaries, but the `Strict-Transport-Security` header is included for forward compatibility when a reverse proxy terminates TLS

## 0.8 References

### 0.8.1 Codebase Files and Folders Searched

The following files and folders were retrieved and analyzed during the preparation of this Agent Action Plan:

**Repository Files Inspected:**

| File Path | Lines | Purpose | Key Findings |
|-----------|-------|---------|-------------|
| `server.js` | 14 | Sole source file — HTTP server | Monolithic, hardcoded config, no error handling, no tests |
| `README.md` | 121 | Project documentation | Prerequisites (Node.js v4+), API behavior, configuration, structure |

**Repository Folders Explored:**

| Folder Path | Children | Purpose |
|-------------|----------|---------|
| `/` (root) | `README.md`, `server.js`, `blitzy/` | Project root — minimal two-file structure |
| `blitzy/` | `documentation/` | Blitzy platform artifacts |
| `blitzy/documentation/` | `Project Guide.md`, `Technical Specifications.md` | Platform-generated documentation |

**Blitzy Documentation Reviewed:**

| File Path | Lines | Summary |
|-----------|-------|---------|
| `blitzy/documentation/Project Guide.md` | 248 | Task report, validation results, developer guide |
| `blitzy/documentation/Technical Specifications.md` | 437 | Scope, constraints, coverage targets |

### 0.8.2 Tech Spec Sections Referenced

The following sections from the existing Technical Specification were retrieved and used to inform the Agent Action Plan:

| Section | Key Information Extracted |
|---------|------------------------|
| 1.1 Executive Summary | Project is Blitzy platform exploration; deliberate simplicity in 14-line server |
| 3.1 Programming Languages | JavaScript ES6+ (CommonJS); minimum Node.js v4.0.0+ |
| 3.2 Runtime Environment | Node.js v20.20.0 LTS ("Iron"); minimum v4.x+, v20.x recommended |
| 3.4 Open Source Dependencies | Zero dependencies confirmed; no package.json, no lock files |
| 3.9 Security Considerations | Minimal surface; loopback only; no HTTPS; no input validation needed |
| 4.5 Error Handling and Recovery Flows | Error handling absent; no try/catch, no `server.on('error')`, no graceful shutdown |
| 5.1 High-Level Architecture | Monolithic single-file; zero-dependency; stateless; loopback isolation |
| 5.2 Component Details | Features F-001 through F-004; five-state lifecycle; single-process |
| 5.5 Repository Structure | 4 files across 3 directories |
| 6.4 Security Architecture | No auth, no encryption, no sessions; security by minimalism |
| 6.6 Testing Strategy | Zero test infrastructure; constraints block testing; recommends `node:test` or Jest |

### 0.8.3 External Research Conducted

The following web searches were performed to inform refactoring best practices and dependency decisions:

| Search Topic | Key Findings Applied |
|-------------|---------------------|
| Node.js production-grade refactoring best practices | Clean Architecture layer separation; factory pattern for testability; middleware composition |
| Node.js 20 built-in test runner (`node:test`) | Stable since v20.0.0; provides `describe()`, `it()`, `test()`, hooks, mocking; zero-dependency testing |
| Node.js security headers best practices | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `X-Powered-By` removal |
| Node.js graceful shutdown patterns | `SIGINT`/`SIGTERM` signal handlers; `server.close()` with drain timeout |

### 0.8.4 Attachments

No attachments were provided by the user for this project.

### 0.8.5 Figma URLs

No Figma design screens were referenced or provided for this project. This is a backend-only Node.js server refactoring with no user interface components.

