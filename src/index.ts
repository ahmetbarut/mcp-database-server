#!/usr/bin/env node

/**
 * MCP Database Server
 * Main entry point for the Model Context Protocol database server
 */

import { MCPDatabaseServer } from './server/index.js';
import { logger } from './utils/logger.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  const server = new MCPDatabaseServer();

  // Setup graceful shutdown
  const shutdown = async () => {
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error as Error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the server
  try {
    await server.start();
  } catch (error) {
    logger.error('Failed to start MCP Database Server', error as Error);
    process.exit(1);
  }
}

// Run the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 