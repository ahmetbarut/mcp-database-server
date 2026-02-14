import dotenv from 'dotenv';
import {
  SettingsSchema,
  Settings,
  DatabaseConfig,
  ServerConfig
} from '../types/config.js';
import { ConfigurationError } from '../utils/exceptions.js';
import { logger } from '../utils/logger.js';
import { ConnectionConfigStore } from './config-store.js';

// Load environment variables
dotenv.config();

/**
 * Configuration manager for MCP Database Server
 */
class ConfigManager {
  private settings: Settings | null = null;
  private configStore: ConnectionConfigStore | null = null;

  /**
   * Load and validate configuration from config store
   */
  async loadConfig(): Promise<Settings> {
    try {
      // Initialize config store if not already done
      if (!this.configStore) {
        this.configStore = new ConnectionConfigStore();
      }

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
   * Reload configuration (after web UI changes)
   */
  async reloadConfig(): Promise<Settings> {
    return this.loadConfig();
  }

  /**
   * Get the connection config store
   */
  getConfigStore(): ConnectionConfigStore | null {
    return this.configStore;
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
      encryptionKey,
      webUIPort: parseInt(process.env.WEB_UI_PORT || '3693', 10),
      webUIEnabled: process.env.WEB_UI_ENABLED !== 'false'
    };
  }

  /**
   * Build database configurations from SQLite config store
   */
  private buildDatabaseConfigs(): Record<string, DatabaseConfig> {
    const databases: Record<string, DatabaseConfig> = {};

    if (this.configStore) {
      const storedConfigs = this.configStore.getAll();
      for (const config of storedConfigs) {
        databases[config.name] = config;
      }
      if (storedConfigs.length > 0) {
        logger.info(`Loaded ${storedConfigs.length} connections from config store`, {
          connectionNames: storedConfigs.map(c => c.name)
        });
      }
    }

    if (Object.keys(databases).length === 0) {
      logger.warn('No database connections configured. Use the Web UI to add connections.');
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
