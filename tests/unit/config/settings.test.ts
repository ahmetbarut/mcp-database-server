/**
 * Test suite for ConfigManager - SQLite config store based configuration
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

// Mock ConnectionConfigStore
const mockGetAll = jest.fn();
const mockGetByName = jest.fn();
const mockCreate = jest.fn();
const mockClose = jest.fn();

jest.mock('../../../src/config/config-store.js', () => ({
  ConnectionConfigStore: jest.fn().mockImplementation(() => ({
    getAll: mockGetAll,
    getByName: mockGetByName,
    create: mockCreate,
    close: mockClose
  }))
}));

// Mock fs (no longer needed for config loading, but settings.ts may still import dotenv)
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn()
  },
  mkdirSync: jest.fn()
}));

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    mockGetAll.mockReturnValue([]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig with SQLite config store', () => {
    it('should load connections from config store', async () => {
      mockGetAll.mockReturnValue([
        {
          name: 'my-postgres',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'mydb',
          username: 'user',
          password: 'pass',
          maxConnections: 10,
          timeout: 30000,
          ssl: false
        },
        {
          name: 'my-sqlite',
          type: 'sqlite',
          path: '/tmp/test.db',
          maxConnections: 10,
          timeout: 30000,
          ssl: false
        }
      ]);

      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';

      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      expect(Object.keys(settings.databases)).toHaveLength(2);
      expect(settings.databases['my-postgres'].type).toBe('postgresql');
      expect(settings.databases['my-postgres'].host).toBe('localhost');
      expect(settings.databases['my-sqlite'].type).toBe('sqlite');
      expect(settings.databases['my-sqlite'].path).toBe('/tmp/test.db');
    });

    it('should handle empty config store', async () => {
      mockGetAll.mockReturnValue([]);

      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';

      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      expect(Object.keys(settings.databases)).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No database connections configured. Use the Web UI to add connections.'
      );
    });

    it('should load server config from env vars', async () => {
      process.env.SECRET_KEY = 'my-secret';
      process.env.ENCRYPTION_KEY = 'my-encryption';
      process.env.WEB_UI_PORT = '4000';
      process.env.LOG_LEVEL = 'debug';

      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      expect(settings.server.secretKey).toBe('my-secret');
      expect(settings.server.webUIPort).toBe(4000);
      expect(settings.server.logLevel).toBe('debug');
      expect(settings.server.webUIEnabled).toBe(true);
    });

    it('should use default server config values', async () => {
      const { configManager } = await import('../../../src/config/settings.js');
      const settings = await configManager.loadConfig();

      expect(settings.server.host).toBe('localhost');
      expect(settings.server.port).toBe(8000);
      expect(settings.server.webUIPort).toBe(3693);
      expect(settings.server.webUIEnabled).toBe(true);
    });

    it('should reload config from store', async () => {
      mockGetAll.mockReturnValue([]);

      process.env.SECRET_KEY = 'test-secret';
      process.env.ENCRYPTION_KEY = 'test-encryption';

      const { configManager } = await import('../../../src/config/settings.js');
      await configManager.loadConfig();

      // Add a connection and reload
      mockGetAll.mockReturnValue([
        {
          name: 'new-db',
          type: 'sqlite',
          path: '/tmp/new.db',
          maxConnections: 10,
          timeout: 30000,
          ssl: false
        }
      ]);

      const reloaded = await configManager.reloadConfig();
      expect(Object.keys(reloaded.databases)).toHaveLength(1);
      expect(reloaded.databases['new-db'].path).toBe('/tmp/new.db');
    });

    it('should throw if getSettings called before loadConfig', async () => {
      const { configManager } = await import('../../../src/config/settings.js');

      expect(() => configManager.getSettings()).toThrow('Configuration not loaded');
    });
  });
});
