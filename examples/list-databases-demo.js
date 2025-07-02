#!/usr/bin/env node

/**
 * MCP Database Server - List Databases Tool Demo
 * 
 * This demo shows how the list_databases tool works with both:
 * 1. Listing all configured connections (no parameters)
 * 2. Listing databases within a specific connection (with connection_name parameter)
 */

import chalk from 'chalk';

// Mock MCP Database Server for demonstration
class MockMCPDatabaseServer {
  constructor() {
    this.mockSettings = {
      databases: {
        'postgres_main': {
          name: 'postgres_main',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'secretpassword',
          database: 'mainapp',
          maxConnections: 20,
          timeout: 30000
        },
        'mysql_analytics': {
          name: 'mysql_analytics', 
          type: 'mysql',
          host: 'analytics.example.com',
          port: 3306,
          username: 'analyst',
          password: 'mysqlpass123',
          database: 'analytics_db',
          maxConnections: 15,
          timeout: 45000
        },
        'sqlite_local': {
          name: 'sqlite_local',
          type: 'sqlite',
          path: '/data/local.db',
          maxConnections: 1,
          timeout: 10000
        },
        'postgres_backup': {
          name: 'postgres_backup',
          type: 'postgresql',
          host: 'backup.example.com',
          port: 5433,
          username: 'backup_user',
          password: 'backup_pass',
          database: 'backup_db',
          maxConnections: 5,
          timeout: 60000
        }
      }
    };
  }

  async handleListDatabases(args = {}) {
    const connectionName = args.connection_name;

    // If connection_name is provided, list databases from that specific connection
    if (connectionName) {
      const connectionConfig = this.mockSettings.databases[connectionName];
      if (!connectionConfig) {
        return {
          content: [{
            type: 'text',
            text: `Error: Connection '${connectionName}' not found. Available connections: ${Object.keys(this.mockSettings.databases).join(', ')}`
          }],
          isError: true
        };
      }

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
        note: 'This is mock data. Real database listing will be available when database drivers are implemented.',
        status: 'mock_data'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    // List all configured connections
    const databases = Object.keys(this.mockSettings.databases).map((name) => {
      const config = this.mockSettings.databases[name];
      return {
        connection_name: name,
        name: config.name,
        type: config.type,
        status: 'configured',
        host: config.host || undefined,
        port: config.port || undefined,
        database: config.database || undefined,
        path: config.path || undefined,
      };
    });

    const result = {
      summary: {
        total_connections: databases.length,
        note: 'These are configured connections. Use connection_name parameter to list actual databases within a connection.'
      },
      connections: databases
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  getMockDatabasesForConnection(config) {
    switch (config.type) {
      case 'postgresql':
        return [
          { name: 'postgres', size: '8 MB', owner: 'postgres', encoding: 'UTF8' },
          { name: 'template0', size: '8 MB', owner: 'postgres', encoding: 'UTF8' },
          { name: 'template1', size: '8 MB', owner: 'postgres', encoding: 'UTF8' },
          { name: config.database || 'myapp', size: '47 MB', owner: config.username || 'user', encoding: 'UTF8' },
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
}

// Demo functions
function printHeader(title) {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan('='.repeat(60) + '\n'));
}

function printSubHeader(title) {
  console.log(chalk.yellow('\n' + '-'.repeat(40)));
  console.log(chalk.yellow.bold(`  ${title}`));
  console.log(chalk.yellow('-'.repeat(40)));
}

function formatJson(data) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return jsonStr
    .replace(/"([^"]+)":/g, chalk.blue('"$1"') + ':')
    .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"'))
    .replace(/: (\d+)/g, ': ' + chalk.magenta('$1'))
    .replace(/: (true|false)/g, ': ' + chalk.cyan('$1'));
}

async function runDemo() {
  const server = new MockMCPDatabaseServer();

  printHeader('MCP Database Server - List Databases Tool Demo');
  
  console.log(chalk.white('This demo shows the enhanced list_databases tool that can:'));
  console.log(chalk.white('• List all configured connections (no parameters)'));
  console.log(chalk.white('• List databases within a specific connection (with connection_name)\n'));

  // Demo 1: List all configured connections
  printSubHeader('Demo 1: List All Configured Connections');
  console.log(chalk.gray('Command: list_databases (no parameters)\n'));
  
  const allConnectionsResult = await server.handleListDatabases();
  const allConnectionsData = JSON.parse(allConnectionsResult.content[0].text);
  
  console.log(formatJson(allConnectionsData));

  // Demo 2: List databases for PostgreSQL connection
  printSubHeader('Demo 2: List Databases for PostgreSQL Connection');
  console.log(chalk.gray('Command: list_databases({ connection_name: "postgres_main" })\n'));
  
  const postgresResult = await server.handleListDatabases({ connection_name: 'postgres_main' });
  const postgresData = JSON.parse(postgresResult.content[0].text);
  
  console.log(formatJson(postgresData));

  // Demo 3: List databases for MySQL connection
  printSubHeader('Demo 3: List Databases for MySQL Connection');
  console.log(chalk.gray('Command: list_databases({ connection_name: "mysql_analytics" })\n'));
  
  const mysqlResult = await server.handleListDatabases({ connection_name: 'mysql_analytics' });
  const mysqlData = JSON.parse(mysqlResult.content[0].text);
  
  console.log(formatJson(mysqlData));

  // Demo 4: List databases for SQLite connection
  printSubHeader('Demo 4: List Databases for SQLite Connection');
  console.log(chalk.gray('Command: list_databases({ connection_name: "sqlite_local" })\n'));
  
  const sqliteResult = await server.handleListDatabases({ connection_name: 'sqlite_local' });
  const sqliteData = JSON.parse(sqliteResult.content[0].text);
  
  console.log(formatJson(sqliteData));

  // Demo 5: Error case - non-existent connection
  printSubHeader('Demo 5: Error Case - Non-existent Connection');
  console.log(chalk.gray('Command: list_databases({ connection_name: "non_existent" })\n'));
  
  const errorResult = await server.handleListDatabases({ connection_name: 'non_existent' });
  
  if (errorResult.isError) {
    console.log(chalk.red('ERROR: ') + errorResult.content[0].text);
  }

  // Usage examples
  printSubHeader('Usage Examples');
  console.log(chalk.white('1. List all configured connections:'));
  console.log(chalk.gray('   POST /mcp/call'));
  console.log(chalk.gray('   {'));
  console.log(chalk.gray('     "method": "tools/call",'));
  console.log(chalk.gray('     "params": {'));
  console.log(chalk.gray('       "name": "list_databases"'));
  console.log(chalk.gray('     }'));
  console.log(chalk.gray('   }\n'));

  console.log(chalk.white('2. List databases for specific connection:'));
  console.log(chalk.gray('   POST /mcp/call'));
  console.log(chalk.gray('   {'));
  console.log(chalk.gray('     "method": "tools/call",'));
  console.log(chalk.gray('     "params": {'));
  console.log(chalk.gray('       "name": "list_databases",'));
  console.log(chalk.gray('       "arguments": {'));
  console.log(chalk.gray('         "connection_name": "postgres_main"'));
  console.log(chalk.gray('       }'));
  console.log(chalk.gray('     }'));
  console.log(chalk.gray('   }\n'));

  printHeader('Demo Complete');
  console.log(chalk.green('✅ The list_databases tool now supports both:'));
  console.log(chalk.green('   • Connection listing (backward compatible)'));
  console.log(chalk.green('   • Database listing within connections (new feature)'));
  console.log(chalk.green('✅ Mock data is provided until database drivers are implemented'));
  console.log(chalk.green('✅ Comprehensive error handling for invalid connections\n'));
}

// Check if chalk is available
try {
  await import('chalk');
} catch (e) {
  console.error('This demo requires chalk for colored output. Install it with:');
  console.error('npm install chalk');
  process.exit(1);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { MockMCPDatabaseServer }; 