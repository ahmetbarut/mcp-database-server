import { DatabaseDriver, QueryResult, TableSchema } from '../types/database.js';
import { DatabaseConfig, QueryContext } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { DatabaseConnectionError, QueryExecutionError } from '../utils/exceptions.js';

/**
 * Abstract base class for database drivers
 * Provides common functionality and interface for all database types
 */
export abstract class BaseDatabaseDriver implements DatabaseDriver {
  protected config: DatabaseConfig;
  protected connected: boolean = false;
  protected connectionTime?: Date;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Abstract methods that must be implemented by concrete drivers
   */
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeQuery(query: string, parameters?: unknown[]): Promise<QueryResult>;
  abstract listTables(): Promise<string[]>;
  abstract describeTable(tableName: string): Promise<TableSchema>;
  abstract beginTransaction(): Promise<void>;
  abstract commitTransaction(): Promise<void>;
  abstract rollbackTransaction(): Promise<void>;

  /**
   * Check if driver is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get database configuration
   */
  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  /**
   * Get connection time
   */
  getConnectionTime(): Date | undefined {
    return this.connectionTime;
  }

  /**
   * Execute query with logging and error handling
   */
  protected async executeWithLogging(
    query: string, 
    parameters?: unknown[],
    userId?: string
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const context: QueryContext = {
      databaseName: this.config.name,
      query,
      parameters,
      userId,
      timestamp: new Date()
    };

    try {
      logger.debug('Executing query', {
        database: this.config.name,
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        parameterCount: parameters?.length || 0
      });

      const result = await this.executeQuery(query, parameters);
      const executionTime = Date.now() - startTime;

      // Log for audit trail
      logger.auditLog(context, { 
        rowCount: result.rowCount, 
        executionTime 
      });

      logger.debug('Query executed successfully', {
        database: this.config.name,
        rowCount: result.rowCount,
        executionTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Query execution failed', error as Error, {
        database: this.config.name,
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        executionTime
      });

      throw new QueryExecutionError(
        `Query execution failed on database '${this.config.name}': ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate connection before operations
   */
  protected validateConnection(): void {
    if (!this.connected) {
      throw new DatabaseConnectionError(
        `Database '${this.config.name}' is not connected. Call connect() first.`
      );
    }
  }

  /**
   * Set connected state and log connection
   */
  protected setConnected(connected: boolean): void {
    this.connected = connected;
    
    if (connected) {
      this.connectionTime = new Date();
      logger.info('Database connected', {
        database: this.config.name,
        type: this.config.type,
        connectionTime: this.connectionTime
      });
    } else {
      logger.info('Database disconnected', {
        database: this.config.name,
        type: this.config.type
      });
    }
  }

  /**
   * Handle connection errors with proper logging
   */
  protected handleConnectionError(error: Error): never {
    logger.error('Database connection failed', error, {
      database: this.config.name,
      type: this.config.type,
      host: this.config.host,
      port: this.config.port
    });

    throw new DatabaseConnectionError(
      `Failed to connect to database '${this.config.name}': ${error.message}`
    );
  }
} 