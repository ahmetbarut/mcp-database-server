/**
 * Test suite for JSON Database Connections functionality
 */

import { jest } from '@jest/globals';

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

// Mock fs module for file-based tests
const mockFsAccess = jest.fn() as jest.MockedFunction<typeof import('fs').promises.access>;
const mockFsReadFile = jest.fn() as jest.MockedFunction<typeof import('fs').promises.readFile>;

jest.mock('fs', () => ({
  promises: {
    access: mockFsAccess,
    readFile: mockFsReadFile
  }
}));

describe('JSON Database Connections', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    
    // Reset fs mocks
    mockFsAccess.mockClear();
    mockFsReadFile.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Legacy DATABASE_CONNECTIONS environment variable', () => {
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

  describe('File-based DATABASE_CONNECTIONS_FILE configuration', () => {
    it('should load valid JSON database connections from file', async () => {
      const testConfigPath = './test-databases.json';
      const configData = [
        {
          name: 'file_postgres',
          type: 'postgresql',
          host: 'file.host.com',
          port: 5432,
          username: 'file_user',
          password: 'file_pass',
          database: 'file_db'
        },
        {
          name: 'file_sqlite',
          type: 'sqlite',
          path: './file-test.db'
        }
      ];

      // Mock file system - return Promise.resolve()
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue(JSON.stringify(configData));

      // Set up environment
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;

      // Import and test
      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      // Verify file operations
      expect(mockFsAccess).toHaveBeenCalled();
      expect(mockFsReadFile).toHaveBeenCalled();

      // Verify results
      expect(Object.keys(settings.databases)).toHaveLength(2);
      expect(settings.databases.file_postgres).toBeDefined();
      expect(settings.databases.file_postgres.type).toBe('postgresql');
      expect(settings.databases.file_postgres.host).toBe('file.host.com');
      
      expect(settings.databases.file_sqlite).toBeDefined();
      expect(settings.databases.file_sqlite.type).toBe('sqlite');
      expect(settings.databases.file_sqlite.path).toBe('./file-test.db');
    });

    it('should handle file not found error', async () => {
      const testConfigPath = './non-existent.json';

      // Mock file not found
      mockFsAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      // Set up environment
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;

      const { configManager } = await import('../../../src/config/settings.js');
      
      await expect(configManager.loadConfig()).rejects.toThrow('Database connections file not found');
    });

    it('should handle invalid JSON in file', async () => {
      const testConfigPath = './invalid.json';

      // Mock file access and invalid JSON content
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue('{ invalid json content');

      // Set up environment
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;

      const { configManager } = await import('../../../src/config/settings.js');
      
      await expect(configManager.loadConfig()).rejects.toThrow('Invalid JSON in database connections file');
    });

    it('should handle file read permission error', async () => {
      const testConfigPath = './permission-denied.json';

      // Mock file access success but read failure
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

      // Set up environment
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;

      const { configManager } = await import('../../../src/config/settings.js');
      
      await expect(configManager.loadConfig()).rejects.toThrow('Failed to load DATABASE_CONNECTIONS_FILE');
    });

    it('should prioritize file-based over legacy DATABASE_CONNECTIONS', async () => {
      const testConfigPath = './priority-test.json';
      const fileConfigData = [
        {
          name: 'priority_db',
          type: 'sqlite',
          path: './file-priority.db'
        }
      ];

      // Mock file system
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue(JSON.stringify(fileConfigData));

      // Set up environment with both methods
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;
      process.env.DATABASE_CONNECTIONS = JSON.stringify([
        {
          name: 'legacy_db',
          type: 'postgresql',
          host: 'legacy.host.com',
          port: 5432,
          username: 'legacy',
          password: 'legacy',
          database: 'legacy'
        }
      ]);

      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      // Should only have file-based config, not legacy
      expect(Object.keys(settings.databases)).toHaveLength(1);
      expect(settings.databases.priority_db).toBeDefined();
      expect(settings.databases.legacy_db).toBeUndefined();
    });

    it('should merge file-based config with individual environment variables', async () => {
      const testConfigPath = './merge-test.json';
      const fileConfigData = [
        {
          name: 'file_db',
          type: 'postgresql',
          host: 'file.host.com',
          port: 5432,
          username: 'file_user',
          password: 'file_pass',
          database: 'file_db'
        }
      ];

      // Mock file system
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue(JSON.stringify(fileConfigData));

      // Set up environment
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;
      
      // Individual env var (creates 'sqlite' connection)
      process.env.SQLITE_DB_PATH = './individual.db';

      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      // Should have both file-based and individual configs
      expect(Object.keys(settings.databases)).toHaveLength(2);
      expect(settings.databases.file_db).toBeDefined();
      expect(settings.databases.file_db.host).toBe('file.host.com');
      expect(settings.databases.sqlite).toBeDefined();
      expect(settings.databases.sqlite.path).toBe('./individual.db');
    });

    it('should resolve relative file paths correctly', async () => {
      const testConfigPath = './config/databases.json';
      const configData = [
        {
          name: 'relative_db',
          type: 'sqlite',
          path: './relative.db'
        }
      ];

      // Mock file system
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue(JSON.stringify(configData));

      // Set up environment
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS_FILE = testConfigPath;

      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      // Verify path resolution worked
      expect(mockFsAccess).toHaveBeenCalled();
      expect(mockFsReadFile).toHaveBeenCalled();

      expect(settings.databases.relative_db).toBeDefined();
    });

    it('should show deprecation warning when using legacy DATABASE_CONNECTIONS', async () => {
      // Set up environment with legacy method
      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';
      process.env.DATABASE_CONNECTIONS = JSON.stringify([
        {
          name: 'legacy_db',
          type: 'sqlite',
          path: './legacy.db'
        }
      ]);

      const { configManager } = await import('../../../src/config/settings.js');
      await configManager.loadConfig();

      // Should show deprecation warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Using DATABASE_CONNECTIONS environment variable is deprecated. Consider using DATABASE_CONNECTIONS_FILE instead.'
      );
    });
  });
}); 