# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Database Server (`@ahmetbarut/mcp-database-server`) — a Model Context Protocol server enabling AI assistants to execute SQL queries across SQLite, PostgreSQL, and MySQL databases. Communicates via JSON-RPC over stdio. Published as an NPM package.

## Commands

```bash
npm run build          # Compile TypeScript (tsc)
npm run dev            # Hot-reload dev server (nodemon + ts-node --esm)
npm test               # Run all tests (jest)
npm run test:watch     # Jest watch mode
npm run test:coverage  # Jest with coverage report (80% threshold)
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run type-check     # TypeScript type check without emitting
```

Run a single test file: `npx jest tests/unit/server/mcp-server.test.ts`

## Architecture

**ES Modules throughout** — the project uses `"type": "module"` with ESNext modules. All internal imports use `.js` extensions (e.g., `from './server/index.js'`).

### Core Flow
`src/index.ts` (CLI entry) → `MCPDatabaseServer` (src/server/mcp-server.ts) → loads config → initializes database connections → starts MCP stdio transport.

### Key Modules

- **src/server/mcp-server.ts** — Central class `MCPDatabaseServer`. Registers MCP request handlers and implements 4 tools: `execute_query`, `list_databases`, `list_connections`, `retry_failed_connections`.
- **src/database/base.ts** — Abstract `BaseDatabaseDriver` defining the unified driver interface (`connect`, `disconnect`, `executeQuery`, `listTables`, `describeTable`, transactions).
- **src/database/drivers/** — Concrete drivers: `SQLiteDriver` (better-sqlite3), `PostgreSQLDriver` (pg), `MySQLDriver` (mysql2/promise).
- **src/database/factory.ts** — `DatabaseConnectionManager` manages multiple named connections, tracks status, handles retries.
- **src/config/settings.ts** — `ConfigManager` loads database configs from: (1) `DATABASE_CONNECTIONS_FILE` env var pointing to a JSON file, (2) `DATABASE_CONNECTIONS` env var with inline JSON, (3) individual env vars like `SQLITE_DB_PATH`, `POSTGRES_HOST`, etc. Validates with Zod.
- **src/types/** — TypeScript interfaces and Zod schemas for config, database, and MCP protocol types.
- **src/utils/** — Winston logger (all logs to stderr; stdout reserved for MCP JSON-RPC), custom exception hierarchy (`MCPDatabaseError` and subclasses), helper utilities.

### Testing

Tests live in `tests/unit/`. Jest is configured with `ts-jest` ESM preset. Tests mock the logger and config manager. Two test suites: `mcp-server.test.ts` (server behavior) and `settings.test.ts` (config loading).

## Key Conventions

- **Parameterized queries only** — never use string concatenation for SQL.
- **Zod validation** for all configuration and user inputs.
- **Logging**: use the Winston `logger` from `src/utils/logger.ts`. All output goes to stderr to keep stdout clean for MCP protocol.
- **Error classes**: use the custom exception hierarchy in `src/utils/exceptions.ts` (`DatabaseConnectionError`, `QueryExecutionError`, `ValidationError`, `SecurityError`, `ConfigurationError`, `MCPProtocolError`).
- **Code style**: Prettier with 2-space indentation, ESLint with TypeScript recommended rules, camelCase for variables/functions, PascalCase for classes/interfaces.
- Node.js >=18.0.0 required.
