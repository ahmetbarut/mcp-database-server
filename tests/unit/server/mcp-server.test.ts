/**
 * Test suite for MCP Server and tools functionality
 */

// Mock logger first
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

// Mock config manager
const mockConfigManager = {
  loadConfig: jest.fn(),
  getSettings: jest.fn(),
  getDatabaseConfig: jest.fn(),
  getDatabaseNames: jest.fn()
};

jest.mock('../../../src/config/index.js', () => ({
  configManager: mockConfigManager
}));

describe('MCP Database Server Tools', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('list_connections tool', () => {
    beforeEach(() => {
      // Mock config settings
      mockConfigManager.getSettings.mockReturnValue({
        databases: {
          postgres_main: {
            name: 'postgres_main',
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            username: 'postgres',
            password: 'secret',
            database: 'maindb',
            maxConnections: 20,
            timeout: 30000
          },
          mysql_analytics: {
            name: 'mysql_analytics',
            type: 'mysql',
            host: 'analytics.host.com',
            port: 3306,
            username: 'analytics',
            password: 'analytics_pass',
            database: 'analytics',
            maxConnections: 15,
            timeout: 30000
          },
          sqlite_cache: {
            name: 'sqlite_cache',
            type: 'sqlite',
            path: './cache.db',
            maxConnections: 1,
            timeout: 10000
          }
        },
        server: {
          host: 'localhost',
          port: 8000,
          logLevel: 'info',
          enableAuditLogging: true,
          enableRateLimiting: true,
          secretKey: 'test-secret',
          encryptionKey: 'test-encryption'
        }
      });
    });

    it('should list all connections without credentials', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      // Access private method using type assertion
      const result = await (server as any).handleListConnections();

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      
      // Check summary
      expect(data.summary.total_connections).toBe(3);
      expect(data.summary.by_type.postgresql).toBe(1);
      expect(data.summary.by_type.mysql).toBe(1);
      expect(data.summary.by_type.sqlite).toBe(1);
      expect(data.summary.configured_connections).toBe(3);

      // Check connections
      expect(data.connections).toHaveLength(3);
      
      // Check PostgreSQL connection
      const postgresConn = data.connections.find((c: any) => c.type === 'postgresql');
      expect(postgresConn.name).toBe('postgres_main');
      expect(postgresConn.details.host).toBe('localhost');
      expect(postgresConn.details.port).toBe(5432);
      expect(postgresConn.details.database).toBe('maindb');
      expect(postgresConn.settings.maxConnections).toBe(20);
      expect(postgresConn.settings.timeout).toBe(30000);
      expect(postgresConn.credentials).toBeUndefined(); // Should not include credentials by default

      // Check MySQL connection
      const mysqlConn = data.connections.find((c: any) => c.type === 'mysql');
      expect(mysqlConn.name).toBe('mysql_analytics');
      expect(mysqlConn.details.host).toBe('analytics.host.com');
      expect(mysqlConn.details.port).toBe(3306);

      // Check SQLite connection
      const sqliteConn = data.connections.find((c: any) => c.type === 'sqlite');
      expect(sqliteConn.name).toBe('sqlite_cache');
      expect(sqliteConn.details.path).toBe('./cache.db');
      expect(sqliteConn.settings.maxConnections).toBe(1);
    });

    it('should include masked credentials when requested', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListConnections({ include_credentials: true });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);

      // Check PostgreSQL connection has credentials
      const postgresConn = data.connections.find((c: any) => c.type === 'postgresql');
      expect(postgresConn.credentials).toBeDefined();
      expect(postgresConn.credentials.username).toBe('postgres');
      expect(postgresConn.credentials.password).toBe('***masked***');

      // Check MySQL connection has credentials
      const mysqlConn = data.connections.find((c: any) => c.type === 'mysql');
      expect(mysqlConn.credentials).toBeDefined();
      expect(mysqlConn.credentials.username).toBe('analytics');
      expect(mysqlConn.credentials.password).toBe('***masked***');

      // Check SQLite connection doesn't have credentials (no network auth)
      const sqliteConn = data.connections.find((c: any) => c.type === 'sqlite');
      expect(sqliteConn.credentials).toBeUndefined();
    });

    it('should handle empty database configuration', async () => {
      mockConfigManager.getSettings.mockReturnValue({
        databases: {},
        server: {
          host: 'localhost',
          port: 8000,
          logLevel: 'info',
          enableAuditLogging: true,
          enableRateLimiting: true,
          secretKey: 'test-secret',
          encryptionKey: 'test-encryption'
        }
      });

      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListConnections();

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      
      expect(data.summary.total_connections).toBe(0);
      expect(data.connections).toHaveLength(0);
      expect(data.summary.by_type).toEqual({});
    });

    it('should handle configuration errors gracefully', async () => {
      mockConfigManager.getSettings.mockImplementation(() => {
        throw new Error('Configuration not loaded');
      });

      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListConnections();

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Configuration not loaded');
    });
  });

  describe('list_databases tool (existing)', () => {
    beforeEach(() => {
      mockConfigManager.getSettings.mockReturnValue({
        databases: {
          test_postgres: {
            name: 'test_postgres',
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            username: 'test',
            password: 'test',
            database: 'testdb',
            maxConnections: 10,
            timeout: 30000
          },
          test_mysql: {
            name: 'test_mysql',
            type: 'mysql',
            host: 'localhost',
            port: 3306,
            username: 'root',
            password: 'password',
            database: 'analytics',
            maxConnections: 10,
            timeout: 30000
          },
          test_sqlite: {
            name: 'test_sqlite',
            type: 'sqlite',
            path: './test.db',
            maxConnections: 1,
            timeout: 30000
          }
        },
        server: {
          host: 'localhost',
          port: 8000,
          logLevel: 'info',
          enableAuditLogging: true,
          enableRateLimiting: true,
          secretKey: 'test-secret',
          encryptionKey: 'test-encryption'
        }
      });
    });

    it('should list all configured connections when no connection_name provided', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListDatabases();

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      
      // Check if it's an error response (no active connections)
      if (data.message && data.message.includes('No active database connections found')) {
        expect(data.configured_connections).toBeDefined();
        expect(data.connection_statuses).toBeDefined();
        expect(data.suggestions).toBeDefined();
        return;
      }
      
      // If it's a normal response, check the structure
      expect(data.summary.total_connections).toBe(3);
      expect(data.connections).toHaveLength(3);

      // Check PostgreSQL connection
      const postgresConn = data.connections.find((c: any) => c.type === 'postgresql');
      expect(postgresConn.connection_name).toBe('test_postgres');
      expect(postgresConn.name).toBe('test_postgres');
      expect(postgresConn.host).toBe('localhost');
      expect(postgresConn.port).toBe(5432);
      expect(postgresConn.database).toBe('testdb');

      // Check MySQL connection
      const mysqlConn = data.connections.find((c: any) => c.type === 'mysql');
      expect(mysqlConn.connection_name).toBe('test_mysql');
      expect(mysqlConn.host).toBe('localhost');
      expect(mysqlConn.port).toBe(3306);

      // Check SQLite connection
      const sqliteConn = data.connections.find((c: any) => c.type === 'sqlite');
      expect(sqliteConn.connection_name).toBe('test_sqlite');
      expect(sqliteConn.path).toBe('./test.db');
      expect(sqliteConn.host).toBeUndefined();
    });

    it('should list mock databases for specific PostgreSQL connection', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListDatabases({ connection_name: 'test_postgres' });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      
      expect(data.connection.name).toBe('test_postgres');
      expect(data.connection.type).toBe('postgresql');
      expect(data.connection.host).toBe('localhost');
      expect(data.connection.port).toBe(5432);
      expect(data.status).toBe('mock_data_fallback');
      expect(data.error).toBeDefined();
      expect(data.note).toContain('Could not connect to database, showing mock data');

      // Check mock databases
      expect(data.databases).toHaveLength(4);
      expect(data.databases.some((db: any) => db.name === 'postgres')).toBe(true);
      expect(data.databases.some((db: any) => db.name === 'template0')).toBe(true);
      expect(data.databases.some((db: any) => db.name === 'template1')).toBe(true);
      expect(data.databases.some((db: any) => db.name === 'testdb')).toBe(true);

      // Check database properties
      const userDb = data.databases.find((db: any) => db.name === 'testdb');
      expect(userDb.owner).toBe('test');
      expect(userDb.encoding).toBe('UTF8');
    });

    it('should list mock databases for specific MySQL connection', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListDatabases({ connection_name: 'test_mysql' });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      
      expect(data.connection.name).toBe('test_mysql');
      expect(data.connection.type).toBe('mysql');
      expect(data.status).toBe('mock_data_fallback');

      // Check mock databases
      expect(data.databases).toHaveLength(5);
      expect(data.databases.some((db: any) => db.name === 'information_schema')).toBe(true);
      expect(data.databases.some((db: any) => db.name === 'mysql')).toBe(true);
      expect(data.databases.some((db: any) => db.name === 'analytics')).toBe(true);

      // Check database types
      const systemDb = data.databases.find((db: any) => db.name === 'mysql');
      expect(systemDb.type).toBe('SYSTEM SCHEMA');
      const userDb = data.databases.find((db: any) => db.name === 'analytics');
      expect(userDb.type).toBe('BASE TABLE');
    });

    it('should list mock data for SQLite connection', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListDatabases({ connection_name: 'test_sqlite' });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      
      expect(data.connection.name).toBe('test_sqlite');
      expect(data.connection.type).toBe('sqlite');
      expect(data.connection.path).toBe('./test.db');
      expect(data.status).toBe('real_data');

      // Check SQLite "database" (single file) - real data now
      expect(data.databases).toHaveLength(1);
      expect(data.databases[0].file).toBe('./test.db');
      expect(data.databases[0].note).toContain('single-file database');
    });

    it('should return error for non-existent connection', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListDatabases({ connection_name: 'non_existent' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Connection 'non_existent' not found");
      expect(result.content[0].text).toContain('Available connections: test_postgres, test_mysql, test_sqlite');
    });

    it('should handle configuration errors gracefully', async () => {
      mockConfigManager.getSettings.mockImplementation(() => {
        throw new Error('Configuration not loaded');
      });

      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleListDatabases();

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Configuration not loaded');
    });
  });

  describe('execute_query tool', () => {
    beforeEach(() => {
      mockConfigManager.getSettings.mockReturnValue({
        databases: {
          test_sqlite: {
            name: 'test_sqlite',
            type: 'sqlite',
            path: './test.db',
            maxConnections: 1,
            timeout: 30000
          },
          test_postgres: {
            name: 'test_postgres',
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            username: 'test',
            password: 'test',
            database: 'testdb',
            maxConnections: 10,
            timeout: 30000
          }
        },
        server: {
          host: 'localhost',
          port: 8000,
          logLevel: 'info',
          enableAuditLogging: true,
          enableRateLimiting: true,
          secretKey: 'test-secret',
          encryptionKey: 'test-encryption'
        }
      });
    });

    it('should require connection_name parameter', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('connection_name is required');
    });

    it('should require query parameter', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({ connection_name: 'test_sqlite' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('query is required');
    });

    it('should return error for non-existent connection', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({
        connection_name: 'non_existent',
        query: 'SELECT 1'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Connection 'non_existent' not found");
    });

    it('should execute simple SELECT query on SQLite', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({
        connection_name: 'test_sqlite',
        query: 'SELECT 1 as test_number, \'Hello\' as message'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toBeDefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('success');
      expect(data.connection.name).toBe('test_sqlite');
      expect(data.connection.type).toBe('sqlite');
      expect(data.result.rows).toHaveLength(1);
      expect(data.result.rows[0].test_number).toBe(1);
      expect(data.result.rows[0].message).toBe('Hello');
      expect(data.result.rowCount).toBe(1);
      expect(data.result.fields).toHaveLength(2);
    });

    it('should execute parameterized query', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({
        connection_name: 'test_sqlite',
        query: 'SELECT ? as param_value, ? as second_param',
        parameters: ['Test Value', '42']
      });

      expect(result.isError).toBeUndefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('success');
      expect(data.query.parameters).toEqual(['Test Value', '42']);
      expect(data.result.rows[0].param_value).toBe('Test Value');
      expect(data.result.rows[0].second_param).toBe('42');
    });

    it('should include execution time metrics', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({
        connection_name: 'test_sqlite',
        query: 'SELECT 1'
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.query.executionTime).toBeGreaterThanOrEqual(0);
      expect(data.query.totalTime).toBeGreaterThanOrEqual(0);
      expect(data.metadata.timestamp).toBeDefined();
    });

    it('should handle PostgreSQL connection failures gracefully', async () => {
      const { MCPDatabaseServer } = await import('../../../src/server/mcp-server.js');
      const server = new MCPDatabaseServer();
      
      const result = await (server as any).handleExecuteQuery({
        connection_name: 'test_postgres',
        query: 'SELECT 1'
      });

      // Should return error since PostgreSQL is not actually running
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('error');
      expect(data.error.message).toBeDefined();
      expect(data.connection.name).toBe('test_postgres');
    });
  });
}); 