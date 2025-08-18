import winston from 'winston';
import { QueryContext } from '../types/config.js';

/**
 * Structured logger configuration for MCP Database Server
 */
class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        // Always emit structured JSON for machine parsing
        winston.format.json()
      ),
      defaultMeta: { service: 'mcp-database-server' },
      transports: [
        // Console transport
        // IMPORTANT: Route all logs to stderr so stdout remains reserved for MCP JSON-RPC
        new winston.transports.Console({
          stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
        })
      ]
    });
  }

  /**
   * Log informational messages
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning messages
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error messages
   */
  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.logger.error(message, { 
      error: error?.message,
      stack: error?.stack,
      ...meta 
    });
  }

  /**
   * Log debug messages
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log database operations for audit trail
   */
  auditLog(context: QueryContext, result?: { rowCount: number; executionTime: number }): void {
    this.logger.info('Database operation', {
      audit: true,
      database: context.databaseName,
      query: context.query.substring(0, 100) + (context.query.length > 100 ? '...' : ''),
      parameters: context.parameters,
      userId: context.userId,
      timestamp: context.timestamp,
      rowCount: result?.rowCount,
      executionTime: result?.executionTime
    });
  }

  /**
   * Log security events
   */
  securityLog(event: string, details: Record<string, unknown>): void {
    this.logger.warn('Security event', {
      security: true,
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const logger = new Logger(); 