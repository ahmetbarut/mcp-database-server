#!/usr/bin/env node

/**
 * Multi-Connection Test Script
 * Tests the MCP Database Server with multiple database connections
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  // Test with multiple connections
  databases: [
    {
      name: "test_sqlite",
      type: "sqlite",
      path: "./test_data/test.db",
      maxConnections: 5,
      timeout: 10000
    },
    {
      name: "test_postgres",
      type: "postgresql", 
      host: "localhost",
      port: 5432,
      database: "testdb",
      username: "testuser",
      password: "testpass",
      maxConnections: 10,
      timeout: 30000
    },
    {
      name: "test_mysql",
      type: "mysql",
      host: "localhost", 
      port: 3306,
      database: "testdb",
      username: "testuser",
      password: "testpass",
      maxConnections: 10,
      timeout: 30000
    }
  ]
};

// Save test configuration
const configPath = path.join(process.cwd(), 'test-databases.json');
console.log('Creating test configuration file:', configPath);

try {
  const fs = await import('fs/promises');
  await fs.writeFile(configPath, JSON.stringify(TEST_CONFIG.databases, null, 2));
  console.log('✅ Test configuration saved');
} catch (error) {
  console.error('❌ Failed to save test configuration:', error.message);
  process.exit(1);
}

// Set environment variables for testing
process.env.DATABASE_CONNECTIONS_FILE = configPath;
process.env.LOG_LEVEL = 'debug';

console.log('\n🧪 Starting MCP Database Server with multi-connection test...\n');

// Start the MCP server
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let serverOutput = '';
let serverError = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log('📤 Server:', output.trim());
});

serverProcess.stderr.on('data', (data) => {
  const error = data.toString();
  serverError += error;
  console.log('❌ Server Error:', error.trim());
});

serverProcess.on('close', (code) => {
  console.log(`\n🔚 Server process exited with code ${code}`);
  
  if (code !== 0) {
    console.error('❌ Server failed to start properly');
    console.error('Server Error Output:', serverError);
    process.exit(1);
  }
});

// Wait a bit for server to start
setTimeout(() => {
  console.log('\n📋 Testing MCP Tools...\n');
  
  // Test 1: List all connections
  console.log('🔍 Test 1: Listing all connections...');
  sendMCPRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'list_connections',
      arguments: {}
    }
  });
  
  // Test 2: List databases (should show all configured connections)
  setTimeout(() => {
    console.log('\n🔍 Test 2: Listing databases (no specific connection)...');
    sendMCPRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_databases',
        arguments: {}
      }
    });
  }, 1000);
  
  // Test 3: Retry failed connections
  setTimeout(() => {
    console.log('\n🔄 Test 3: Retrying failed connections...');
    sendMCPRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'retry_failed_connections',
        arguments: {}
      }
    });
  }, 2000);
  
  // Test 4: List connections again after retry
  setTimeout(() => {
    console.log('\n🔍 Test 4: Listing connections after retry...');
    sendMCPRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'list_connections',
        arguments: {}
      }
    });
  }, 3000);
  
  // Cleanup and exit
  setTimeout(() => {
    console.log('\n🧹 Cleaning up...');
    serverProcess.kill();
    
    // Remove test config file
    try {
      const fs = require('fs');
      fs.unlinkSync(configPath);
      console.log('✅ Test configuration file removed');
    } catch (error) {
      console.log('⚠️  Could not remove test configuration file:', error.message);
    }
    
    console.log('\n✅ Multi-connection test completed!');
    process.exit(0);
  }, 4000);
  
}, 2000);

function sendMCPRequest(request) {
  const requestStr = JSON.stringify(request) + '\n';
  console.log('📤 Sending:', requestStr.trim());
  serverProcess.stdin.write(requestStr);
  
  // Listen for response
  const originalOutput = serverOutput;
  const checkResponse = setInterval(() => {
    if (serverOutput !== originalOutput) {
      clearInterval(checkResponse);
      const newOutput = serverOutput.substring(originalOutput.length);
      console.log('📥 Received:', newOutput.trim());
    }
  }, 100);
  
  // Timeout after 5 seconds
  setTimeout(() => {
    clearInterval(checkResponse);
    console.log('⏰ Response timeout');
  }, 5000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  serverProcess.kill();
  process.exit(0);
}); 