import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { DatabaseConfig, DatabaseConfigSchema } from '../types/config.js';
import { logger } from '../utils/logger.js';

const DEFAULT_CONFIG_DIR = path.join(homedir(), '.mcp-database-server');
const DEFAULT_DB_PATH = path.join(DEFAULT_CONFIG_DIR, 'connections.db');

/**
 * SQLite-backed storage for database connection configurations
 */
export class ConnectionConfigStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.CONFIG_DB_PATH || DEFAULT_DB_PATH;

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    mkdirSync(dir, { recursive: true });

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();

    logger.info('Connection config store initialized', { path: resolvedPath });
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        type        TEXT NOT NULL CHECK(type IN ('sqlite', 'postgresql', 'mysql')),
        host        TEXT,
        port        INTEGER,
        database_name TEXT,
        username    TEXT,
        password    TEXT,
        path        TEXT,
        max_connections INTEGER DEFAULT 10,
        timeout     INTEGER DEFAULT 30000,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  getAll(): DatabaseConfig[] {
    const rows = this.db.prepare('SELECT * FROM connections ORDER BY name').all() as any[];
    return rows.map(row => this.rowToConfig(row));
  }

  getByName(name: string): DatabaseConfig | null {
    const row = this.db.prepare('SELECT * FROM connections WHERE name = ?').get(name) as any;
    return row ? this.rowToConfig(row) : null;
  }

  create(config: DatabaseConfig): void {
    const validated = DatabaseConfigSchema.parse(config);

    this.db.prepare(`
      INSERT INTO connections (name, type, host, port, database_name, username, password, path, max_connections, timeout)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.name,
      validated.type,
      validated.host ?? null,
      validated.port ?? null,
      validated.database ?? null,
      validated.username ?? null,
      validated.password ?? null,
      validated.path ?? null,
      validated.maxConnections,
      validated.timeout
    );

    logger.info('Connection config created', { name: validated.name, type: validated.type });
  }

  update(name: string, config: Partial<DatabaseConfig>): void {
    const existing = this.getByName(name);
    if (!existing) {
      throw new Error(`Connection '${name}' not found`);
    }

    const merged = { ...existing, ...config, name: config.name ?? name };
    const validated = DatabaseConfigSchema.parse(merged);

    this.db.prepare(`
      UPDATE connections
      SET name = ?, type = ?, host = ?, port = ?, database_name = ?, username = ?, password = ?,
          path = ?, max_connections = ?, timeout = ?, updated_at = datetime('now')
      WHERE name = ?
    `).run(
      validated.name,
      validated.type,
      validated.host ?? null,
      validated.port ?? null,
      validated.database ?? null,
      validated.username ?? null,
      validated.password ?? null,
      validated.path ?? null,
      validated.maxConnections,
      validated.timeout,
      name
    );

    logger.info('Connection config updated', { name });
  }

  delete(name: string): void {
    const result = this.db.prepare('DELETE FROM connections WHERE name = ?').run(name);
    if (result.changes === 0) {
      throw new Error(`Connection '${name}' not found`);
    }
    logger.info('Connection config deleted', { name });
  }

  close(): void {
    this.db.close();
  }

  private rowToConfig(row: any): DatabaseConfig {
    return DatabaseConfigSchema.parse({
      type: row.type,
      name: row.name,
      host: row.host ?? undefined,
      port: row.port ?? undefined,
      database: row.database_name ?? undefined,
      username: row.username ?? undefined,
      password: row.password ?? undefined,
      path: row.path ?? undefined,
      maxConnections: row.max_connections,
      timeout: row.timeout,
    });
  }
}
