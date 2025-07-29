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
 * Connection status interface
 */
interface ConnectionStatus {
  name: string;
  connected: boolean;
  type: string;
  error?: string;
  lastAttempt?: Date;
  config: DatabaseConfig;
}

/**
 * Database connection manager
 * Manages multiple database connections with improved error handling
 */
export class DatabaseConnectionManager {
  private connections: Map<string, DatabaseDriver> = new Map();
  private connectionStatuses: Map<string, ConnectionStatus> = new Map();

  /**
   * Add a database connection
   */
  async addConnection(config: DatabaseConfig): Promise<void> {
    try {
      // Update connection status to show attempt
      this.connectionStatuses.set(config.name, {
        name: config.name,
        connected: false,
        type: config.type,
        lastAttempt: new Date(),
        config
      });

      if (this.connections.has(config.name)) {
        logger.warn('Connection already exists, replacing', { name: config.name });
        await this.removeConnection(config.name);
      }

      const driver = await DatabaseDriverFactory.createAndConnect(config);
      this.connections.set(config.name, driver);
      
      // Update status to connected
      this.connectionStatuses.set(config.name, {
        name: config.name,
        connected: true,
        type: config.type,
        lastAttempt: new Date(),
        config
      });

      logger.info('Database connection added successfully', {
        name: config.name,
        type: config.type,
      });
    } catch (error) {
      // Update status with error
      this.connectionStatuses.set(config.name, {
        name: config.name,
        connected: false,
        type: config.type,
        error: (error as Error).message,
        lastAttempt: new Date(),
        config
      });

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
    
    // Remove from status tracking
    this.connectionStatuses.delete(name);
  }

  /**
   * Get a database connection by name
   */
  getConnection(name: string): DatabaseDriver | undefined {
    return this.connections.get(name);
  }

  /**
   * Get all connection names (both successful and failed)
   */
  getConnectionNames(): string[] {
    return Array.from(this.connectionStatuses.keys());
  }

  /**
   * Get all configured connection names (from status tracking)
   */
  getConfiguredConnectionNames(): string[] {
    return Array.from(this.connectionStatuses.keys());
  }

  /**
   * Get connection status for all connections (including failed ones)
   */
  getConnectionStatus(): Array<{
    name: string;
    connected: boolean;
    type: string;
    error?: string;
    lastAttempt?: Date;
  }> {
    return Array.from(this.connectionStatuses.values()).map(status => ({
      name: status.name,
      connected: status.connected,
      type: status.type,
      error: status.error,
      lastAttempt: status.lastAttempt
    }));
  }

  /**
   * Get detailed connection status including configuration
   */
  getDetailedConnectionStatus(): Array<{
    name: string;
    connected: boolean;
    type: string;
    error?: string;
    lastAttempt?: Date;
    config: DatabaseConfig;
  }> {
    return Array.from(this.connectionStatuses.values());
  }

  /**
   * Check if a connection exists (regardless of status)
   */
  hasConnection(name: string): boolean {
    return this.connectionStatuses.has(name);
  }

  /**
   * Check if a connection is active/connected
   */
  isConnectionActive(name: string): boolean {
    const status = this.connectionStatuses.get(name);
    return status?.connected || false;
  }

  /**
   * Get connection error if any
   */
  getConnectionError(name: string): string | undefined {
    const status = this.connectionStatuses.get(name);
    return status?.error;
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
    this.connectionStatuses.clear();
    
    logger.info('All database connections disconnected');
  }

  /**
   * Initialize connections from configuration with improved error handling
   */
  async initializeConnections(configs: Record<string, DatabaseConfig>): Promise<void> {
    logger.info('Initializing database connections', {
      totalConfigurations: Object.keys(configs).length,
      configurations: Object.keys(configs)
    });

    const connectionResults = await Promise.allSettled(
      Object.entries(configs).map(async ([key, config]) => {
        try {
          await this.addConnection(config);
          return { key, name: config.name, success: true };
        } catch (error) {
          logger.error('Failed to initialize connection', error as Error, {
            key,
            name: config.name,
            type: config.type,
          });
          return { key, name: config.name, success: false, error: (error as Error).message };
        }
      })
    );

    // Log summary of connection results
    const successful = connectionResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = connectionResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    logger.info('Database connections initialization completed', {
      totalConfigurations: Object.keys(configs).length,
      successfulConnections: successful,
      failedConnections: failed,
      activeConnections: this.connections.size,
    });

    // Log details of failed connections
    if (failed > 0) {
      const failedDetails = connectionResults
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
        .map(r => {
          if (r.status === 'rejected') {
            return { error: r.reason?.message || 'Unknown error' };
          }
          return r.value;
        });
      
      logger.warn('Some database connections failed to initialize', {
        failedConnections: failedDetails
      });
    }
  }

  /**
   * Retry failed connections
   */
  async retryFailedConnections(): Promise<void> {
    const failedConnections = Array.from(this.connectionStatuses.entries())
      .filter(([_, status]) => !status.connected);

    if (failedConnections.length === 0) {
      logger.info('No failed connections to retry');
      return;
    }

    logger.info('Retrying failed connections', {
      failedCount: failedConnections.length,
      failedNames: failedConnections.map(([name, _]) => name)
    });

    for (const [name, status] of failedConnections) {
      try {
        await this.addConnection(status.config);
        logger.info('Successfully retried connection', { name });
      } catch (error) {
        logger.error('Failed to retry connection', error as Error, { name });
      }
    }
  }
} 