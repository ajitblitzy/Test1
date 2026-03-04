# Test1

A Node.js HTTP server that responds with "Hello, World!" to every incoming request. Built using the Node.js built-in `http` module with zero external dependencies. Now includes a **Staging-Approval Workflow** for controlled promotion of new features from prototype to production.

## Prerequisites

- **Node.js** v4.x or later is required (the server uses ES6 features including `const`, arrow functions, and template literals)
- **npm** (optional) — a `package.json` is included for convenience scripts (`npm start`, `npm test`), but the project maintains zero external dependencies
- No build tools or compilation steps are required
- `node server.js` still works directly without npm

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd Test1
   ```

2. **Start the server:**

   ```bash
   node server.js
   ```

   Or, using npm:

   ```bash
   npm start
   ```

3. **Expected terminal output:**

   ```
   Server running at http://127.0.0.1:3000/
   ```

The server is now running and ready to accept HTTP requests.

## Usage

### Starting the Server

```bash
node server.js
```

Or using npm:

```bash
npm start
```

### Verifying the Default Response with curl

```bash
curl http://127.0.0.1:3000/
```

**Expected response:**

```
Hello, World!
```

### Accessing via Browser

Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in any web browser to see the "Hello, World!" response.

### Staging Workflow Usage

#### 1. Submit a New Requirement

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"prompt": "Add greeting feature", "description": "A new personalized greeting"}' \
  http://127.0.0.1:3000/api/requirements
```

**Response (201 Created):**

```json
{
  "id": "<uuid>",
  "prompt": "Add greeting feature",
  "description": "A new personalized greeting",
  "status": "staged",
  "createdAt": "<timestamp>"
}
```

#### 2. View All Staged Prototypes

```bash
curl http://127.0.0.1:3000/staging
```

#### 3. View a Specific Staged Prototype

Replace `:id` with the actual requirement UUID:

```bash
curl http://127.0.0.1:3000/staging/<uuid>
```

#### 4. Approve a Staged Prototype

Requires the `x-api-key` header with a valid API key:

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  http://127.0.0.1:3000/api/approve/<uuid>
```

#### 5. Promote an Approved Prototype to Production

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  http://127.0.0.1:3000/api/promote/<uuid>
```

After promotion, `GET /` will serve the promoted content instead of the default `Hello, World!` response.

#### 6. Reject a Staged Prototype

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Does not meet requirements"}' \
  http://127.0.0.1:3000/api/reject/<uuid>
```

Rejected prototypes cannot be promoted to production. Rejection is a terminal state.

## Configuration

The server configuration is defined as constants in `server.js` and centralized in `src/config.js`:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| Hostname | `127.0.0.1` | Loopback interface — accepts connections from the local machine only |
| Port | `3000` | TCP port the server listens on |

To change the hostname or port, edit the corresponding constant values in `server.js` or `src/config.js`:

```javascript
const hostname = '127.0.0.1'; // Change to '0.0.0.0' to accept external connections
const port = 3000;             // Change to any available port number
```

## Environment Variables

The following environment variables are available for configuration. See `.env.example` for the full template.

| Variable | Required | Description |
|----------|----------|-------------|
| `BLITZY_CLIENT_API_KEY` | Yes (for approval endpoints) | API key used to authenticate approval, rejection, and promotion requests |
| `c` | No | General-purpose environment variable |
| `d` | No | General-purpose environment variable |
| `r` | No | General-purpose environment variable |

> **Note:** API key values are never logged or exposed in response bodies. The `approve`, `reject`, and `promote` endpoints require a valid `x-api-key` request header matching the `BLITZY_CLIENT_API_KEY` environment variable.

## Staging-Approval Workflow

All changes to the production response must flow through a controlled promotion pipeline. Direct updates to the production endpoint are not allowed.

### Workflow Overview

1. **Submit** — A new requirement is submitted via `POST /api/requirements` with a prompt describing the desired feature.
2. **Stage** — The system automatically generates a prototype and transitions the requirement to `staged` status, making it available for review.
3. **Review** — Reviewers inspect the staged prototype via `GET /staging/:id`.
4. **Approve or Reject** — An authorized user approves (`POST /api/approve/:id`) or rejects (`POST /api/reject/:id`) the staged prototype. Authentication via API key is required.
5. **Promote** — An authorized user promotes the approved prototype to production via `POST /api/promote/:id`. The `GET /` endpoint now serves the promoted content.

### State Machine

```
submitted → staged → approved → production
                  ↘ rejected (terminal)
```

### Key Rules

- **No direct production updates** — The `GET /` response can only change through the full workflow pipeline.
- **Approval gate is mandatory** — A prototype must be explicitly approved before it can be promoted.
- **Terminal states are final** — Requirements in `rejected` or `production` states cannot be transitioned further.
- **Single active production prototype** — Only one requirement may be in the `production` state at any time. Promoting a new requirement archives the previously active one.
- **API key authentication** — The `approve`, `reject`, and `promote` endpoints require a valid `x-api-key` header.
- **Idempotent transitions** — Attempting to transition a requirement to its current state returns the current state without error.

## API Behavior

The server uses a URL pattern router to dispatch requests to the appropriate handler. The default production response (`GET /`) returns `Hello, World!\n` until a prototype is promoted through the staging-approval workflow.

### Endpoint Reference

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `GET` | `/` | Current production content (default: `Hello, World!\n`) | No |
| `POST` | `/api/requirements` | Submit a new requirement | No |
| `GET` | `/api/requirements` | List all requirements | No |
| `GET` | `/api/requirements/:id` | Get requirement detail | No |
| `GET` | `/staging` | List staged prototypes | No |
| `GET` | `/staging/:id` | View specific staged prototype | No |
| `POST` | `/api/approve/:id` | Approve a staged prototype | Yes |
| `POST` | `/api/reject/:id` | Reject a staged prototype | Yes |
| `POST` | `/api/promote/:id` | Promote approved prototype to production | Yes |
| `GET` | `/health` | Health check endpoint | No |

### Default Response Contract (GET /)

| Property | Value |
|----------|-------|
| Status Code | `200 OK` |
| Header | `Content-Type: text/plain` |
| Body | `Hello, World!\n` (until a prototype is promoted) |

### Example Requests and Responses

**Default Production Response:**

Request:

```
GET / HTTP/1.1
Host: 127.0.0.1:3000
```

Response:

```
HTTP/1.1 200 OK
Content-Type: text/plain

Hello, World!
```

**Submit a Requirement:**

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"prompt": "Add greeting feature", "description": "A personalized greeting"}' \
  http://127.0.0.1:3000/api/requirements
```

Response (201 Created):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "Add greeting feature",
  "description": "A personalized greeting",
  "status": "staged",
  "createdAt": "2026-02-19T00:00:00.000Z"
}
```

**List All Requirements:**

```bash
curl http://127.0.0.1:3000/api/requirements
```

Response (200 OK):

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "prompt": "Add greeting feature",
    "status": "staged",
    "createdAt": "2026-02-19T00:00:00.000Z"
  }
]
```

**Approve a Staged Prototype:**

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  http://127.0.0.1:3000/api/approve/550e8400-e29b-41d4-a716-446655440000
```

Response (200 OK):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved"
}
```

**Promote to Production:**

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  http://127.0.0.1:3000/api/promote/550e8400-e29b-41d4-a716-446655440000
```

Response (200 OK):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "production"
}
```

**Reject a Staged Prototype:**

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Does not meet requirements"}' \
  http://127.0.0.1:3000/api/reject/550e8400-e29b-41d4-a716-446655440000
```

Response (200 OK):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "rejected",
  "reason": "Does not meet requirements"
}
```

**Health Check:**

```bash
curl http://127.0.0.1:3000/health
```

Response (200 OK):

```json
{
  "status": "ok",
  "uptime": 12345
}
```

## Running Tests

Run all tests using npm:

```bash
npm test
```

Or run individual test files directly with Node.js:

```bash
node tests/router.test.js
node tests/requirementStore.test.js
node tests/requirementsController.test.js
node tests/stagingController.test.js
node tests/approvalController.test.js
node tests/integration/workflow.test.js
```

All tests use the Node.js built-in `assert` module — no external test frameworks are required.

## Project Structure

```
Test1/
├── server.js                              # Entry point — HTTP server with router integration
├── package.json                           # Project manifest (zero external deps)
├── .env.example                           # Environment variable template
├── README.md                              # This documentation
├── src/
│   ├── config.js                          # Centralized configuration
│   ├── router.js                          # URL pattern router
│   ├── controllers/
│   │   ├── productionController.js        # GET / handler
│   │   ├── requirementsController.js      # Requirements CRUD
│   │   ├── stagingController.js           # Staging endpoints
│   │   └── approvalController.js          # Approve/reject/promote
│   ├── middleware/
│   │   ├── bodyParser.js                  # JSON body parser
│   │   └── authGuard.js                   # API key authentication
│   ├── models/
│   │   └── requirementStore.js            # In-memory state machine store
│   └── utils/
│       └── responseHelper.js              # Response utilities
├── tests/
│   ├── router.test.js
│   ├── requirementsController.test.js
│   ├── stagingController.test.js
│   ├── approvalController.test.js
│   ├── requirementStore.test.js
│   └── integration/
│       └── workflow.test.js
├── docs/
│   ├── api-reference.md
│   └── staging-workflow.md
└── blitzy/
    └── documentation/
        ├── Project Guide.md
        └── Technical Specifications.md
```

### File Descriptions

- **`server.js`** — Application entry point. Creates an HTTP server using the Node.js built-in `http` module, delegates request handling to the router, binds to `127.0.0.1:3000`, and responds with the current production content (default: `Hello, World!\n`).
- **`package.json`** — Project manifest with npm scripts (`start`, `test`). Maintains zero external dependencies.
- **`.env.example`** — Template documenting all available environment variables and secrets.
- **`src/config.js`** — Centralized configuration for hostname, port, and environment variable references.
- **`src/router.js`** — URL pattern router that dispatches requests to the appropriate controller based on HTTP method and path.
- **`src/controllers/`** — Business logic handlers for production, requirements, staging, and approval endpoints.
- **`src/middleware/`** — Request processing middleware including JSON body parsing and API key authentication.
- **`src/models/requirementStore.js`** — In-memory data store implementing the requirement lifecycle state machine with transition guards.
- **`src/utils/responseHelper.js`** — Shared response utility functions for consistent API output formatting.
- **`tests/`** — Unit and integration test files using the Node.js built-in `assert` module.
- **`docs/`** — Additional documentation including API reference and staging workflow guide.
