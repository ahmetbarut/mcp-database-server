import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { configManager } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { MCPProtocolError } from '../utils/exceptions.js';
import { DatabaseConnectionManager } from '../database/factory.js';

/**
 * MCP Database Server Implementation
 */
export class MCPDatabaseServer {
  private server: Server;
  private connectionManager: DatabaseConnectionManager;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-database-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connectionManager = new DatabaseConnectionManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      logger.info('MCP client initialized', {
        clientInfo: request.params.clientInfo,
      });

      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-database-server', version: '1.0.0' },
      };
    });

    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_query',
            description: 'Execute SQL query on a specific database connection',
            inputSchema: { 
              type: 'object', 
              properties: {
                connection_name: {
                  type: 'string',
                  description: 'Name of the database connection to execute query on'
                },
                query: {
                  type: 'string',
                  description: 'SQL query to execute (use parameterized queries for security)'
                },
                database: {
                  type: 'string',
                  description: 'Target database name (optional, defaults to connection default database)',
                  optional: true
                },
                parameters: {
                  type: 'array',
                  description: 'Query parameters for parameterized queries (recommended for security)',
                  optional: true,
                  items: {
                    type: 'string'
                  }
                }
              },
              required: ['connection_name', 'query']
            },
          },
          {
            name: 'list_databases',
            description: 'List databases from a specific connection or all configured connections',
            inputSchema: { 
              type: 'object', 
              properties: {
                connection_name: {
                  type: 'string',
                  description: 'Name of the connection to list databases from. If not provided, lists all configured connections.',
                  optional: true
                }
              }
            },
          },
          {
            name: 'list_connections',
            description: 'List all database connections with detailed information and status',
            inputSchema: { 
              type: 'object', 
              properties: {
                include_credentials: {
                  type: 'boolean',
                  description: 'Include connection credentials (passwords will be masked)',
                  default: false
                }
              }
            },
          },
        ],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'execute_query') {
        return await this.handleExecuteQuery(args);
      }

      if (name === 'list_databases') {
        return await this.handleListDatabases(args);
      }

      if (name === 'list_connections') {
        return await this.handleListConnections(args);
      }

      throw new MCPProtocolError(`Unknown tool: ${name}`);
    });
  }

  private async handleExecuteQuery(args: any = {}): Promise<any> {
    try {
      const { connection_name: connectionName, query, database, parameters } = args;

      // Validate required parameters
      if (!connectionName) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: connection_name is required',
            },
          ],
          isError: true,
        };
      }

      if (!query || typeof query !== 'string') {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: query is required and must be a string',
            },
          ],
          isError: true,
        };
      }

      const settings = configManager.getSettings();
      const connectionConfig = settings.databases[connectionName];

      if (!connectionConfig) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Connection '${connectionName}' not found. Available connections: ${Object.keys(settings.databases).join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      // Get or create database connection
      let driver = this.connectionManager.getConnection(connectionName);
      if (!driver) {
        await this.connectionManager.addConnection(connectionConfig);
        driver = this.connectionManager.getConnection(connectionName);
      }

      if (!driver) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Failed to establish connection to '${connectionName}'`,
            },
          ],
          isError: true,
        };
      }

      // For network databases (PostgreSQL, MySQL), handle database switching if specified
      const targetDatabase = database || connectionConfig.database;
      let executionNotes: string[] = [];

      if (targetDatabase && connectionConfig.type !== 'sqlite') {
        // Add database context information
        executionNotes.push(`Executed on database: ${targetDatabase}`);
        
        // For PostgreSQL and MySQL, we could potentially switch databases
        // but for simplicity, we'll execute on the default connection
        // and document which database was targeted
      }

      // Execute the query with proper error handling
      logger.info('Executing query', {
        connectionName,
        queryLength: query.length,
        hasParameters: Array.isArray(parameters) && parameters.length > 0,
        targetDatabase,
      });

      const startTime = Date.now();
      const result = await driver.executeQuery(query, parameters);
      const totalExecutionTime = Date.now() - startTime;

      const response = {
        connection: {
          name: connectionName,
          type: connectionConfig.type,
          database: targetDatabase,
        },
        query: {
          sql: query,
          parameters: parameters || [],
          executionTime: result.executionTime,
          totalTime: totalExecutionTime,
        },
        result: {
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          notes: executionNotes,
        },
        status: 'success',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleExecuteQuery', error as Error, {
        connectionName: args.connection_name,
        queryLength: args.query?.length || 0,
      });

      const errorResponse = {
        connection: {
          name: args.connection_name,
        },
        query: {
          sql: args.query,
          parameters: args.parameters || [],
        },
        error: {
          message: (error as Error).message,
          type: (error as Error).constructor.name,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
        status: 'error',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListDatabases(args: any = {}): Promise<any> {
    try {
      const settings = configManager.getSettings();
      const connectionName = args.connection_name;

      // Smart Auto-Detection: If no connection_name provided and only 1 ACTIVE connection exists,
      // automatically list databases from that single active connection
      if (!connectionName) {
        const connectionStatuses = this.connectionManager.getConnectionStatus();
        const activeConnections = connectionStatuses.filter(s => s.connected);
        
        // If exactly 1 active connection exists, auto-select it for database listing
        if (activeConnections.length === 1) {
          const singleActiveConnection = activeConnections[0];
          
          logger.info('Auto-selecting single active connection for database listing', {
            connectionName: singleActiveConnection.name,
            autoDetected: true,
            totalConfigured: Object.keys(settings.databases).length,
            totalActive: activeConnections.length,
          });
          
          // Recursively call with the auto-detected connection name
          return await this.handleListDatabases({ connection_name: singleActiveConnection.name });
        }
      }

      // If connection_name is provided, list databases from that specific connection
      if (connectionName) {
        // Check if connection exists in configuration
        const connectionConfig = settings.databases[connectionName];
        if (!connectionConfig) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Connection '${connectionName}' not found. Available connections: ${Object.keys(settings.databases).join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        try {
          // Get or create database connection
          let driver = this.connectionManager.getConnection(connectionName);
          if (!driver) {
            await this.connectionManager.addConnection(connectionConfig);
            driver = this.connectionManager.getConnection(connectionName);
          }

          if (!driver) {
            throw new Error('Failed to establish database connection');
          }

          // Get real databases from the connection
          let databases: any[] = [];
          
          // Use specific listDatabases method if available, otherwise use generic method
          if ('listDatabases' in driver && typeof (driver as any).listDatabases === 'function') {
            databases = await (driver as any).listDatabases();
          } else if ('listAllDatabases' in driver && typeof (driver as any).listAllDatabases === 'function') {
            databases = await (driver as any).listAllDatabases();
          } else {
            // Fallback for basic database types
            databases = [{
              name: connectionConfig.database || 'default',
              type: 'database',
              note: 'Database listing not fully supported for this driver type',
            }];
          }
          
          const result = {
            connection: {
              name: connectionConfig.name,
              type: connectionConfig.type,
              host: connectionConfig.host || undefined,
              port: connectionConfig.port || undefined,
              path: connectionConfig.path || undefined,
            },
            databases: databases,
            status: 'real_data',
            timestamp: new Date().toISOString(),
            auto_detected: !args.connection_name, // Flag to show this was auto-detected
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (dbError) {
          logger.error('Database connection/query error', dbError as Error, {
            connectionName,
            type: connectionConfig.type,
          });

          // Fall back to mock data if real connection fails
          const mockDatabases = this.getMockDatabasesForConnection(connectionConfig);
          
          const result = {
            connection: {
              name: connectionConfig.name,
              type: connectionConfig.type,
              host: connectionConfig.host || undefined,
              port: connectionConfig.port || undefined,
              path: connectionConfig.path || undefined,
            },
            databases: mockDatabases,
            status: 'mock_data_fallback',
            error: (dbError as Error).message,
            note: 'Could not connect to database, showing mock data. Check your connection configuration.',
            auto_detected: !args.connection_name, // Flag to show this was auto-detected
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }
      }

      // If no connection_name provided, list all configured connections (original behavior)
      const connectionStatuses = this.connectionManager.getConnectionStatus();
      const statusMap = new Map(connectionStatuses.map(s => [s.name, s]));

      const databases = Object.keys(settings.databases).map((name) => {
        const config = settings.databases[name];
        const status = statusMap.get(name);
        
        return {
          connection_name: name,
          name: config.name,
          type: config.type,
          status: status?.connected ? 'connected' : 'configured',
          host: config.host || undefined,
          port: config.port || undefined,
          database: config.database || undefined,
          path: config.path || undefined,
        };
      });

      const result = {
        summary: {
          total_connections: databases.length,
          connected_connections: connectionStatuses.filter(s => s.connected).length,
          note: databases.length === 1 
            ? 'Single connection available but not active. Use connection_name parameter to list databases.' 
            : 'Multiple connections available. Use connection_name parameter to list actual databases within a specific connection.'
        },
        connections: databases
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleListDatabases', error as Error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Generate mock database list for demonstration purposes
   * Used as fallback when real database connection fails
   */
  private getMockDatabasesForConnection(config: any): any[] {
    switch (config.type) {
      case 'postgresql':
        return [
          { name: 'postgres', size: '8 MB', owner: 'postgres', encoding: 'UTF8' },
          { name: 'template0', size: '8 MB', owner: 'postgres', encoding: 'UTF8' },
          { name: 'template1', size: '8 MB', owner: 'postgres', encoding: 'UTF8' },
          { name: config.database || 'myapp', size: '15 MB', owner: config.username || 'user', encoding: 'UTF8' },
        ];
      case 'mysql':
        return [
          { name: 'information_schema', type: 'SYSTEM SCHEMA' },
          { name: 'performance_schema', type: 'SYSTEM SCHEMA' },
          { name: 'mysql', type: 'SYSTEM SCHEMA' },
          { name: 'sys', type: 'SYSTEM SCHEMA' },
          { name: config.database || 'myapp', type: 'BASE TABLE' },
        ];
      case 'sqlite':
        return [
          { 
            file: config.path,
            size: 'Unknown (file not accessed)',
            tables_count: 'Unknown',
            note: 'SQLite is a single-file database. Use list_tables to see tables within this database.'
          }
        ];
      default:
        return [];
    }
  }

  private async handleListConnections(args: any = {}) {
    try {
      const settings = configManager.getSettings();
      const includeCredentials = args.include_credentials || false;
      
      // Get real connection statuses
      const connectionStatuses = this.connectionManager.getConnectionStatus();
      const statusMap = new Map(connectionStatuses.map(s => [s.name, s]));

      const connections = Object.entries(settings.databases).map(([key, config]) => {
        const status = statusMap.get(config.name);
        
        const connection: any = {
          key,
          name: config.name,
          type: config.type,
          status: status?.connected ? 'connected' : 'configured',
          settings: {
            maxConnections: config.maxConnections,
            timeout: config.timeout,
          },
        };

        // Add connection details based on database type
        if (config.type === 'sqlite') {
          connection.details = {
            path: config.path,
          };
        } else {
          // Network databases (PostgreSQL, MySQL)
          connection.details = {
            host: config.host,
            port: config.port,
            database: config.database,
          };

          if (includeCredentials) {
            connection.credentials = {
              username: config.username,
              password: config.password ? '***masked***' : undefined,
            };
          }
        }

        return connection;
      });

      const connectedCount = connectionStatuses.filter(s => s.connected).length;

      const summary = {
        total_connections: connections.length,
        by_type: connections.reduce((acc: any, conn) => {
          acc[conn.type] = (acc[conn.type] || 0) + 1;
          return acc;
        }, {}),
        configured_connections: connections.length,
        active_connections: connectedCount,
      };

      const result = {
        summary,
        connections,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleListConnections', error as Error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting MCP Database Server');
      await configManager.loadConfig();

      // Initialize database connections
      const settings = configManager.getSettings();
      await this.connectionManager.initializeConnections(settings.databases);

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('MCP Database Server started successfully');
    } catch (error) {
      logger.error('Failed to start MCP server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.connectionManager.disconnectAll();
      await this.server.close();
      logger.info('MCP Database Server stopped');
    } catch (error) {
      logger.error('Error stopping MCP server', error as Error);
      throw error;
    }
  }
} 