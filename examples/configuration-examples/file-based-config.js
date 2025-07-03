#!/usr/bin/env node

/**
 * Example: File-based Database Connections Configuration
 * 
 * This example demonstrates how to configure multiple database connections
 * using the DATABASE_CONNECTIONS_FILE environment variable with a JSON file.
 * 
 * This approach is much cleaner and less error-prone than using DATABASE_CONNECTIONS
 * environment variable with inline JSON.
 */

import { configManager } from '../../dist/config/settings.js';
import { logger } from '../../dist/utils/logger.js';
import { promises as fs } from 'fs';
import path from 'path';

async function demonstrateFileBasedConfiguration() {
  logger.info('=== File-based Database Configuration Example ===');
  
  // Step 1: Create a sample database configuration file
  const configFilePath = './examples/configuration-examples/databases.json';
  
  logger.info(`\n1. Using configuration file: ${configFilePath}`);
  
  try {
    // Read the example configuration file
    const configContent = await fs.readFile(configFilePath, 'utf-8');
    const databaseConfigs = JSON.parse(configContent);
    
    logger.info(`Found ${databaseConfigs.length} database configurations:`);
    databaseConfigs.forEach((config, index) => {
      logger.info(`  ${index + 1}. ${config.name} (${config.type})`);
    });
    
  } catch (error) {
    logger.error(`Failed to read configuration file: ${error.message}`);
    return;
  }

  // Step 2: Set environment variables for the demo
  logger.info('\n2. Setting environment variables:');
  process.env.SECRET_KEY = 'demo-secret-key';
  process.env.ENCRYPTION_KEY = 'demo-encryption-key';
  process.env.DATABASE_CONNECTIONS_FILE = configFilePath;
  
  logger.info(`DATABASE_CONNECTIONS_FILE=${process.env.DATABASE_CONNECTIONS_FILE}`);

  // Step 3: Load configuration using the config manager
  try {
    logger.info('\n3. Loading configuration with ConfigManager:');
    const settings = await configManager.loadConfig();
    
    logger.info('✅ Configuration loaded successfully!');
    logger.info(`Total databases configured: ${Object.keys(settings.databases).length}`);
    
    // Display each database configuration
    logger.info('\n4. Database configurations:');
    Object.entries(settings.databases).forEach(([name, config]) => {
      logger.info(`  📊 ${name}:`);
      logger.info(`     Type: ${config.type}`);
      if (config.type === 'sqlite') {
        logger.info(`     Path: ${config.path}`);
      } else {
        logger.info(`     Host: ${config.host}:${config.port}`);
        logger.info(`     Database: ${config.database}`);
        logger.info(`     Username: ${config.username}`);
      }
      logger.info(`     Max Connections: ${config.maxConnections}`);
      logger.info(`     Timeout: ${config.timeout}ms`);
      logger.info('');
    });

    // Step 5: Test individual database access
    logger.info('5. Testing database configuration access:');
    const dbNames = configManager.getDatabaseNames();
    
    for (const dbName of dbNames) {
      try {
        const dbConfig = configManager.getDatabaseConfig(dbName);
        logger.info(`  ✅ ${dbName}: Configuration accessible`);
      } catch (error) {
        logger.error(`  ❌ ${dbName}: ${error.message}`);
      }
    }

  } catch (error) {
    logger.error('❌ Failed to load configuration:', error);
  }
}

// Step 6: Show how to create your own configuration file
function showConfigurationFileFormat() {
  logger.info('\n=== Creating Your Own Configuration File ===');
  
  const exampleConfig = [
    {
      name: 'production_postgres',
      type: 'postgresql',
      host: 'prod-db.company.com',
      port: 5432,
      username: 'app_user',
      password: '${POSTGRES_PASSWORD}', // You can reference environment variables
      database: 'production',
      maxConnections: 25,
      timeout: 30000
    },
    {
      name: 'development_sqlite',
      type: 'sqlite',
      path: './data/dev.db',
      maxConnections: 1,
      timeout: 10000
    }
  ];

  logger.info('1. Create a JSON file (e.g., databases.json):');
  logger.info(JSON.stringify(exampleConfig, null, 2));
  
  logger.info('\n2. Set the environment variable:');
  logger.info('DATABASE_CONNECTIONS_FILE=./path/to/your/databases.json');
  
  logger.info('\n3. Benefits of file-based configuration:');
  logger.info('  ✅ Better syntax highlighting and validation in your editor');
  logger.info('  ✅ Easier to maintain and version control');
  logger.info('  ✅ No escaping issues with quotes or special characters');
  logger.info('  ✅ Can be shared across different deployment environments');
  logger.info('  ✅ Supports comments (if using JSON5 or YAML in the future)');
  
  logger.info('\n4. Security considerations:');
  logger.info('  🔒 Store sensitive files outside of version control');
  logger.info('  🔒 Use environment variables for passwords within the JSON');
  logger.info('  🔒 Set appropriate file permissions (e.g., 600)');
  logger.info('  🔒 Consider using secrets management for production');
}

// Run the demonstration
async function main() {
  await demonstrateFileBasedConfiguration();
  showConfigurationFileFormat();
  
  logger.info('\n=== Migration Guide ===');
  logger.info('To migrate from DATABASE_CONNECTIONS to DATABASE_CONNECTIONS_FILE:');
  logger.info('1. Create a JSON file with your database configurations');
  logger.info('2. Replace DATABASE_CONNECTIONS with DATABASE_CONNECTIONS_FILE in your environment');
  logger.info('3. Point DATABASE_CONNECTIONS_FILE to your JSON file path');
  logger.info('4. Remove the old DATABASE_CONNECTIONS environment variable');
  logger.info('\nNote: The old DATABASE_CONNECTIONS method still works but is deprecated.');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Example failed:', error);
    process.exit(1);
  });
}

export { demonstrateFileBasedConfiguration, showConfigurationFileFormat }; 