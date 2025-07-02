/**
 * Test suite for JSON Database Connections functionality
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

describe('JSON Database Connections', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should parse valid JSON database connections', async () => {
    // Set up environment
    process.env.SECRET_KEY = 'test-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption';
    process.env.DATABASE_CONNECTIONS = JSON.stringify([
      {
        name: 'test_postgres',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        database: 'testdb'
      },
      {
        name: 'test_mysql', 
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'testdb'
      }
    ]);

    // Import and test
    const { configManager } = await import('../../../src/config/settings.js');
    const settings = await configManager.loadConfig();

    // Verify results
    expect(Object.keys(settings.databases)).toHaveLength(2);
    expect(settings.databases.test_postgres).toBeDefined();
    expect(settings.databases.test_postgres.type).toBe('postgresql');
    expect(settings.databases.test_postgres.host).toBe('localhost');
    expect(settings.databases.test_postgres.port).toBe(5432);
    
    expect(settings.databases.test_mysql).toBeDefined();
    expect(settings.databases.test_mysql.type).toBe('mysql');
    expect(settings.databases.test_mysql.host).toBe('localhost');
    expect(settings.databases.test_mysql.port).toBe(3306);
  });

  it('should handle empty JSON array', async () => {
    process.env.SECRET_KEY = 'test-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption';
    process.env.DATABASE_CONNECTIONS = '[]';

    const { configManager } = await import('../../../src/config/settings.js');
    const settings = await configManager.loadConfig();
    
    expect(Object.keys(settings.databases)).toHaveLength(0);
  });

  it('should handle invalid JSON gracefully', async () => {
    process.env.SECRET_KEY = 'test-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption';
    process.env.DATABASE_CONNECTIONS = '{ invalid json syntax';

    const { configManager } = await import('../../../src/config/settings.js');
    
    await expect(configManager.loadConfig()).rejects.toThrow();
  });

  it('should merge JSON and individual environment variables', async () => {
    process.env.SECRET_KEY = 'test-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption';
    
    // JSON connection
    process.env.DATABASE_CONNECTIONS = JSON.stringify([
      {
        name: 'json_db',
        type: 'postgresql',
        host: 'json.host.com',
        port: 5432,
        username: 'json_user',
        password: 'json_pass',
        database: 'json_db'
      }
    ]);

    // Individual env var (creates 'postgres' connection)
    process.env.POSTGRES_HOST = 'env.host.com';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_DATABASE = 'env_db';
    process.env.POSTGRES_USERNAME = 'env_user';
    process.env.POSTGRES_PASSWORD = 'env_pass';

    const { configManager } = await import('../../../src/config/settings.js');
    const settings = await configManager.loadConfig();

    // Should have both connections
    expect(Object.keys(settings.databases)).toHaveLength(2);
    expect(settings.databases.json_db.host).toBe('json.host.com');
    expect(settings.databases.postgres.host).toBe('env.host.com');
  });

  it('should use custom connection settings from JSON', async () => {
    process.env.SECRET_KEY = 'test-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption';
    process.env.DATABASE_CONNECTIONS = JSON.stringify([
      {
        name: 'custom_db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'pass',
        database: 'db',
        maxConnections: 25,
        timeout: 45000
      }
    ]);

    const { configManager } = await import('../../../src/config/settings.js');
    const settings = await configManager.loadConfig();

    expect(settings.databases.custom_db.maxConnections).toBe(25);
    expect(settings.databases.custom_db.timeout).toBe(45000);
  });
}); 