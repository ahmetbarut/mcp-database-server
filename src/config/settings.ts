import dotenv from 'dotenv';
import { 
  SettingsSchema, 
  Settings, 
  DatabaseConfig, 
  DatabaseConnectionsArray,
  DatabaseConnectionsArraySchema,
  ServerConfig 
} from '../types/config.js';
import { ConfigurationError } from '../utils/exceptions.js';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Configuration manager for MCP Database Server
 */
class ConfigManager {
  private settings: Settings | null = null;

  /**
   * Load and validate configuration from environment variables and config files
   */
  async loadConfig(): Promise<Settings> {
    try {
      // Build configuration from environment variables
      const config = {
        server: this.buildServerConfig(),
        databases: this.buildDatabaseConfigs()
      };

      // Validate configuration with Zod
      this.settings = SettingsSchema.parse(config);
      
      logger.info('Configuration loaded successfully', {
        databaseCount: Object.keys(this.settings.databases).length,
        serverPort: this.settings.server.port,
        databaseNames: Object.keys(this.settings.databases)
      });

      return this.settings;
    } catch (error) {
      logger.error('Failed to load configuration', error as Error);
      throw new ConfigurationError(`Configuration validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get current settings (must call loadConfig first)
   */
  getSettings(): Settings {
    if (!this.settings) {
      throw new ConfigurationError('Configuration not loaded. Call loadConfig() first.');
    }
    return this.settings;
  }

  /**
   * Build server configuration from environment variables
   */
  private buildServerConfig(): ServerConfig {
    const secretKey = process.env.SECRET_KEY || 'development-secret-key';
    const encryptionKey = process.env.ENCRYPTION_KEY || 'development-encryption-key';

    return {
      host: process.env.SERVER_HOST || 'localhost',
      port: parseInt(process.env.SERVER_PORT || '8000', 10),
      logLevel: process.env.LOG_LEVEL || 'info',
      enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      secretKey,
      encryptionKey
    };
  }

  /**
   * Build database configurations from environment variables
   * Supports both individual env vars and JSON array format
   */
  private buildDatabaseConfigs(): Record<string, DatabaseConfig> {
    const databases: Record<string, DatabaseConfig> = {};

    // First, try to parse DATABASE_CONNECTIONS JSON array
    if (process.env.DATABASE_CONNECTIONS) {
      try {
        const jsonConnections = this.parseJsonConnections(process.env.DATABASE_CONNECTIONS);
        
        // Convert array to record using name as key
        for (const connection of jsonConnections) {
          databases[connection.name] = connection;
        }
        
        logger.info(`Loaded ${jsonConnections.length} database connections from DATABASE_CONNECTIONS`, {
          connectionNames: jsonConnections.map(c => c.name)
        });
      } catch (error) {
        logger.error('Failed to parse DATABASE_CONNECTIONS JSON', error as Error);
        throw new ConfigurationError(`Invalid DATABASE_CONNECTIONS JSON: ${(error as Error).message}`);
      }
    }

    // Then, add individual database configurations (these will override JSON if same name exists)
    const individualDatabases = this.buildIndividualDatabaseConfigs();
    Object.assign(databases, individualDatabases);

    if (Object.keys(databases).length === 0) {
      logger.warn('No database configurations found in environment variables');
    }

    return databases;
  }

  /**
   * Parse DATABASE_CONNECTIONS JSON string into validated array
   */
  private parseJsonConnections(jsonString: string): DatabaseConnectionsArray {
    try {
      const parsed = JSON.parse(jsonString);
      return DatabaseConnectionsArraySchema.parse(parsed);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ConfigurationError(`Invalid JSON in DATABASE_CONNECTIONS: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build database configurations from individual environment variables (legacy support)
   */
  private buildIndividualDatabaseConfigs(): Record<string, DatabaseConfig> {
    const databases: Record<string, DatabaseConfig> = {};

    // SQLite database
    if (process.env.SQLITE_DB_PATH) {
      databases.sqlite = {
        type: 'sqlite',
        name: 'sqlite',
        path: process.env.SQLITE_DB_PATH,
        maxConnections: parseInt(process.env.MAX_CONNECTIONS || '10', 10),
        timeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10)
      };
    }

    // PostgreSQL database
    if (process.env.POSTGRES_HOST) {
      databases.postgres = {
        type: 'postgresql',
        name: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DATABASE,
        username: process.env.POSTGRES_USERNAME,
        password: process.env.POSTGRES_PASSWORD,
        maxConnections: parseInt(process.env.MAX_CONNECTIONS || '10', 10),
        timeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10)
      };
    }

    // MySQL database
    if (process.env.MYSQL_HOST) {
      databases.mysql = {
        type: 'mysql',
        name: 'mysql',
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        database: process.env.MYSQL_DATABASE,
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        maxConnections: parseInt(process.env.MAX_CONNECTIONS || '10', 10),
        timeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10)
      };
    }

    if (Object.keys(databases).length > 0) {
      logger.info(`Loaded ${Object.keys(databases).length} database connections from individual environment variables`, {
        connectionNames: Object.keys(databases)
      });
    }

    return databases;
  }

  /**
   * Get database configuration by name
   */
  getDatabaseConfig(name: string): DatabaseConfig {
    const settings = this.getSettings();
    const config = settings.databases[name];
    
    if (!config) {
      throw new ConfigurationError(`Database '${name}' not found in configuration`);
    }
    
    return config;
  }

  /**
   * List all configured database names
   */
  getDatabaseNames(): string[] {
    const settings = this.getSettings();
    return Object.keys(settings.databases);
  }
}

// Export singleton instance
export const configManager = new ConfigManager(); 