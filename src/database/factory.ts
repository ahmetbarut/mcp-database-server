import { DatabaseConfig } from '../types/config.js';
import { DatabaseDriver } from '../types/database.js';
import { PostgreSQLDriver, MySQLDriver, SQLiteDriver } from './drivers/index.js';
import { logger } from '../utils/logger.js';

/**
 * Database driver factory
 * Creates the appropriate driver instance based on database type
 */
export class DatabaseDriverFactory {
  static createDriver(config: DatabaseConfig): DatabaseDriver {
    logger.debug('Creating database driver', {
      type: config.type,
      name: config.name,
    });

    switch (config.type) {
      case 'postgresql':
        return new PostgreSQLDriver(config);
      
      case 'mysql':
        return new MySQLDriver(config);
      
      case 'sqlite':
        return new SQLiteDriver(config);
      
      default:
        throw new Error(`Unsupported database type: ${(config as any).type}`);
    }
  }

  /**
   * Validate database configuration before creating driver
   */
  static validateConfig(config: DatabaseConfig): void {
    if (!config.name) {
      throw new Error('Database name is required');
    }

    switch (config.type) {
      case 'postgresql':
      case 'mysql':
        if (!config.host) {
          throw new Error(`Host is required for ${config.type} database`);
        }
        if (!config.database) {
          throw new Error(`Database name is required for ${config.type} database`);
        }
        if (!config.username) {
          throw new Error(`Username is required for ${config.type} database`);
        }
        break;
      
      case 'sqlite':
        if (!config.path) {
          throw new Error('Path is required for SQLite database');
        }
        break;
      
      default:
        throw new Error(`Unsupported database type: ${(config as any).type}`);
    }
  }

  /**
   * Create and connect to database driver
   */
  static async createAndConnect(config: DatabaseConfig): Promise<DatabaseDriver> {
    this.validateConfig(config);
    
    const driver = this.createDriver(config);
    await driver.connect();
    
    logger.info('Database driver created and connected', {
      type: config.type,
      name: config.name,
    });
    
    return driver;
  }
}

/**
 * Database connection manager
 * Manages multiple database connections
 */
export class DatabaseConnectionManager {
  private connections: Map<string, DatabaseDriver> = new Map();

  /**
   * Add a database connection
   */
  async addConnection(config: DatabaseConfig): Promise<void> {
    try {
      if (this.connections.has(config.name)) {
        logger.warn('Connection already exists, replacing', { name: config.name });
        await this.removeConnection(config.name);
      }

      const driver = await DatabaseDriverFactory.createAndConnect(config);
      this.connections.set(config.name, driver);
      
      logger.info('Database connection added', {
        name: config.name,
        type: config.type,
      });
    } catch (error) {
      logger.error('Failed to add database connection', error as Error, {
        name: config.name,
        type: config.type,
      });
      throw error;
    }
  }

  /**
   * Remove a database connection
   */
  async removeConnection(name: string): Promise<void> {
    const driver = this.connections.get(name);
    if (driver) {
      try {
        await driver.disconnect();
        this.connections.delete(name);
        
        logger.info('Database connection removed', { name });
      } catch (error) {
        logger.error('Error disconnecting database', error as Error, { name });
        throw error;
      }
    }
  }

  /**
   * Get a database connection by name
   */
  getConnection(name: string): DatabaseDriver | undefined {
    return this.connections.get(name);
  }

  /**
   * Get all connection names
   */
  getConnectionNames(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection status for all connections
   */
  getConnectionStatus(): Array<{
    name: string;
    connected: boolean;
    type?: string;
  }> {
    return Array.from(this.connections.entries()).map(([name, driver]) => ({
      name,
      connected: driver.isConnected(),
      type: (driver as any).config?.type,
    }));
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.entries()).map(
      async ([name, driver]) => {
        try {
          await driver.disconnect();
          logger.info('Disconnected from database', { name });
        } catch (error) {
          logger.error('Error disconnecting from database', error as Error, { name });
        }
      }
    );

    await Promise.all(disconnectPromises);
    this.connections.clear();
    
    logger.info('All database connections disconnected');
  }

  /**
   * Initialize connections from configuration
   */
  async initializeConnections(configs: Record<string, DatabaseConfig>): Promise<void> {
    const connectionPromises = Object.entries(configs).map(async ([key, config]) => {
      try {
        await this.addConnection(config);
      } catch (error) {
        logger.error('Failed to initialize connection', error as Error, {
          key,
          name: config.name,
          type: config.type,
        });
        // Don't throw here - we want to continue with other connections
      }
    });

    await Promise.all(connectionPromises);
    
    logger.info('Database connections initialization completed', {
      totalConnections: Object.keys(configs).length,
      successfulConnections: this.connections.size,
    });
  }
} 