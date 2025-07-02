/**
 * MCP tool definitions and schemas
 */

/**
 * Execute query tool input schema
 */
export interface ExecuteQueryInput {
  database_name: string;
  query: string;
  parameters?: unknown[];
}

/**
 * List databases tool output
 */
export interface ListDatabasesOutput {
  databases: DatabaseInfo[];
}

/**
 * Database info for listing
 */
export interface DatabaseInfo {
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
  tableCount?: number;
}

/**
 * Describe table tool input
 */
export interface DescribeTableInput {
  database_name: string;
  table_name: string;
}

/**
 * List tables tool input
 */
export interface ListTablesInput {
  database_name: string;
}

/**
 * MCP tool response wrapper
 */
export interface MCPToolResponse<T = unknown> {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * MCP error response
 */
export interface MCPError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
} 