# API Reference — Staging-Approval Workflow

Complete REST API reference for the Staging-Approval Workflow system. This API provides endpoints for managing the full requirement-to-production pipeline, including requirement submission, prototype staging, approval gating, and production promotion.

The server runs at `http://127.0.0.1:3000` by default. All endpoints return JSON responses with `Content-Type: application/json` unless otherwise specified (the production endpoint `GET /` returns `text/plain`). The system is built entirely on the Node.js built-in `http` module with zero external dependencies.

---

## Base URL

```
http://127.0.0.1:3000
```

The hostname and port are configured in `src/config.js` and default to `127.0.0.1` and `3000` respectively, matching the original `server.js` constants.

---

## Authentication

Sensitive workflow endpoints — **approve**, **reject**, and **promote** — require API key authentication.

| Property          | Detail                                                        |
|-------------------|---------------------------------------------------------------|
| Header Name       | `x-api-key`                                                   |
| Configuration     | Set via the `BLITZY_CLIENT_API_KEY` environment variable      |
| Required On       | `POST /api/approve/:id`, `POST /api/reject/:id`, `POST /api/promote/:id` |
| Failure Response  | `401 Unauthorized` with `{ "error": "Unauthorized" }`        |

**Example authenticated request header:**

```
x-api-key: YOUR_API_KEY
```

All other endpoints (requirement submission, listing, staging, health check, and production content) are publicly accessible and do not require authentication.

---

## Endpoints

### Production

#### `GET /` — Production Content

Returns the current production content. The default response is `Hello, World!\n` with `Content-Type: text/plain` and HTTP status `200 OK`. This default persists until a prototype is explicitly promoted through the approval workflow.

| Property         | Value                                  |
|------------------|----------------------------------------|
| **Method**       | `GET`                                  |
| **Path**         | `/`                                    |
| **Auth Required**| No                                     |
| **Request Body** | None                                   |
| **Content-Type** | `text/plain`                           |

**Status Codes:**

| Code | Description                              |
|------|------------------------------------------|
| 200  | OK — returns current production content  |

**curl Example:**

```bash
curl http://127.0.0.1:3000/
```

**Example Response:**

```
Hello, World!
```

> **Important:** The production content changes **only** when a prototype is promoted via `POST /api/promote/:id`. There is no direct update mechanism — all changes must flow through the `submitted → staged → approved → production` pipeline.

---

#### `GET /health` — Health Check

Returns the health status of the server and its uptime in seconds.

| Property         | Value                                  |
|------------------|----------------------------------------|
| **Method**       | `GET`                                  |
| **Path**         | `/health`                              |
| **Auth Required**| No                                     |
| **Request Body** | None                                   |
| **Content-Type** | `application/json`                     |

**Status Codes:**

| Code | Description                  |
|------|------------------------------|
| 200  | OK — server is healthy       |

**Response Body Schema:**

| Field    | Type   | Description                              |
|----------|--------|------------------------------------------|
| `status` | string | Always `"ok"` when the server is running |
| `uptime` | number | Server uptime in seconds                 |

**curl Example:**

```bash
curl http://127.0.0.1:3000/health
```

**Example Response:**

```json
{
  "status": "ok",
  "uptime": 3672
}
```

---

### Requirements

#### `POST /api/requirements` — Submit a New Requirement

Submits a new requirement to the system. The system creates the requirement, automatically generates a prototype from the prompt text, and transitions the requirement to the `staged` state so that it is immediately available for review.

| Property         | Value                                  |
|------------------|----------------------------------------|
| **Method**       | `POST`                                 |
| **Path**         | `/api/requirements`                    |
| **Auth Required**| No                                     |
| **Content-Type** | `application/json`                     |

**Request Body Schema:**

| Field         | Type   | Required | Description                                 |
|---------------|--------|----------|---------------------------------------------|
| `prompt`      | string | Yes      | The requirement prompt text                 |
| `description` | string | No       | Additional description of the requirement   |

**Status Codes:**

| Code | Description                                          |
|------|------------------------------------------------------|
| 201  | Created — requirement submitted and auto-staged      |
| 400  | Bad Request — missing or invalid `prompt` field      |

**Response Body Schema:**

| Field         | Type   | Description                                        |
|---------------|--------|----------------------------------------------------|
| `id`          | string | UUID assigned to the new requirement               |
| `status`      | string | Lifecycle status (returns `"staged"` after auto-staging) |
| `prompt`      | string | The submitted prompt text                          |
| `description` | string | The submitted description (if provided)            |
| `createdAt`   | string | ISO 8601 timestamp of creation                     |

**curl Example:**

```bash
curl -X POST http://127.0.0.1:3000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add greeting feature", "description": "A new greeting endpoint"}'
```

**Example Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "staged",
  "prompt": "Add greeting feature",
  "description": "A new greeting endpoint",
  "createdAt": "2026-02-16T12:00:00.000Z"
}
```

**Example Error Response (400 Bad Request):**

```json
{
  "error": "Missing required field: prompt"
}
```

> **Note:** The system auto-generates a prototype from the prompt and transitions the requirement from `submitted` to `staged` state automatically. The requirement is immediately available for review at `GET /staging/:id`.

---

#### `GET /api/requirements` — List All Requirements

Returns an array of all requirements in the system, regardless of their current lifecycle state.

| Property         | Value                                  |
|------------------|----------------------------------------|
| **Method**       | `GET`                                  |
| **Path**         | `/api/requirements`                    |
| **Auth Required**| No                                     |
| **Request Body** | None                                   |
| **Content-Type** | `application/json`                     |

**Status Codes:**

| Code | Description                            |
|------|----------------------------------------|
| 200  | OK — returns array of requirements     |

**Response Body Schema (array of objects):**

| Field       | Type   | Description                                       |
|-------------|--------|---------------------------------------------------|
| `id`        | string | UUID of the requirement                           |
| `prompt`    | string | The requirement prompt text                       |
| `status`    | string | Current lifecycle state (`submitted`, `staged`, `approved`, `rejected`, `production`) |
| `createdAt` | string | ISO 8601 timestamp of creation                    |

**curl Example:**

```bash
curl http://127.0.0.1:3000/api/requirements
```

**Example Response:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "prompt": "Add greeting feature",
    "status": "staged",
    "createdAt": "2026-02-16T12:00:00.000Z"
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "prompt": "Add farewell feature",
    "status": "approved",
    "createdAt": "2026-02-16T13:30:00.000Z"
  }
]
```

---

#### `GET /api/requirements/:id` — Requirement Detail

Returns the full detail of a specific requirement, including its prototype content, description, and timestamps.

| Property         | Value                                      |
|------------------|--------------------------------------------|
| **Method**       | `GET`                                      |
| **Path**         | `/api/requirements/:id`                    |
| **Auth Required**| No                                         |
| **Request Body** | None                                       |
| **Content-Type** | `application/json`                         |

**Path Parameters:**

| Parameter | Type   | Description                         |
|-----------|--------|-------------------------------------|
| `id`      | string | UUID of the requirement to retrieve |

**Status Codes:**

| Code | Description                                       |
|------|---------------------------------------------------|
| 200  | OK — returns requirement detail                   |
| 404  | Not Found — no requirement exists with given ID   |

**Response Body Schema:**

| Field         | Type   | Description                                          |
|---------------|--------|------------------------------------------------------|
| `id`          | string | UUID of the requirement                              |
| `prompt`      | string | The requirement prompt text                          |
| `description` | string | Additional description (if provided at submission)   |
| `status`      | string | Current lifecycle state                              |
| `prototype`   | string | Generated prototype content (available after staging)|
| `createdAt`   | string | ISO 8601 timestamp of creation                       |
| `updatedAt`   | string | ISO 8601 timestamp of last state transition          |

**curl Example:**

```bash
curl http://127.0.0.1:3000/api/requirements/550e8400-e29b-41d4-a716-446655440000
```

**Example Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "Add greeting feature",
  "description": "A new greeting endpoint",
  "status": "staged",
  "prototype": "Enhanced server with greeting feature: Hello, Add greeting feature!\n",
  "createdAt": "2026-02-16T12:00:00.000Z",
  "updatedAt": "2026-02-16T12:00:01.000Z"
}
```

**Example Error Response (404 Not Found):**

```json
{
  "error": "Requirement not found"
}
```

---

### Staging

#### `GET /staging` — List Staged Prototypes

Returns an array of all requirements currently in the `staged` state, along with their prototype content. Use this endpoint to see which prototypes are awaiting review and approval.

| Property         | Value                                  |
|------------------|----------------------------------------|
| **Method**       | `GET`                                  |
| **Path**         | `/staging`                             |
| **Auth Required**| No                                     |
| **Request Body** | None                                   |
| **Content-Type** | `application/json`                     |

**Status Codes:**

| Code | Description                                    |
|------|------------------------------------------------|
| 200  | OK — returns array of staged requirements      |

**Response Body Schema (array of objects):**

| Field       | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| `id`        | string | UUID of the requirement                      |
| `prompt`    | string | The requirement prompt text                  |
| `prototype` | string | Generated prototype content for review       |
| `status`    | string | Always `"staged"` for results in this list   |

**curl Example:**

```bash
curl http://127.0.0.1:3000/staging
```

**Example Response:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "prompt": "Add greeting feature",
    "prototype": "Enhanced server with greeting feature: Hello, Add greeting feature!\n",
    "status": "staged"
  }
]
```

---

#### `GET /staging/:id` — View Staged Prototype

Renders the prototype content of a specific staged requirement for reviewer inspection. This is the primary endpoint for reviewing a prototype before approving or rejecting it.

| Property         | Value                                      |
|------------------|--------------------------------------------|
| **Method**       | `GET`                                      |
| **Path**         | `/staging/:id`                             |
| **Auth Required**| No                                         |
| **Request Body** | None                                       |
| **Content-Type** | `application/json`                         |

**Path Parameters:**

| Parameter | Type   | Description                                   |
|-----------|--------|-----------------------------------------------|
| `id`      | string | UUID of the staged requirement to inspect     |

**Status Codes:**

| Code | Description                                                 |
|------|-------------------------------------------------------------|
| 200  | OK — returns the staged prototype detail                    |
| 404  | Not Found — no staged requirement exists with the given ID  |

**Response Body Schema:**

| Field       | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| `id`        | string | UUID of the requirement                      |
| `prompt`    | string | The requirement prompt text                  |
| `prototype` | string | Generated prototype content for review       |
| `status`    | string | Current status (must be `"staged"`)          |

**curl Example:**

```bash
curl http://127.0.0.1:3000/staging/550e8400-e29b-41d4-a716-446655440000
```

**Example Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "Add greeting feature",
  "prototype": "Enhanced server with greeting feature: Hello, Add greeting feature!\n",
  "status": "staged"
}
```

**Example Error Response (404 Not Found):**

```json
{
  "error": "Staged prototype not found"
}
```

---

### Approval Workflow

#### `POST /api/approve/:id` — Approve a Staged Prototype

Transitions a staged requirement to the `approved` state. The requirement must currently be in the `staged` state. Once approved, the requirement becomes eligible for promotion to production via `POST /api/promote/:id`.

| Property         | Value                                      |
|------------------|--------------------------------------------|
| **Method**       | `POST`                                     |
| **Path**         | `/api/approve/:id`                         |
| **Auth Required**| **Yes** — `x-api-key` header required      |
| **Request Body** | None                                       |
| **Content-Type** | `application/json`                         |

**Path Parameters:**

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `id`      | string | UUID of the requirement to approve       |

**Status Codes:**

| Code | Description                                                           |
|------|-----------------------------------------------------------------------|
| 200  | OK — requirement approved successfully                                |
| 401  | Unauthorized — missing or invalid API key                             |
| 404  | Not Found — no requirement exists with given ID                       |
| 409  | Conflict — requirement is not in `staged` state (invalid transition)  |

**Response Body Schema:**

| Field    | Type   | Description                                    |
|----------|--------|------------------------------------------------|
| `id`     | string | UUID of the requirement                        |
| `status` | string | Updated status: `"approved"`                   |

**curl Example:**

```bash
curl -X POST http://127.0.0.1:3000/api/approve/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: YOUR_API_KEY"
```

**Example Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved"
}
```

**State Transition:** `staged` → `approved`

**Guard Conditions:**
- The requirement must exist and be in the `staged` state
- Attempting to approve a requirement in any other state returns `409 Conflict`
- Idempotent: approving an already-approved requirement returns the current state without error

---

#### `POST /api/reject/:id` — Reject a Staged Prototype

Transitions a staged requirement to the `rejected` state. Rejection is a **terminal state** — once rejected, a requirement cannot transition to any other state. An optional rejection reason can be provided in the request body.

| Property         | Value                                      |
|------------------|--------------------------------------------|
| **Method**       | `POST`                                     |
| **Path**         | `/api/reject/:id`                          |
| **Auth Required**| **Yes** — `x-api-key` header required      |
| **Request Body** | Optional JSON                              |
| **Content-Type** | `application/json`                         |

**Path Parameters:**

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `id`      | string | UUID of the requirement to reject        |

**Request Body Schema (optional):**

| Field    | Type   | Required | Description                        |
|----------|--------|----------|------------------------------------|
| `reason` | string | No       | Reason for rejecting the prototype |

**Status Codes:**

| Code | Description                                                           |
|------|-----------------------------------------------------------------------|
| 200  | OK — requirement rejected successfully                                |
| 401  | Unauthorized — missing or invalid API key                             |
| 404  | Not Found — no requirement exists with given ID                       |
| 409  | Conflict — requirement is not in `staged` state (invalid transition)  |

**Response Body Schema:**

| Field    | Type   | Description                                    |
|----------|--------|------------------------------------------------|
| `id`     | string | UUID of the requirement                        |
| `status` | string | Updated status: `"rejected"`                   |

**curl Example:**

```bash
curl -X POST http://127.0.0.1:3000/api/reject/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Does not meet requirements"}'
```

**Example Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "rejected"
}
```

**State Transition:** `staged` → `rejected` (TERMINAL — no further transitions allowed)

**Guard Conditions:**
- The requirement must exist and be in the `staged` state
- Attempting to reject a requirement in any other state returns `409 Conflict`
- Once rejected, the requirement cannot be approved, promoted, or returned to any previous state

---

#### `POST /api/promote/:id` — Promote to Production

Promotes an approved requirement to production. This is the **only mechanism** by which the production endpoint (`GET /`) content can change. The requirement must be in the `approved` state.

Only one requirement may be in the `production` state at any given time. Promoting a new requirement automatically archives the previously active production requirement.

| Property         | Value                                      |
|------------------|--------------------------------------------|
| **Method**       | `POST`                                     |
| **Path**         | `/api/promote/:id`                         |
| **Auth Required**| **Yes** — `x-api-key` header required      |
| **Request Body** | None                                       |
| **Content-Type** | `application/json`                         |

**Path Parameters:**

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `id`      | string | UUID of the requirement to promote       |

**Status Codes:**

| Code | Description                                                           |
|------|-----------------------------------------------------------------------|
| 200  | OK — requirement promoted to production                               |
| 401  | Unauthorized — missing or invalid API key                             |
| 404  | Not Found — no requirement exists with given ID                       |
| 409  | Conflict — requirement is not in `approved` state (invalid transition)|

**Response Body Schema:**

| Field    | Type   | Description                                    |
|----------|--------|------------------------------------------------|
| `id`     | string | UUID of the requirement                        |
| `status` | string | Updated status: `"production"`                 |

**curl Example:**

```bash
curl -X POST http://127.0.0.1:3000/api/promote/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: YOUR_API_KEY"
```

**Example Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "production"
}
```

**State Transition:** `approved` → `production`

**Guard Conditions:**
- The requirement must exist and be in the `approved` state
- Attempting to promote a requirement not in `approved` state returns `409 Conflict`
- Only one requirement can be in the `production` state at a time; promoting a new requirement archives the previous one
- The `production` state is **terminal** — no further transitions are allowed

> **Critical:** This endpoint is the sole gateway for production content changes. The `GET /` endpoint will serve the prototype content of the most recently promoted requirement. Without a successful promote action, the default `Hello, World!\n` response persists indefinitely.

---

## Requirement Lifecycle State Machine

All requirements follow a strict lifecycle with enforced transition rules:

```
submitted → staged → approved → production
                  ↘ rejected
```

| From State   | To State     | Trigger                      | Guard                                              |
|-------------|-------------|------------------------------|-----------------------------------------------------|
| `submitted` | `staged`    | Automatic (on creation)      | Prototype content must be non-empty                 |
| `staged`    | `approved`  | `POST /api/approve/:id`     | Must be in `staged` state; valid API key required   |
| `staged`    | `rejected`  | `POST /api/reject/:id`      | Must be in `staged` state; valid API key required   |
| `approved`  | `production`| `POST /api/promote/:id`     | Must be in `approved` state; only one active at a time |

**State Rules:**
- **No backward transitions** — requirements can only move forward through the pipeline
- **Terminal states** — `rejected` and `production` are terminal; no further transitions are allowed
- **Idempotent transitions** — transitioning a requirement to its current state returns the current state without error
- **Single active production** — only one requirement may hold the `production` state at any given time

---

## Error Responses

All error responses follow a standard JSON format:

```json
{
  "error": "Error message description"
}
```

### Common Error Scenarios

| Status Code | Error Message                        | Cause                                                             |
|-------------|--------------------------------------|-------------------------------------------------------------------|
| 400         | `"Missing required field: prompt"`   | `POST /api/requirements` called without a `prompt` field          |
| 401         | `"Unauthorized"`                     | Protected endpoint called without a valid `x-api-key` header     |
| 404         | `"Requirement not found"`            | Requirement ID does not exist in the system                      |
| 404         | `"Not Found"`                        | Request URL does not match any registered route                  |
| 404         | `"Staged prototype not found"`       | Staging endpoint called with an ID not in `staged` state         |
| 405         | `"Method Not Allowed"`               | HTTP method is not supported for the matched route path          |
| 409         | `"Invalid state transition"`         | Attempted state transition violates the lifecycle state machine  |

---

## HTTP Status Codes Summary

| Code | Meaning             | Used By                                                                |
|------|---------------------|------------------------------------------------------------------------|
| 200  | OK                  | All GET endpoints; successful approve, reject, and promote operations  |
| 201  | Created             | `POST /api/requirements` — new requirement created and staged          |
| 400  | Bad Request         | `POST /api/requirements` — validation failure (missing `prompt`)       |
| 401  | Unauthorized        | `POST /api/approve/:id`, `POST /api/reject/:id`, `POST /api/promote/:id` — missing or invalid API key |
| 404  | Not Found           | Any endpoint with an invalid ID; unmatched routes                      |
| 405  | Method Not Allowed  | Router — HTTP method not supported for a matched path                  |
| 409  | Conflict            | Approval workflow endpoints — invalid state transition attempted       |

---

## Unmatched Routes

The router handles requests that do not match any registered endpoint:

- **Unmatched URL path:** Returns `404 Not Found` with the response body:
  ```json
  { "error": "Not Found" }
  ```

- **Method mismatch** (correct path, wrong HTTP method): Returns `405 Method Not Allowed` with the response body:
  ```json
  { "error": "Method Not Allowed" }
  ```

---

## Full Workflow Example

The following sequence demonstrates the complete requirement-to-production lifecycle:

**Step 1 — Submit a requirement:**

```bash
curl -X POST http://127.0.0.1:3000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add greeting feature", "description": "A personalized greeting endpoint"}'
# Response: 201 Created with id and status "staged"
```

**Step 2 — Review the staged prototype:**

```bash
curl http://127.0.0.1:3000/staging/REQUIREMENT_ID
# Response: 200 OK with prototype content for inspection
```

**Step 3 — Approve the prototype:**

```bash
curl -X POST http://127.0.0.1:3000/api/approve/REQUIREMENT_ID \
  -H "x-api-key: YOUR_API_KEY"
# Response: 200 OK with status "approved"
```

**Step 4 — Promote to production:**

```bash
curl -X POST http://127.0.0.1:3000/api/promote/REQUIREMENT_ID \
  -H "x-api-key: YOUR_API_KEY"
# Response: 200 OK with status "production"
```

**Step 5 — Verify production content has changed:**

```bash
curl http://127.0.0.1:3000/
# Response: The promoted prototype content (no longer "Hello, World!")
```
