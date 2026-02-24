# Test1

A modular, performance-optimized Node.js HTTP server that responds with "Hello, World!" to every incoming request. Refactored from a single-file server into a multi-file architecture with multi-core clustering, response compression, health monitoring, structured logging, and graceful shutdown — all powered by Node.js built-in modules with zero external runtime dependencies.

## Prerequisites

- **Node.js** v20.x LTS or later (recommended)
- **npm** (bundled with Node.js) — used to install development dependencies (Jest test framework)
- All runtime dependencies are Node.js built-in modules — zero external runtime packages are required
- No build tools or compilation steps are required

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd Test1
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   This installs the Jest test framework as a development dependency. No runtime packages are downloaded.

3. **Start the server:**

   ```bash
   node server.js
   ```

   Or start in clustered mode to utilize all CPU cores:

   ```bash
   ENABLE_CLUSTERING=true node server.js
   ```

4. **Expected terminal output:**

   ```
   [<timestamp>] [INFO] Server running at http://127.0.0.1:3000/ (PID: <pid>)
   ```

The server is now running and ready to accept HTTP requests.

## Usage

### Starting the Server

```bash
node server.js
```

### Starting in Clustered Mode

```bash
ENABLE_CLUSTERING=true node server.js
```

### Running the Test Suite

```bash
npm test
```

### Verifying with curl

```bash
curl http://127.0.0.1:3000/
```

**Expected response:**

```
Hello, World!
```

### Health Check Endpoint

```bash
curl http://127.0.0.1:3000/health
```

**Example response:**

```json
{
  "status": "OK",
  "uptime": 42.567,
  "timestamp": 1706745600000,
  "memoryUsage": {
    "rss": 30408704,
    "heapTotal": 6307840,
    "heapUsed": 5174528,
    "external": 404817
  },
  "pid": 12345
}
```

### Accessing via Browser

Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in any web browser to see the "Hello, World!" response.

## Configuration

Server configuration is driven by environment variables with sensible defaults. When no environment variables are set, the server behaves identically to the original single-file version — binding to `127.0.0.1` on port `3000` in single-process mode.

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Network interface to bind to |
| `PORT` | `3000` | TCP port to listen on |
| `ENABLE_CLUSTERING` | `false` | Enable multi-core clustering (one worker per CPU core) |
| `LOG_LEVEL` | `info` | Logging verbosity level (`silent`, `error`, `warn`, `info`) |
| `SHUTDOWN_TIMEOUT` | `5000` | Time in milliseconds to wait for in-flight requests to drain before force-killing |

See `.env.example` for a template configuration file. Copy it to `.env` and adjust values as needed:

```bash
cp .env.example .env
```

## API Behavior

The server responds identically to **all** HTTP requests regardless of method (GET, POST, PUT, DELETE, etc.) or URL path, with the sole exception of the `/health` endpoint. The `Hello, World!\n` response body is byte-identical to the original implementation.

### Response Contract

| Property | Value |
|----------|-------|
| Status Code | `200 OK` |
| Header | `Content-Type: text/plain` |
| Body | `Hello, World!\n` |

All paths except `/health` return this response, preserving the original method-agnostic and path-agnostic behavior.

### Health Check Endpoint

| Property | Value |
|----------|-------|
| URL | `GET /health` |
| Status Code | `200 OK` |
| Header | `Content-Type: application/json` |
| Body | JSON object with `status`, `uptime`, `timestamp`, `memoryUsage`, `pid` fields |

The `/health` endpoint is designed for monitoring integrations and load-balancer readiness probes.

### Example Request and Response

**Request:**

```
GET / HTTP/1.1
Host: 127.0.0.1:3000
```

**Response:**

```
HTTP/1.1 200 OK
Content-Type: text/plain

Hello, World!
```

Any other method or path (except `/health`) produces the same response:

```bash
curl -X POST http://127.0.0.1:3000/any/path
# Output: Hello, World!
```

## Architecture

The application follows a layered middleware pipeline architecture. Each incoming HTTP request flows through the following stages in order:

1. **Logger** — Records the request method, URL, status code, and response time
2. **Compression** — Negotiates gzip/deflate encoding via the `Accept-Encoding` header and compresses the response body
3. **Routing** — Directs `/health` requests to the health handler; all other paths to the Hello World handler
4. **Handler** — Produces the final response (`Hello, World!\n` or health check JSON)

All modules use CommonJS (`require`/`module.exports`) and follow the Single Responsibility Principle — each file handles exactly one concern.

## Clustering

Clustering is **optional** and **disabled by default**. When enabled, the application leverages the Node.js `cluster` module to fork one worker process per available CPU core, linearly increasing request throughput.

### How It Works

- The **primary process** detects available CPU cores, forks one worker per core, and monitors worker health
- Each **worker process** creates its own HTTP server instance, sharing the same port via the operating system's load-balancing
- If a worker crashes, the primary process automatically forks a replacement

### Enabling Clustering

```bash
ENABLE_CLUSTERING=true node server.js
```

When clustering is disabled (the default), the application runs as a single process — identical to the original behavior.

## Testing

The project uses [Jest](https://jestjs.io/) (v29.7.0) as its test framework. Run the full test suite with:

```bash
npm test
```

### Test Files

| File | Scope |
|------|-------|
| `tests/hello.test.js` | Verifies the core `Hello, World!\n` response contract across all HTTP methods and paths |
| `tests/health.test.js` | Validates the `/health` endpoint returns correct JSON with status, uptime, and memory fields |
| `tests/app.test.js` | Integration tests for the composed application including middleware pipeline and graceful shutdown |

## Project Structure

```
Test1/
├── package.json
├── .env.example
├── .gitignore
├── server.js
├── README.md
├── config/
│   └── index.js
├── src/
│   ├── app.js
│   ├── cluster.js
│   ├── handlers/
│   │   └── hello.js
│   ├── routes/
│   │   └── health.js
│   ├── middleware/
│   │   ├── logger.js
│   │   └── compression.js
│   └── utils/
│       └── graceful-shutdown.js
├── tests/
│   ├── hello.test.js
│   ├── health.test.js
│   └── app.test.js
└── blitzy/
    └── documentation/
        ├── Project Guide.md
        └── Technical Specifications.md
```

| File / Folder | Purpose |
|---------------|---------|
| `package.json` | Dependency manifest — defines project metadata, npm scripts, and Jest dev dependency |
| `.env.example` | Environment variable template — documents all available configuration options |
| `.gitignore` | Git ignore rules — excludes `node_modules/`, `.env`, logs, and coverage output |
| `server.js` | Entry point — delegates to clustering or direct app startup based on configuration |
| `config/index.js` | Centralized configuration — reads environment variables with sensible defaults |
| `src/app.js` | Application factory — creates the HTTP server and composes the middleware pipeline |
| `src/cluster.js` | Clustering logic — forks one worker per CPU core using the Node.js `cluster` module |
| `src/handlers/hello.js` | Hello World handler — returns the byte-identical `Hello, World!\n` response |
| `src/routes/health.js` | Health check route — returns JSON with server uptime, memory usage, and PID |
| `src/middleware/logger.js` | Request logger — logs method, URL, status code, and response time per request |
| `src/middleware/compression.js` | Response compression — applies gzip/deflate via the Node.js built-in `zlib` module |
| `src/utils/graceful-shutdown.js` | Graceful shutdown — handles `SIGINT`/`SIGTERM` signals and drains in-flight requests |
| `tests/` | Test suite — Jest-based unit and integration tests validating the complete business flow |
