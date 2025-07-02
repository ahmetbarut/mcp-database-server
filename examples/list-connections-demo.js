#!/usr/bin/env node

/**
 * Example: List Database Connections Tool Demo
 * 
 * This example demonstrates the list_connections MCP tool and formats the output
 * in a human-readable way.
 */

import { spawn } from 'child_process';
import { logger } from '../dist/utils/logger.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatConnectionType(type) {
  const typeColors = {
    postgresql: 'blue',
    mysql: 'yellow',
    sqlite: 'green'
  };
  return colorize(type.toUpperCase(), typeColors[type] || 'reset');
}

function formatConnectionDetails(connection) {
  const { name, type, status, details, settings, credentials } = connection;
  
  console.log(`\n${colorize('┌─', 'cyan')} ${colorize(name, 'bright')} (${formatConnectionType(type)})`);
  console.log(`${colorize('├─', 'cyan')} Status: ${colorize(status, status === 'connected' ? 'green' : 'yellow')}`);
  
  // Connection details
  if (type === 'sqlite') {
    console.log(`${colorize('├─', 'cyan')} Path: ${colorize(details.path, 'cyan')}`);
  } else {
    console.log(`${colorize('├─', 'cyan')} Host: ${colorize(details.host, 'cyan')}:${colorize(details.port, 'cyan')}`);
    console.log(`${colorize('├─', 'cyan')} Database: ${colorize(details.database, 'cyan')}`);
  }
  
  // Settings
  console.log(`${colorize('├─', 'cyan')} Max Connections: ${colorize(settings.maxConnections, 'magenta')}`);
  console.log(`${colorize('├─', 'cyan')} Timeout: ${colorize(`${settings.timeout}ms`, 'magenta')}`);
  
  // Credentials (if included)
  if (credentials) {
    console.log(`${colorize('├─', 'cyan')} Username: ${colorize(credentials.username, 'yellow')}`);
    console.log(`${colorize('├─', 'cyan')} Password: ${colorize(credentials.password, 'red')}`);
  }
  
  console.log(`${colorize('└─', 'cyan')}`);
}

function formatSummary(summary) {
  console.log(`\n${colorize('📊 Connection Summary', 'bright')}`);
  console.log(`${colorize('─'.repeat(50), 'cyan')}`);
  console.log(`Total Connections: ${colorize(summary.total_connections, 'bright')}`);
  console.log(`Configured: ${colorize(summary.configured_connections, 'green')}`);
  console.log(`Active: ${colorize(summary.active_connections, 'red')}`);
  
  if (Object.keys(summary.by_type).length > 0) {
    console.log(`\nBy Type:`);
    Object.entries(summary.by_type).forEach(([type, count]) => {
      console.log(`  ${formatConnectionType(type)}: ${colorize(count, 'bright')}`);
    });
  }
}

async function callMCPTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const mcpProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });

    let output = '';
    let errorOutput = '';

    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MCP process exited with code ${code}:\n${errorOutput}`));
        return;
      }

      try {
        // Parse JSON-RPC responses
        const lines = output.split('\n').filter(line => line.trim() && line.startsWith('{'));
        const responses = lines.map(line => JSON.parse(line));
        
        // Find the tool call response
        const toolResponse = responses.find(r => r.result && r.result.content);
        if (toolResponse) {
          const data = JSON.parse(toolResponse.result.content[0].text);
          resolve(data);
        } else {
          reject(new Error('No valid tool response found'));
        }
      } catch (error) {
        reject(new Error(`Failed to parse MCP response: ${error.message}`));
      }
    });

    // Send JSON-RPC requests
    const requests = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'demo-client', version: '1.0.0' }
        }
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      }
    ];

    requests.forEach(req => {
      mcpProcess.stdin.write(JSON.stringify(req) + '\n');
    });
    mcpProcess.stdin.end();
  });
}

async function demonstrateListConnections() {
  console.log(colorize('🔗 MCP Database Server - List Connections Demo', 'bright'));
  console.log(colorize('═'.repeat(60), 'cyan'));

  try {
    // Test without credentials
    console.log(`\n${colorize('📋 Listing Connections (without credentials)', 'blue')}`);
    const connectionsBasic = await callMCPTool('list_connections');
    
    formatSummary(connectionsBasic.summary);
    
    if (connectionsBasic.connections.length > 0) {
      console.log(`\n${colorize('🔌 Connection Details', 'bright')}`);
      connectionsBasic.connections.forEach(formatConnectionDetails);
    } else {
      console.log(`\n${colorize('ℹ️  No connections configured', 'yellow')}`);
    }

    // Test with credentials
    if (connectionsBasic.connections.length > 0) {
      console.log(`\n${colorize('🔐 Listing Connections (with masked credentials)', 'blue')}`);
      const connectionsWithCreds = await callMCPTool('list_connections', { include_credentials: true });
      
      console.log(`\n${colorize('🔌 Connection Details (with credentials)', 'bright')}`);
      connectionsWithCreds.connections.forEach(formatConnectionDetails);
    }

  } catch (error) {
    console.error(`${colorize('❌ Error:', 'red')} ${error.message}`);
    process.exit(1);
  }
}

// Setup test environment
function setupTestEnvironment() {
  console.log(`\n${colorize('⚙️  Setting up test environment...', 'yellow')}`);
  
  // Set test configuration
  process.env.SECRET_KEY = 'demo-secret-key';
  process.env.ENCRYPTION_KEY = 'demo-encryption-key';
  process.env.DATABASE_CONNECTIONS = JSON.stringify([
    {
      name: 'production_postgres',
      type: 'postgresql',
      host: 'db.production.com',
      port: 5432,
      username: 'app_user',
      password: 'secure_password_123',
      database: 'production_db',
      maxConnections: 25,
      timeout: 30000
    },
    {
      name: 'analytics_mysql',
      type: 'mysql',
      host: 'analytics.internal',
      port: 3306,
      username: 'analytics_user',
      password: 'analytics_secret',
      database: 'analytics',
      maxConnections: 15,
      timeout: 45000
    },
    {
      name: 'local_cache',
      type: 'sqlite',
      path: '/app/data/cache.db',
      maxConnections: 1,
      timeout: 10000
    },
    {
      name: 'session_store',
      type: 'mysql',
      host: 'sessions.internal',
      port: 3307,
      username: 'session_user',
      password: 'session_pass',
      database: 'sessions',
      maxConnections: 10,
      timeout: 20000
    }
  ]);
  
  console.log(`${colorize('✅ Test environment configured with 4 sample connections', 'green')}`);
}

function showUsageExamples() {
  console.log(`\n${colorize('📖 Usage Examples', 'bright')}`);
  console.log(colorize('─'.repeat(40), 'cyan'));
  
  console.log(`\n${colorize('1. Basic connection listing:', 'yellow')}`);
  console.log('echo \'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_connections","arguments":{}}}\' | node dist/index.js');
  
  console.log(`\n${colorize('2. Include credentials (masked):', 'yellow')}`);
  console.log('echo \'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_connections","arguments":{"include_credentials":true}}}\' | node dist/index.js');
  
  console.log(`\n${colorize('3. Using with MCP Inspector:', 'yellow')}`);
  console.log('Command: node');
  console.log('Args: dist/index.js');
  console.log('Then call: list_connections');
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestEnvironment();
  demonstrateListConnections()
    .then(() => {
      showUsageExamples();
      console.log(`\n${colorize('🎉 Demo completed successfully!', 'green')}`);
    })
    .catch(error => {
      console.error(`${colorize('💥 Demo failed:', 'red')} ${error.message}`);
      process.exit(1);
    });
} 