# Test1

A minimal, single-file Node.js HTTP server that responds with "Hello, World!" to every incoming request. Built using the Node.js built-in `http` module with zero external dependencies.

## Prerequisites

- **Node.js** v4.x or later is required (the server uses ES6 features including `const`, arrow functions, and template literals)
- No npm packages are needed — this project has no `package.json` and no external dependencies
- No build tools or compilation steps are required

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

### Verifying with curl

```bash
curl http://127.0.0.1:3000/
```

**Expected response:**

```
Hello, World!
```

### Accessing via Browser

Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in any web browser to see the "Hello, World!" response.

## Configuration

The server configuration is defined as hardcoded constants in `server.js` (lines 3–4):

| Parameter | Value | Description |
|-----------|-------|-------------|
| Hostname | `127.0.0.1` | Loopback interface — accepts connections from the local machine only |
| Port | `3000` | TCP port the server listens on |

To change the hostname or port, edit the corresponding constant values directly in `server.js`:

```javascript
const hostname = '127.0.0.1'; // Change to '0.0.0.0' to accept external connections
const port = 3000;             // Change to any available port number
```

## API Behavior

The server responds identically to **all** HTTP requests regardless of method (GET, POST, PUT, DELETE, etc.) or URL path. There is no routing logic — every request receives the same response.

### Response Contract

| Property | Value |
|----------|-------|
| Status Code | `200 OK` |
| Header | `Content-Type: text/plain` |
| Body | `Hello, World!\n` |

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

Any other method or path produces the same response:

```bash
curl -X POST http://127.0.0.1:3000/any/path
# Output: Hello, World!
```

## Project Structure

```
Test1/
├── server.js    # Node.js HTTP server (main application)
└── README.md    # Project documentation
```

- **`server.js`** — The entire application. Creates an HTTP server using the Node.js built-in `http` module, binds to `127.0.0.1:3000`, and responds to all requests with a plain-text "Hello, World!" message.
- **`README.md`** — This documentation file.
