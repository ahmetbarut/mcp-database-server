import { z } from 'zod';

/**
 * Database configuration schema for different database types
 */
export const DatabaseConfigSchema = z.object({
  type: z.enum(['sqlite', 'postgresql', 'mysql']),
  name: z.string(),
  // SQLite specific
  path: z.string().optional(),
  // Network database specific
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  // Connection settings
  maxConnections: z.number().default(10),
  timeout: z.number().default(30000)
});

/**
 * JSON Database connections array schema
 * For parsing DATABASE_CONNECTIONS environment variable
 */
export const DatabaseConnectionsArraySchema = z.array(DatabaseConfigSchema);

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(8000),
  logLevel: z.string().default('info'),
  enableAuditLogging: z.boolean().default(true),
  enableRateLimiting: z.boolean().default(true),
  secretKey: z.string(),
  encryptionKey: z.string()
});

/**
 * Main settings schema combining all configurations
 */
export const SettingsSchema = z.object({
  databases: z.record(DatabaseConfigSchema),
  server: ServerConfigSchema
});

// Type exports
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type DatabaseConnectionsArray = z.infer<typeof DatabaseConnectionsArraySchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Database connection status
 */
export interface DatabaseStatus {
  name: string;
  type: DatabaseConfig['type'];
  connected: boolean;
  lastConnected?: Date;
  error?: string;
}

/**
 * Query execution context
 */
export interface QueryContext {
  databaseName: string;
  query: string;
  parameters?: unknown[];
  userId?: string;
  timestamp: Date;
} 