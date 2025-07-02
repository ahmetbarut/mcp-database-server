#!/usr/bin/env node

/**
 * Example: JSON Database Connections Configuration
 * 
 * This example demonstrates how to configure multiple database connections
 * using the DATABASE_CONNECTIONS environment variable in JSON format.
 */

import { configManager } from '../../dist/config/settings.js';
import { logger } from '../../dist/utils/logger.js';

// Example 1: Multiple PostgreSQL instances
const multiplePostgreSQL = {
  DATABASE_CONNECTIONS: JSON.stringify([
    {
      name: 'postgres_main',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'maindb',
      maxConnections: 20,
      timeout: 30000
    },
    {
      name: 'postgres_dev',
      type: 'postgresql', 
      host: 'localhost',
      port: 5433,
      username: 'postgres',
      password: 'postgres',
      database: 'devdb',
      maxConnections: 10,
      timeout: 30000
    },
    {
      name: 'postgres_test',
      type: 'postgresql',
      host: '192.168.1.100', 
      port: 5432,
      username: 'testuser',
      password: 'testpass',
      database: 'testdb',
      maxConnections: 5,
      timeout: 15000
    }
  ])
};

// Example 2: Mixed database types
const mixedDatabases = {
  DATABASE_CONNECTIONS: JSON.stringify([
    {
      name: 'main_postgres',
      type: 'postgresql',
      host: 'db.production.com',
      port: 5432,
      username: 'app_user',
      password: 'secure_password',
      database: 'production',
      maxConnections: 25,
      timeout: 30000
    },
    {
      name: 'analytics_mysql',
      type: 'mysql',
      host: 'analytics.production.com',
      port: 3306,
      username: 'analytics',
      password: 'analytics_pass',
      database: 'analytics',
      maxConnections: 15,
      timeout: 60000
    },
    {
      name: 'cache_sqlite',
      type: 'sqlite',
      path: './data/cache.db',
      maxConnections: 1,
      timeout: 10000
    },
    {
      name: 'sessions_mysql',
      type: 'mysql',
      host: 'sessions.production.com',
      port: 3307,
      username: 'sessions',
      password: 'sessions_pass',
      database: 'user_sessions',
      maxConnections: 20,
      timeout: 30000
    }
  ])
};

// Example 3: Development environment
const developmentConfig = {
  DATABASE_CONNECTIONS: JSON.stringify([
    {
      name: 'dev_postgres',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      username: 'dev',
      password: 'dev',
      database: 'dev_db'
    },
    {
      name: 'test_mysql',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'test',
      password: 'test',
      database: 'test_db'
    },
    {
      name: 'local_sqlite',
      type: 'sqlite',
      path: './dev-data/app.db'
    }
  ])
};

async function demonstrateJsonConnections() {
  logger.info('=== JSON Database Connections Examples ===');

  // Example 1: Multiple PostgreSQL instances
  logger.info('\n1. Multiple PostgreSQL Instances:');
  logger.info('Set this in your environment:');
  logger.info(`DATABASE_CONNECTIONS='${multiplePostgreSQL.DATABASE_CONNECTIONS}'`);

  // Example 2: Mixed database types  
  logger.info('\n2. Mixed Database Types:');
  logger.info('Set this in your environment:');
  logger.info(`DATABASE_CONNECTIONS='${mixedDatabases.DATABASE_CONNECTIONS}'`);

  // Example 3: Development setup
  logger.info('\n3. Development Environment:');
  logger.info('Set this in your environment:');
  logger.info(`DATABASE_CONNECTIONS='${developmentConfig.DATABASE_CONNECTIONS}'`);

  // Demonstrate actual loading (using development config)
  try {
    // Set environment for demonstration
    process.env.SECRET_KEY = 'demo-secret-key';
    process.env.ENCRYPTION_KEY = 'demo-encryption-key';
    process.env.DATABASE_CONNECTIONS = developmentConfig.DATABASE_CONNECTIONS;

    logger.info('\n4. Loading Development Configuration:');
    const settings = await configManager.loadConfig();
    
    logger.info('Loaded databases:');
    Object.entries(settings.databases).forEach(([name, config]) => {
      logger.info(`  - ${name}: ${config.type} (${config.host || config.path})`);
    });

    // List all database names
    const dbNames = configManager.getDatabaseNames();
    logger.info(`\nTotal databases configured: ${dbNames.length}`);
    logger.info(`Database names: ${dbNames.join(', ')}`);

    // Get specific database config
    const devPostgres = configManager.getDatabaseConfig('dev_postgres');
    logger.info('\ndev_postgres configuration:');
    logger.info(`  Type: ${devPostgres.type}`);
    logger.info(`  Host: ${devPostgres.host}`);
    logger.info(`  Port: ${devPostgres.port}`);
    logger.info(`  Database: ${devPostgres.database}`);
    logger.info(`  Max Connections: ${devPostgres.maxConnections}`);

  } catch (error) {
    logger.error('Failed to load configuration:', error);
  }
}

// Additional examples for specific use cases
function showAdvancedExamples() {
  logger.info('\n=== Advanced JSON Configuration Examples ===');

  // Microservices setup
  const microservicesConfig = {
    DATABASE_CONNECTIONS: JSON.stringify([
      {
        name: 'users_service',
        type: 'postgresql',
        host: 'users-db.internal',
        port: 5432,
        username: 'users_app',
        password: process.env.USERS_DB_PASSWORD,
        database: 'users',
        maxConnections: 15,
        timeout: 30000
      },
      {
        name: 'orders_service',
        type: 'mysql',
        host: 'orders-db.internal',
        port: 3306,
        username: 'orders_app',
        password: process.env.ORDERS_DB_PASSWORD,
        database: 'orders',
        maxConnections: 20,
        timeout: 30000
      },
      {
        name: 'notifications_cache',
        type: 'sqlite',
        path: '/app/data/notifications.db',
        maxConnections: 1,
        timeout: 10000
      }
    ])
  };

  logger.info('\nMicroservices Configuration:');
  logger.info(`DATABASE_CONNECTIONS='${microservicesConfig.DATABASE_CONNECTIONS}'`);

  // Multi-tenant setup
  const multiTenantConfig = {
    DATABASE_CONNECTIONS: JSON.stringify([
      {
        name: 'tenant_company_a',
        type: 'postgresql',
        host: 'tenant-a.db.internal',
        port: 5432,
        username: 'tenant_a',
        password: process.env.TENANT_A_PASSWORD,
        database: 'company_a',
        maxConnections: 10,
        timeout: 30000
      },
      {
        name: 'tenant_company_b',
        type: 'postgresql',
        host: 'tenant-b.db.internal',
        port: 5432,
        username: 'tenant_b',
        password: process.env.TENANT_B_PASSWORD,
        database: 'company_b',
        maxConnections: 10,
        timeout: 30000
      },
      {
        name: 'shared_analytics',
        type: 'mysql',
        host: 'analytics.shared.internal',
        port: 3306,
        username: 'analytics',
        password: process.env.ANALYTICS_PASSWORD,
        database: 'shared_analytics',
        maxConnections: 5,
        timeout: 60000
      }
    ])
  };

  logger.info('\nMulti-tenant Configuration:');
  logger.info(`DATABASE_CONNECTIONS='${multiTenantConfig.DATABASE_CONNECTIONS}'`);
}

function showEnvironmentVariableUsage() {
  logger.info('\n=== Environment Variable Usage ===');
  logger.info('You can set DATABASE_CONNECTIONS in several ways:');
  logger.info('');
  logger.info('1. In .env file:');
  logger.info("DATABASE_CONNECTIONS='[{\"name\":\"mydb\",\"type\":\"postgresql\",...}]'");
  logger.info('');
  logger.info('2. Export in shell:');
  logger.info('export DATABASE_CONNECTIONS=\'[{"name":"mydb","type":"postgresql",...}]\'');
  logger.info('');
  logger.info('3. Set when running Node.js:');
  logger.info('DATABASE_CONNECTIONS=\'[...]\' node src/index.js');
  logger.info('');
  logger.info('4. Docker environment:');
  logger.info('docker run -e DATABASE_CONNECTIONS=\'[...]\' your-mcp-server');
  logger.info('');
  logger.info('Note: Individual environment variables (POSTGRES_HOST, etc.) still work');
  logger.info('and will be merged with JSON connections. Individual vars take priority');
  logger.info('if there are naming conflicts.');
}

// Run demonstrations
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateJsonConnections()
    .then(() => {
      showAdvancedExamples();
      showEnvironmentVariableUsage();
    })
    .catch(error => {
      logger.error('Example failed:', error);
      process.exit(1);
    });
} 