/**
 * Custom exception classes for MCP Database Server
 */

/**
 * Base MCP Database error class
 */
export class MCPDatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MCPDatabaseError';
  }
}

/**
 * Database connection related errors
 */
export class DatabaseConnectionError extends MCPDatabaseError {
  constructor(message: string) {
    super(message, 'DB_CONNECTION_ERROR');
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Query execution related errors
 */
export class QueryExecutionError extends MCPDatabaseError {
  constructor(message: string) {
    super(message, 'QUERY_EXECUTION_ERROR');
    this.name = 'QueryExecutionError';
  }
}

/**
 * Data validation related errors
 */
export class ValidationError extends MCPDatabaseError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Security related errors
 */
export class SecurityError extends MCPDatabaseError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}

/**
 * Configuration related errors
 */
export class ConfigurationError extends MCPDatabaseError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * MCP protocol related errors
 */
export class MCPProtocolError extends MCPDatabaseError {
  constructor(message: string) {
    super(message, 'MCP_PROTOCOL_ERROR');
    this.name = 'MCPProtocolError';
  }
} 