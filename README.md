# Test1

A database metadata monitoring and analytics service built with Node.js and SQLite. Provides REST API endpoints for tracking table metadata, query execution statistics, table dependencies, and schema change history.

## Prerequisites

- **Node.js** v14.21.1 or later (v20.x LTS recommended)
- **npm** (comes bundled with Node.js)
- A C++ compiler may be required for `better-sqlite3` native addon compilation if pre-built binaries are not available for your platform (pre-built binaries are provided for all active Node.js LTS versions)

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

   This installs `better-sqlite3`, the synchronous SQLite3 driver used for the persistence layer.

3. **Start the server:**

   ```bash
   node server.js
   ```

4. **Expected terminal output:**

   ```
   Database initialized successfully
   Server running at http://127.0.0.1:3000/
   ```

The server is now running and ready to accept HTTP requests. The SQLite database file is automatically created at `./data/metadata.db` on first startup.

## Usage

### Starting the Server

```bash
npm start
```

Or directly:

```bash
node server.js
```

### Creating a Table Metadata Record (POST)

```bash
curl -X POST http://127.0.0.1:3000/api/tables-metadata \
  -H "Content-Type: application/json" \
  -d '{"table_id": 1, "table_name": "users", "row_count": 15000, "last_modified": "2025-02-19"}'
```

**Response** (`201 Created`):

```json
{
  "table_id": 1,
  "table_name": "users",
  "row_count": 15000,
  "last_modified": "2025-02-19"
}
```

### Listing All Table Metadata Records (GET)

```bash
curl http://127.0.0.1:3000/api/tables-metadata
```

**Response** (`200 OK`):

```json
[
  {
    "table_id": 1,
    "table_name": "users",
    "row_count": 15000,
    "last_modified": "2025-02-19"
  }
]
```

### Getting a Single Record by ID (GET)

```bash
curl http://127.0.0.1:3000/api/tables-metadata/1
```

**Response** (`200 OK`):

```json
{
  "table_id": 1,
  "table_name": "users",
  "row_count": 15000,
  "last_modified": "2025-02-19"
}
```

### Updating a Record (PUT)

```bash
curl -X PUT http://127.0.0.1:3000/api/tables-metadata/1 \
  -H "Content-Type: application/json" \
  -d '{"table_name": "users", "row_count": 16500, "last_modified": "2025-02-20"}'
```

**Response** (`200 OK`):

```json
{
  "table_id": 1,
  "table_name": "users",
  "row_count": 16500,
  "last_modified": "2025-02-20"
}
```

### Deleting a Record (DELETE)

```bash
curl -X DELETE http://127.0.0.1:3000/api/tables-metadata/1
```

**Response** (`200 OK`):

```json
{
  "message": "Record deleted successfully"
}
```

### Query Execution Stats Example (POST)

```bash
curl -X POST http://127.0.0.1:3000/api/query-execution-stats \
  -H "Content-Type: application/json" \
  -d '{"query_id": 1, "table_id": 1, "avg_execution_time_ms": 45.7, "execution_count": 320, "error_count": 2}'
```

**Response** (`201 Created`):

```json
{
  "query_id": 1,
  "table_id": 1,
  "avg_execution_time_ms": 45.7,
  "execution_count": 320,
  "error_count": 2
}
```

### Table Dependencies Example (POST)

```bash
curl -X POST http://127.0.0.1:3000/api/table-dependencies \
  -H "Content-Type: application/json" \
  -d '{"parent_table_id": 1, "dependent_object": "user_sessions"}'
```

**Response** (`201 Created`):

```json
{
  "parent_table_id": 1,
  "dependent_object": "user_sessions"
}
```

### Schema Changes Example (POST)

```bash
curl -X POST http://127.0.0.1:3000/api/schema-changes \
  -H "Content-Type: application/json" \
  -d '{"table_id": 1, "change_date": "2025-02-19"}'
```

**Response** (`201 Created`):

```json
{
  "table_id": 1,
  "change_date": "2025-02-19"
}
```

## Configuration

All configuration is centralized in `src/config/index.js`. The following constants control server and database behavior:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `hostname` | `127.0.0.1` | Network interface the server binds to. Use `0.0.0.0` to accept external connections. |
| `port` | `3000` | TCP port the server listens on. |
| `dbPath` | `./data/metadata.db` | File path for the SQLite database. The `data/` directory is created automatically if it does not exist. |

To change these values, edit `src/config/index.js`:

```javascript
const hostname = '127.0.0.1';
const port = 3000;
const dbPath = './data/metadata.db';
```

## API Endpoints

All endpoints return JSON responses with `Content-Type: application/json`.

### HTTP Status Codes

| Status Code | Meaning |
|-------------|---------|
| `200` | Success — record(s) retrieved, updated, or deleted |
| `201` | Created — new record inserted successfully |
| `400` | Bad Request — missing or invalid request body |
| `404` | Not Found — record or endpoint does not exist |
| `500` | Server Error — unexpected internal error |

### Tables Metadata (`/api/tables-metadata`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tables-metadata` | List all table metadata records |
| `GET` | `/api/tables-metadata/:id` | Get a single record by `table_id` |
| `POST` | `/api/tables-metadata` | Create a new table metadata record |
| `PUT` | `/api/tables-metadata/:id` | Update an existing record by `table_id` |
| `DELETE` | `/api/tables-metadata/:id` | Delete a record by `table_id` |

### Query Execution Stats (`/api/query-execution-stats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/query-execution-stats` | List all query execution stats |
| `GET` | `/api/query-execution-stats/:id` | Get a single record by `query_id` |
| `POST` | `/api/query-execution-stats` | Create a new query execution stats record |
| `PUT` | `/api/query-execution-stats/:id` | Update an existing record by `query_id` |
| `DELETE` | `/api/query-execution-stats/:id` | Delete a record by `query_id` |

### Table Dependencies (`/api/table-dependencies`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/table-dependencies` | List all table dependency records |
| `GET` | `/api/table-dependencies/:parentTableId` | Get dependencies by `parent_table_id` |
| `POST` | `/api/table-dependencies` | Create a new table dependency record |
| `DELETE` | `/api/table-dependencies/:parentTableId/:dependentObject` | Delete a specific dependency |

### Schema Changes (`/api/schema-changes`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/schema-changes` | List all schema change records |
| `GET` | `/api/schema-changes/:tableId` | Get schema changes by `table_id` |
| `POST` | `/api/schema-changes` | Create a new schema change record |
| `DELETE` | `/api/schema-changes/:tableId/:changeDate` | Delete a specific schema change record |

## Database Schema

The service uses SQLite for persistence via the `better-sqlite3` driver. The database file is auto-created at `./data/metadata.db` on first startup. WAL (Write-Ahead Logging) mode and foreign key enforcement are enabled via PRAGMAs for performance and data integrity.

### tables_metadata

Tracks metadata about database tables.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `table_id` | `INTEGER` | `PRIMARY KEY` | Unique identifier for the table |
| `table_name` | `TEXT` | `NOT NULL` | Name of the database table |
| `row_count` | `INTEGER` | | Number of rows in the table |
| `last_modified` | `TEXT` | | Last modification date (ISO 8601 format, e.g. `YYYY-MM-DD`) |

### query_execution_stats

Records query performance metrics per table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `query_id` | `INTEGER` | `PRIMARY KEY` | Unique identifier for the query record |
| `table_id` | `INTEGER` | `REFERENCES tables_metadata(table_id)` | Foreign key linking to the monitored table |
| `avg_execution_time_ms` | `REAL` | | Average query execution time in milliseconds |
| `execution_count` | `INTEGER` | | Total number of times the query was executed |
| `error_count` | `INTEGER` | | Number of execution errors encountered |

### table_dependencies

Maps parent-child relationships between database tables.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `parent_table_id` | `INTEGER` | `REFERENCES tables_metadata(table_id)` | Foreign key to the parent table |
| `dependent_object` | `TEXT` | `NOT NULL` | Name of the dependent object (table, view, etc.) |

Primary key: composite on `(parent_table_id, dependent_object)`.

### schema_changes

Logs schema modification events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `table_id` | `INTEGER` | `REFERENCES tables_metadata(table_id)` | Foreign key to the affected table |
| `change_date` | `TEXT` | `NOT NULL` | Date of the schema change (ISO 8601 format, e.g. `YYYY-MM-DD`) |

Primary key: composite on `(table_id, change_date)`.

## Project Structure

```
Test1/
├── server.js                    # Entry point — initializes DB and starts HTTP server
├── package.json                 # Project manifest and dependencies
├── .gitignore                   # Git ignore rules
├── README.md                    # Project documentation
├── src/
│   ├── config/
│   │   └── index.js             # Server and database configuration
│   ├── db/
│   │   ├── connection.js        # SQLite database connection singleton
│   │   └── schema.js            # Table schema initialization
│   ├── models/
│   │   ├── tablesMetadata.js    # CRUD for tables_metadata
│   │   ├── queryExecutionStats.js # CRUD for query_execution_stats
│   │   ├── tableDependencies.js # CRUD for table_dependencies
│   │   └── schemaChanges.js     # CRUD for schema_changes
│   └── routes/
│       ├── index.js             # Central route dispatcher
│       ├── tablesMetadata.js    # Routes for /api/tables-metadata
│       ├── queryExecutionStats.js # Routes for /api/query-execution-stats
│       ├── tableDependencies.js # Routes for /api/table-dependencies
│       └── schemaChanges.js     # Routes for /api/schema-changes
└── blitzy/
    └── documentation/           # Blitzy platform artifacts
```

### Directory Descriptions

| Directory | Purpose |
|-----------|---------|
| `src/config/` | Centralized configuration constants for the server (hostname, port) and database (file path) |
| `src/db/` | Database connection management (singleton `better-sqlite3` instance) and schema initialization (`CREATE TABLE` DDL) |
| `src/models/` | Data access layer — each model encapsulates CRUD operations for one database table using prepared statements |
| `src/routes/` | HTTP request handling — URL and method dispatching to model operations, JSON parsing, and response formatting |
| `blitzy/documentation/` | Internal Blitzy platform documentation artifacts (not part of the application) |
