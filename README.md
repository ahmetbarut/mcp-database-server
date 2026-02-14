# MCP Database Server

A Model Context Protocol (MCP) server that provides multi-database query execution capabilities with support for SQLite, PostgreSQL, and MySQL databases. Includes a built-in Web UI for managing database connections.

## NPM Package

**Available on NPM:** [`@ahmetbarut/mcp-database-server`](https://www.npmjs.com/package/@ahmetbarut/mcp-database-server)

```bash
# Use with npx (no installation required)
npx @ahmetbarut/mcp-database-server

# Or install globally
npm install -g @ahmetbarut/mcp-database-server
```

## Features

- **Multi-Database Support**: SQLite, PostgreSQL, and MySQL with real connections
- **Web UI**: Built-in browser interface for managing database connections
- **SQLite Config Store**: All connection configs persisted locally in `~/.mcp-database-server/connections.db`
- **MCP Protocol Compliance**: Full JSON-RPC implementation with complete tool support
- **Smart Auto-Detection**: Automatically selects single active connection for queries
- **Connection Recovery**: Retry failed connections with detailed error reporting
- **Security First**: Parameterized queries, SQL injection protection, audit logging
- **SSL Support**: Configurable SSL per connection
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Node.js v23 Compatible**: Works with latest Node.js versions

## Quick Start

```bash
npx @ahmetbarut/mcp-database-server
```

Server starts and Web UI opens at **http://localhost:3693**. Add your database connections from the browser.

## Web UI

The built-in Web UI provides a visual interface for managing database connections:

- **Add/Edit/Delete** database connections (SQLite, PostgreSQL, MySQL)
- **Test connections** before saving
- **SSL toggle** for network databases
- **Persistent storage** — connections survive server restarts

Access it at `http://localhost:3693` when the server is running.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WEB_UI_PORT` | `3693` | Web UI port |
| `WEB_UI_ENABLED` | `true` | Enable/disable Web UI |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

## MCP Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"]
    }
  }
}
```

### Cursor IDE

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"]
    }
  }
}
```

### Custom Port

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"],
      "env": {
        "WEB_UI_PORT": "4000"
      }
    }
  }
}
```

After starting, open the Web UI in your browser to add database connections.

## MCP Tools

### `execute_query`

Execute SQL queries on a database connection with parameterized query support.

```json
{
  "connection_name": "my-postgres",
  "query": "SELECT * FROM users WHERE status = $1",
  "parameters": ["active"]
}
```

### `list_databases`

List databases from a specific connection or all configured connections. Supports smart auto-detection when only one connection is active.

```json
{
  "connection_name": "my-postgres"
}
```

### `list_connections`

List all database connections with status and details.

```json
{
  "include_credentials": false
}
```

### `retry_failed_connections`

Retry failed database connections.

```json
{
  "connection_name": "my-postgres"
}
```

## Connection Configuration

All database connections are managed through the **Web UI** and stored in a local SQLite database at `~/.mcp-database-server/connections.db`.

### Supported Database Types

**SQLite**
- Path to database file

**PostgreSQL**
- Host, port, database, username, password
- SSL support (optional)

**MySQL**
- Host, port, database, username, password
- SSL support (optional)

### Connection Settings

| Setting | Default | Description |
|---|---|---|
| `maxConnections` | `10` | Maximum connection pool size |
| `timeout` | `30000` | Connection timeout in milliseconds |
| `ssl` | `false` | Enable SSL for the connection |

## Development

```bash
# Clone the repository
git clone https://github.com/ahmetbarut/mcp-database-server.git
cd mcp-database-server

# Install dependencies
npm install

# Development mode (hot-reload)
npm run dev

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Type check
npm run type-check
```

## Project Structure

```
mcp-database-server/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── server/
│   │   └── mcp-server.ts     # MCP server, tool handlers
│   ├── database/
│   │   ├── base.ts           # Abstract base driver
│   │   ├── factory.ts        # Driver factory & connection manager
│   │   └── drivers/          # SQLite, PostgreSQL, MySQL drivers
│   ├── config/
│   │   ├── settings.ts       # Config manager (loads from SQLite store)
│   │   └── config-store.ts   # SQLite-backed connection storage
│   ├── web/
│   │   ├── web-server.ts     # HTTP server for Web UI
│   │   ├── routes.ts         # REST API endpoints
│   │   └── ui.ts             # Embedded HTML/CSS/JS interface
│   ├── types/                # TypeScript types & Zod schemas
│   └── utils/                # Logger, exceptions, helpers
├── tests/unit/               # Jest test suites
└── dist/                     # Compiled output
```

## Architecture

```
npx @ahmetbarut/mcp-database-server
    │
    ├── MCPDatabaseServer
    │   ├── MCP stdio transport (JSON-RPC)
    │   ├── DatabaseConnectionManager
    │   └── WebUIServer (http://localhost:3693)
    │
    └── ConnectionConfigStore (~/.mcp-database-server/connections.db)
        └── SQLite database with connection configs
```

1. **Config Store** loads saved connections from local SQLite DB
2. **Connection Manager** initializes database drivers for each config
3. **MCP Server** exposes tools via JSON-RPC over stdio
4. **Web UI** provides browser-based CRUD for connections via REST API

## Security

- **Parameterized queries** — prevents SQL injection
- **Credential masking** — passwords hidden in `list_connections` output
- **Audit logging** — all operations logged via Winston
- **Input validation** — Zod schemas for all configuration

## Testing

```
Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total
```

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## Troubleshooting

**Web UI not accessible**
- Check if port 3693 is already in use
- Try a different port: `WEB_UI_PORT=4000`

**Connection failed**
- Use the "Test Connection" button in Web UI before saving
- Verify database server is running and accessible
- Check credentials and network connectivity
- For PostgreSQL: disable SSL if server doesn't support it

**MCP client can't connect**
- Ensure `npx @ahmetbarut/mcp-database-server` runs without errors
- Restart the MCP client after config changes
- Check MCP client logs for error details

## License

MIT License - see LICENSE file for details.

## Contributing

1. Follow TypeScript coding standards
2. Add tests for new functionality
3. Update documentation for API changes
4. Follow security guidelines

## Support

For issues and questions, use the [GitHub issue tracker](https://github.com/ahmetbarut/mcp-database-server/issues).
