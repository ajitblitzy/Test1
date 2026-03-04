# Project Guide — Staging-Approval Workflow for Node.js HTTP Server

## 1. Executive Summary

This project transforms a minimal 14-line Node.js HTTP server into a full Staging-Approval Workflow system that enforces a strict `submitted → staged → approved → production` promotion pipeline. The implementation maintains zero external dependencies and full backward compatibility.

**Completion Assessment:** 90 hours of development work have been completed out of an estimated 113 total hours required, representing **79.6% project completion**.

- **Completed:** 90 hours (all in-scope AAP deliverables implemented and validated)
- **Remaining:** 23 hours (production readiness, security audit, persistence, deployment)
- **Total Estimated:** 113 hours
- **Formula:** 90h / (90h + 23h) = 90/113 = 79.6%

### Key Achievements
- 24 commits implementing 20 new files and modifying 4 existing files
- 7,821 lines of code added across 11 source modules, 6 test files, and 7 configuration/documentation files
- **109/109 tests passing (100%)** across all 6 test suites
- **13 API endpoints** fully operational and runtime-validated
- Full lifecycle verified: submit → auto-stage → approve → promote → production content served
- Zero compilation errors, zero test failures, zero runtime errors
- Zero external dependencies maintained throughout

### Critical Items Requiring Human Attention
1. Configure production `BLITZY_CLIENT_API_KEY` environment variable (currently defaults to empty string)
2. Comprehensive security audit of authentication middleware and input validation
3. Data persistence strategy — current in-memory store loses state on server restart
4. Production deployment infrastructure setup

---

## 2. Validation Results Summary

### 2.1 Final Validator Outcomes

The Final Validator agent completed comprehensive validation with the following gates:

| Gate | Status | Details |
|------|--------|---------|
| **GATE 1: Test Pass Rate** | ✅ 100% (109/109) | All 6 test suites pass with zero failures |
| **GATE 2: Runtime Validation** | ✅ All 13 endpoints verified | Full lifecycle tested via curl |
| **GATE 3: Zero Errors** | ✅ Clean | 17/17 JS files pass syntax check, zero runtime errors |
| **GATE 4: File Coverage** | ✅ 24/24 files validated | All in-scope files exist and are correct |

### 2.2 Test Results by Suite

| Test Suite | File | Tests Passed | Tests Failed | Total |
|------------|------|-------------|-------------|-------|
| Router Unit Tests | `tests/router.test.js` | 18 | 0 | 18 |
| Requirement Store Tests | `tests/requirementStore.test.js` | 35 | 0 | 35 |
| Requirements Controller Tests | `tests/requirementsController.test.js` | 12 | 0 | 12 |
| Staging Controller Tests | `tests/stagingController.test.js` | 14 | 0 | 14 |
| Approval Controller Tests | `tests/approvalController.test.js` | 21 | 0 | 21 |
| Integration Workflow Tests | `tests/integration/workflow.test.js` | 9 | 0 | 9 |
| **Totals** | | **109** | **0** | **109** |

### 2.3 Compilation and Syntax Validation

All 17 JavaScript files pass `node -c` syntax check with zero errors:
- 1 entry point: `server.js`
- 10 source modules: `src/**/*.js`
- 6 test files: `tests/**/*.test.js`

### 2.4 Runtime Endpoint Validation

| Endpoint | Method | Status Code | Validated |
|----------|--------|-------------|-----------|
| `/` | GET | 200 | ✅ Returns `Hello, World!` (default) |
| `/health` | GET | 200 | ✅ Returns JSON health status with uptime |
| `/api/requirements` | POST | 201 | ✅ Creates and auto-stages requirement |
| `/api/requirements` | GET | 200 | ✅ Lists all requirements |
| `/api/requirements/:id` | GET | 200 | ✅ Returns requirement detail |
| `/staging` | GET | 200 | ✅ Lists staged prototypes |
| `/staging/:id` | GET | 200 | ✅ Returns specific staged prototype |
| `/api/approve/:id` | POST | 200 | ✅ Approves staged requirement (API key required) |
| `/api/reject/:id` | POST | 200 | ✅ Rejects staged requirement (API key required) |
| `/api/promote/:id` | POST | 200 | ✅ Promotes approved requirement to production |
| Non-existent route | GET | 404 | ✅ Returns JSON error |
| Wrong method | DELETE | 405 | ✅ Returns Method Not Allowed |
| Missing API key | POST | 401 | ✅ Returns Unauthorized |

### 2.5 Fixes Applied During Validation

No fixes were required during the validation phase. All 24 files passed all gates on initial validation. The implementation was delivered error-free by the development agents.

---

## 3. Hours Breakdown and Completion Analysis

### 3.1 Completed Work — 90 Hours

| Component | Files | Lines of Code | Hours |
|-----------|-------|---------------|-------|
| Configuration Layer (`config.js`, `package.json`, `.env.example`) | 3 | 239 | 5h |
| Response Utilities (`responseHelper.js`) | 1 | 119 | 3h |
| Data Store & State Machine (`requirementStore.js`) | 1 | 382 | 12h |
| Middleware (`bodyParser.js`, `authGuard.js`) | 2 | 228 | 6h |
| Controllers (production, requirements, staging, approval) | 4 | 820 | 18h |
| Router (`router.js`) | 1 | 335 | 10h |
| Entry Point Modification (`server.js`) | 1 | 16 | 2h |
| Unit Tests (5 test files) | 5 | 2,883 | 16h |
| Integration Tests (`workflow.test.js`) | 1 | 614 | 6h |
| Documentation (README, API ref, workflow guide, Project Guide, Tech Specs) | 5 | 2,947 | 8h |
| Validation, Debugging, and Quality Assurance | — | — | 4h |
| **Total Completed** | **24 files** | **7,583 lines** | **90h** |

### 3.2 Remaining Work — 23 Hours

Base estimate of 16 hours with enterprise multipliers applied (compliance 1.15× and uncertainty buffer 1.25× = 1.4375×) yielding 23 hours total.

| # | Task | Priority | Severity | Hours |
|---|------|----------|----------|-------|
| 1 | Configure production `BLITZY_CLIENT_API_KEY` and validate auth flow | High | Critical | 1.5h |
| 2 | Comprehensive code review of all 11 source modules | High | High | 4h |
| 3 | Security audit: auth guard, input validation, timing attack prevention | High | High | 3h |
| 4 | Production environment deployment setup (process manager, reverse proxy) | Medium | High | 3h |
| 5 | File-based data persistence layer for requirement state durability | Medium | Medium | 4.5h |
| 6 | Structured request logging and audit trail middleware | Medium | Medium | 3h |
| 7 | Graceful shutdown and error recovery handling | Medium | Medium | 1.5h |
| 8 | Performance and load testing under production conditions | Low | Medium | 2.5h |
| **Total Remaining** | | | | **23h** |

### 3.3 Visual Representation

```mermaid
pie title Project Hours Breakdown
    "Completed Work" : 90
    "Remaining Work" : 23
```

### 3.4 Completion Calculation

```
Completed Hours:  90h
Remaining Hours:  23h
Total Hours:     113h
Completion:      90 / 113 = 79.6%
```

---

## 4. Detailed Human Task List

### 4.1 High Priority Tasks (Immediate — Blocks Production)

#### Task 1: Configure Production API Keys (1.5h)

**Description:** The `BLITZY_CLIENT_API_KEY` environment variable currently defaults to an empty string, which means the authentication middleware will reject all requests to approve/reject/promote endpoints. A real API key must be configured.

**Action Steps:**
1. Generate a secure API key (minimum 32 characters, cryptographically random)
2. Set `BLITZY_CLIENT_API_KEY` in the production environment
3. Test authentication by calling `POST /api/approve/:id` with the configured key
4. Verify 401 responses with invalid/missing keys
5. Document key rotation procedure

**Severity:** Critical — Without this, no prototype can be approved or promoted to production.

---

#### Task 2: Comprehensive Code Review (4h)

**Description:** All 11 source modules (2,062 lines) require human code review to verify correctness, maintainability, and adherence to team coding standards.

**Action Steps:**
1. Review `src/models/requirementStore.js` (382 lines) — state machine transitions and guard logic
2. Review `src/router.js` (335 lines) — route matching regex compilation and dispatch
3. Review `src/controllers/approvalController.js` (303 lines) — approval gate enforcement
4. Review `src/controllers/requirementsController.js` (221 lines) — input validation
5. Review remaining controllers, middleware, and utilities
6. Verify no logic errors in state transition guards
7. Check edge cases in URL parsing and body parsing

**Severity:** High — Standard quality gate before production deployment.

---

#### Task 3: Security Audit and Hardening (3h)

**Description:** The system handles authentication, user input, and state management. A security audit must verify that the constant-time comparison in `authGuard.js` is correct, input sanitization is sufficient, and no information leakage occurs.

**Action Steps:**
1. Verify `crypto.timingSafeEqual()` implementation in `src/middleware/authGuard.js`
2. Confirm API key values never appear in logs, responses, or error messages
3. Test input sanitization — submit prompts with XSS payloads, SQL injection patterns, and oversized inputs
4. Verify the body parser rejects malformed JSON gracefully (no stack traces exposed)
5. Confirm request size limits are appropriate (current body parser has no size cap)
6. Add maximum request body size limit to `bodyParser.js` (recommended: 1MB)
7. Review all `sendError()` responses to ensure no internal details are leaked

**Severity:** High — Security vulnerabilities could compromise the approval workflow integrity.

---

### 4.2 Medium Priority Tasks (Required for Production Stability)

#### Task 4: Production Environment Deployment Setup (3h)

**Description:** The server currently runs as a bare Node.js process. For production, it needs a process manager (e.g., PM2, systemd), a reverse proxy (e.g., nginx), and proper environment configuration.

**Action Steps:**
1. Install and configure PM2 or systemd service for automatic restart on crash
2. Set up nginx or similar reverse proxy for TLS termination
3. Configure environment variables via `.env` file or system environment
4. Set up log rotation for stdout/stderr output
5. Verify server starts correctly in production mode
6. Test crash recovery — kill the process and verify automatic restart

**Severity:** High — Bare Node.js process is not suitable for production without a process manager.

---

#### Task 5: File-Based Data Persistence Layer (4.5h)

**Description:** The current `requirementStore.js` uses an in-memory `Map` that loses all data when the server restarts. For production use, requirement state must survive server restarts.

**Action Steps:**
1. Design persistence schema (JSON file or SQLite using Node.js built-in capabilities)
2. Implement periodic state snapshots to disk (e.g., write `Map` contents to `data/requirements.json`)
3. Implement state recovery on server startup (load from file if it exists)
4. Add file locking or write-ahead logging to prevent corruption during concurrent writes
5. Update `requirementStore.js` constructor to load persisted state
6. Add persistence-related tests
7. Document the persistence behavior and data directory location

**Severity:** Medium — In-memory store is acceptable for development but will lose all requirements on production restart.

---

#### Task 6: Structured Request Logging and Audit Trail (3h)

**Description:** The system currently has minimal logging (server startup message only). Production requires structured request logging for debugging, monitoring, and audit compliance.

**Action Steps:**
1. Create a logging middleware that logs: timestamp, method, URL, status code, response time
2. Wire the logging middleware into the router (before and after handler dispatch)
3. Log all state transitions in `requirementStore.js` (which requirement, from/to state, timestamp)
4. Ensure API key values are NEVER included in log output (AAP §0.7.3)
5. Add configurable log levels (debug, info, warn, error)
6. Output logs in JSON format for log aggregation tool compatibility
7. Add tests for logging behavior

**Severity:** Medium — Critical for production monitoring and incident response.

---

#### Task 7: Graceful Shutdown and Error Recovery (1.5h)

**Description:** The server lacks graceful shutdown handling. When receiving SIGTERM/SIGINT, it should finish in-flight requests, persist state, and exit cleanly.

**Action Steps:**
1. Add `process.on('SIGTERM')` and `process.on('SIGINT')` handlers in `server.js`
2. Implement `server.close()` to stop accepting new connections
3. Wait for in-flight requests to complete (with timeout)
4. Persist current state to disk before exiting (after Task 5 is complete)
5. Log shutdown events
6. Test graceful shutdown behavior

**Severity:** Medium — Ungraceful shutdowns can cause data loss and connection reset errors.

---

### 4.3 Low Priority Tasks (Optimization and Hardening)

#### Task 8: Performance and Load Testing (2.5h)

**Description:** The system has not been load-tested. Production traffic patterns should be simulated to identify bottlenecks and confirm acceptable response times.

**Action Steps:**
1. Install a load testing tool (e.g., `autocannon`, `wrk`, or `ab`)
2. Benchmark `GET /` endpoint (target: <10ms p99 latency)
3. Benchmark `POST /api/requirements` under concurrent load
4. Test full lifecycle under concurrent users
5. Profile memory usage with increasing number of stored requirements
6. Document performance baseline and acceptable thresholds
7. Identify any memory leak patterns

**Severity:** Medium — In-memory Map may degrade performance with very large datasets.

---

### 4.4 Task Summary

| # | Task | Priority | Hours | Running Total |
|---|------|----------|-------|---------------|
| 1 | Configure production API keys | High | 1.5h | 1.5h |
| 2 | Comprehensive code review | High | 4h | 5.5h |
| 3 | Security audit and hardening | High | 3h | 8.5h |
| 4 | Production deployment setup | Medium | 3h | 11.5h |
| 5 | File-based data persistence | Medium | 4.5h | 16h |
| 6 | Request logging and audit trail | Medium | 3h | 19h |
| 7 | Graceful shutdown handling | Medium | 1.5h | 20.5h |
| 8 | Performance and load testing | Low | 2.5h | 23h |
| **Total Remaining Hours** | | | **23h** | **23h** |

**Verification:** Task table sum (1.5 + 4 + 3 + 3 + 4.5 + 3 + 1.5 + 2.5) = **23h** ✓ matches pie chart "Remaining Work: 23" ✓

---

## 5. Development Guide

### 5.1 System Prerequisites

| Requirement | Minimum Version | Verified Version | Notes |
|-------------|----------------|-----------------|-------|
| **Node.js** | v4.0.0+ | v20.19.5 | Built-in modules only; no npm dependencies |
| **npm** | Any | Bundled with Node.js | Optional — used for convenience scripts only |
| **Git** | Any | Installed | For cloning the repository |
| **Operating System** | Linux, macOS, or Windows | Linux (validated) | Any OS with Node.js support |

**No external dependencies required.** The `package.json` has empty `dependencies` and `devDependencies` objects.

### 5.2 Environment Setup

#### Step 1: Clone the Repository

```bash
git clone https://github.com/ajitblitzy/Test1.git
cd Test1
git checkout blitzy-98781c47-3387-4d29-bfa7-ddac68686246
```

#### Step 2: Configure Environment Variables

Copy the example environment file and configure your API key:

```bash
cp .env.example .env
```

Edit `.env` and set the `BLITZY_CLIENT_API_KEY` value:

```
HOSTNAME=127.0.0.1
PORT=3000
BLITZY_CLIENT_API_KEY=your-secure-api-key-here
```

**Note:** The server works without a `.env` file — environment variables can be set directly in the shell or system environment. The `.env` file is a documentation template; the server reads from `process.env` directly.

#### Step 3: Set Environment Variable in Shell (Alternative)

```bash
export BLITZY_CLIENT_API_KEY="your-secure-api-key-here"
```

### 5.3 Dependency Installation

**No installation step required.** The project has zero external dependencies. There is no `node_modules` directory and no `npm install` needed.

```bash
# Verify: package.json has empty dependencies
node -e "const pkg = require('./package.json'); console.log('Dependencies:', JSON.stringify(pkg.dependencies))"
# Expected output: Dependencies: {}
```

### 5.4 Application Startup

#### Start the Server

```bash
node server.js
```

Or using npm:

```bash
npm start
```

**Expected terminal output:**

```
Server running at http://127.0.0.1:3000/
Staging-approval workflow is active
```

The server is now running and accepting HTTP requests on port 3000.

### 5.5 Verification Steps

#### Verify Default Production Response

```bash
curl http://127.0.0.1:3000/
```

**Expected output:**
```
Hello, World!
```

#### Verify Health Check

```bash
curl http://127.0.0.1:3000/health
```

**Expected output (JSON):**
```json
{"status":"ok","uptime":2.065}
```

#### Verify Staging Workflow (Full Lifecycle)

```bash
# 1. Submit a requirement (auto-stages)
curl -s -X POST http://127.0.0.1:3000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Add dark mode","description":"Toggle dark/light theme"}'
# Returns: {"id":"<uuid>","status":"staged",...}

# 2. List staged prototypes
curl -s http://127.0.0.1:3000/staging
# Returns: Array of staged requirements

# 3. Approve the staged prototype (replace <id> with actual UUID)
curl -s -X POST http://127.0.0.1:3000/api/approve/<id> \
  -H "x-api-key: $BLITZY_CLIENT_API_KEY"
# Returns: {"id":"<id>","status":"approved",...}

# 4. Promote to production
curl -s -X POST http://127.0.0.1:3000/api/promote/<id> \
  -H "x-api-key: $BLITZY_CLIENT_API_KEY"
# Returns: {"id":"<id>","status":"production",...}

# 5. Verify production content changed
curl http://127.0.0.1:3000/
# Returns: [Prototype] Enhanced server response: Add dark mode
```

### 5.6 Running Tests

```bash
npm test
```

**Expected output:** 109 tests across 6 suites, all passing:

```
Results: 18 passed, 0 failed, 18 total    (router)
Results: 35 passed, 0 failed, 35 total    (requirementStore)
Results: 12 passed, 0 failed, 12 total    (requirementsController)
Results: 14 passed, 0 failed, 14 total    (stagingController)
Results: 21 passed, 0 failed, 21 total    (approvalController)
Results: 9 passed, 0 failed, 9 total      (integration/workflow)
```

To run a specific test file individually:

```bash
node tests/router.test.js
node tests/requirementStore.test.js
node tests/integration/workflow.test.js
```

### 5.7 Syntax Validation

```bash
node -c server.js && echo "Syntax OK"
```

To check all JavaScript files:

```bash
for f in $(find . -name "*.js" -not -path "./.git/*"); do node -c "$f" || echo "FAIL: $f"; done
```

### 5.8 Project Structure

```
Test1/
├── server.js                              # Application entry point (16 lines)
├── package.json                           # Project manifest (zero dependencies)
├── .env.example                           # Environment variable template
├── README.md                              # Project documentation
├── src/
│   ├── config.js                          # Centralized configuration (178 lines)
│   ├── router.js                          # URL pattern router (335 lines)
│   ├── controllers/
│   │   ├── approvalController.js          # Approve/reject/promote (303 lines)
│   │   ├── productionController.js        # GET / and GET /health (133 lines)
│   │   ├── requirementsController.js      # Requirements CRUD (221 lines)
│   │   └── stagingController.js           # Staging endpoints (163 lines)
│   ├── middleware/
│   │   ├── authGuard.js                   # API key authentication (103 lines)
│   │   └── bodyParser.js                  # JSON body parser (125 lines)
│   ├── models/
│   │   └── requirementStore.js            # In-memory state machine store (382 lines)
│   └── utils/
│       └── responseHelper.js              # Response utilities (119 lines)
├── tests/
│   ├── approvalController.test.js         # 21 tests
│   ├── requirementStore.test.js           # 35 tests
│   ├── requirementsController.test.js     # 12 tests
│   ├── router.test.js                     # 18 tests
│   ├── stagingController.test.js          # 14 tests
│   └── integration/
│       └── workflow.test.js               # 9 tests (end-to-end)
├── docs/
│   ├── api-reference.md                   # Complete REST API reference (732 lines)
│   └── staging-workflow.md                # Workflow guide with state diagrams (512 lines)
└── blitzy/
    └── documentation/
        ├── Project Guide.md               # Project guide and task report
        └── Technical Specifications.md    # Formal technical specification
```

### 5.9 Common Issues and Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| `EADDRINUSE: address already in use 127.0.0.1:3000` | Port 3000 is already in use | Kill the existing process: `fuser 3000/tcp -k` or change PORT in environment |
| `401 Unauthorized` on approve/reject/promote | Missing or invalid API key | Set `BLITZY_CLIENT_API_KEY` environment variable and pass via `x-api-key` header |
| `409 Conflict` on approve | Requirement not in `staged` state | Check requirement status with `GET /api/requirements/:id`; only `staged` requirements can be approved |
| `409 Conflict` on promote | Requirement not in `approved` state | Approve the requirement first with `POST /api/approve/:id` |
| Data lost after server restart | In-memory store | Expected behavior — implement file-based persistence (see Task 5) |

---

## 6. Risk Assessment

### 6.1 Technical Risks

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|-----------|--------|------------|
| **In-memory data loss on restart** | Medium | High | All requirements and approval states lost when server process ends | Implement file-based persistence layer (Task 5); interim mitigation: document that server restart clears all state |
| **No request body size limit** | Medium | Medium | Potential DoS via large request payloads | Add maximum body size check in `bodyParser.js` (recommended: 1MB cap) |
| **Single-process architecture** | Low | Low | Cannot scale horizontally; limited to single CPU core | Acceptable per AAP scope; document as future enhancement if high traffic expected |
| **Regex-based routing** | Low | Low | Complex URL patterns could trigger ReDoS | Current route patterns are simple and pre-compiled; low risk but should be audited |

### 6.2 Security Risks

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|-----------|--------|------------|
| **API key not configured** | High | High | All approval/reject/promote endpoints will reject with 401; workflow is blocked | Configure `BLITZY_CLIENT_API_KEY` before production use (Task 1) |
| **No rate limiting** | Medium | Medium | API abuse, brute-force key guessing | Implement rate limiting middleware or use reverse proxy rate limiting |
| **Input prompt not sanitized for storage** | Low | Low | Stored XSS if prototype content ever rendered in HTML context | Current system serves text/JSON only; add sanitization if HTML rendering is added |
| **API key in environment variable** | Low | Low | Environment variable exposure through process listing | Use secrets management system in production; restrict process access |

### 6.3 Operational Risks

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|-----------|--------|------------|
| **No monitoring or alerting** | Medium | High | Cannot detect failures, performance degradation, or security incidents | Add structured logging (Task 6) and integrate with monitoring system |
| **No graceful shutdown** | Medium | Medium | In-flight requests dropped on server stop; potential data corruption if persistence is added | Implement SIGTERM/SIGINT handlers (Task 7) |
| **No health check beyond basic** | Low | Low | Limited observability into system health | Enhance `/health` endpoint with store statistics, memory usage |
| **No log rotation** | Low | Medium | Disk space exhaustion from stdout logging | Configure log rotation via process manager or system logrotate |

### 6.4 Integration Risks

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|-----------|--------|------------|
| **No persistent storage integration** | Medium | High | Data loss on any server restart | Implement file-based persistence (Task 5) or plan database migration |
| **Multi-key authentication not implemented** | Low | Low | `BLITZY_CLIENT_API_KEY2` and `KEY3` are available but unused | Extend `authGuard.js` to validate against all three keys if needed |
| **No reverse proxy integration tested** | Low | Medium | Potential issues with proxy headers, WebSocket upgrades | Test behind nginx/Apache before production deployment |

---

## 7. Git Repository Analysis

### 7.1 Branch Information

- **Feature Branch:** `blitzy-98781c47-3387-4d29-bfa7-ddac68686246`
- **Base Branch:** `origin/Test_16_Feb-2026`
- **Total Commits on Feature Branch:** 24
- **Base Branch Commits:** 5

### 7.2 Code Volume

| Metric | Value |
|--------|-------|
| Total files changed | 24 |
| Files created | 20 |
| Files modified | 4 |
| Lines added | 7,821 |
| Lines removed | 58 |
| Net lines changed | +7,763 |
| Repository size | 429 KB |

### 7.3 File Type Breakdown

| Type | Count | Total Lines |
|------|-------|-------------|
| JavaScript source files (`src/**/*.js`) | 10 | 2,062 |
| JavaScript entry point (`server.js`) | 1 | 16 |
| JavaScript test files (`tests/**/*.js`) | 6 | 3,497 |
| Markdown documentation (`.md`) | 5 | 2,947 |
| JSON configuration (`package.json`) | 1 | 28 |
| Environment template (`.env.example`) | 1 | 33 |
| **Total** | **24** | **8,583** |

### 7.4 Commit Activity

All 24 commits were authored by `Blitzy Agent` in a logical bottom-up dependency order:

1. **Foundation:** `package.json`, `.env.example`, `README.md`, documentation updates
2. **Configuration:** `src/config.js`, `src/utils/responseHelper.js`
3. **Data Layer:** `src/models/requirementStore.js`
4. **Middleware:** `src/middleware/bodyParser.js`, `src/middleware/authGuard.js`
5. **Controllers:** production, requirements, staging, approval controllers
6. **Routing:** `src/router.js`
7. **Integration:** `server.js` modification
8. **Testing:** All 6 test files

---

## 8. AAP Requirements Compliance Matrix

| AAP Requirement | Status | Evidence |
|----------------|--------|---------|
| POST /api/requirements endpoint | ✅ Complete | `requirementsController.js` — runtime validated |
| GET /api/requirements listing | ✅ Complete | `requirementsController.js` — runtime validated |
| GET /api/requirements/:id detail | ✅ Complete | `requirementsController.js` — runtime validated |
| GET /staging listing | ✅ Complete | `stagingController.js` — runtime validated |
| GET /staging/:id prototype view | ✅ Complete | `stagingController.js` — runtime validated |
| POST /api/approve/:id with auth | ✅ Complete | `approvalController.js` — runtime validated |
| POST /api/reject/:id with auth | ✅ Complete | `approvalController.js` — runtime validated |
| POST /api/promote/:id with auth | ✅ Complete | `approvalController.js` — runtime validated |
| GET / production content | ✅ Complete | `productionController.js` — runtime validated |
| GET /health endpoint | ✅ Complete | `productionController.js` — runtime validated |
| State machine enforcement | ✅ Complete | `requirementStore.js` — 35 unit tests passing |
| Approval gate (no direct production update) | ✅ Complete | Validated via full lifecycle test |
| API key authentication | ✅ Complete | `authGuard.js` with constant-time comparison |
| Zero external dependencies | ✅ Complete | `package.json` dependencies: {} |
| CommonJS modules | ✅ Complete | All files use require()/module.exports |
| Backward compatibility (Hello, World! default) | ✅ Complete | GET / returns Hello, World! until promotion |
| server.js remains entry point | ✅ Complete | `server.js` imports router and starts server |
| Terminal states enforced (rejected, production) | ✅ Complete | State machine tests verify no transitions from terminal states |
| Single active production prototype | ✅ Complete | Integration test verifies new promotion replaces previous |
| Idempotent same-state transitions | ✅ Complete | Store returns current state without error |
| Unit tests for all modules | ✅ Complete | 5 unit test suites, 100 tests |
| Integration tests for lifecycle | ✅ Complete | 1 integration test suite, 9 tests |
| API documentation | ✅ Complete | `docs/api-reference.md` (732 lines) |
| Workflow documentation | ✅ Complete | `docs/staging-workflow.md` (512 lines) |

**All 24 in-scope AAP requirements are implemented and validated.**