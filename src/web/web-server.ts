import { createServer, Server } from 'node:http';
import { ConnectionConfigStore } from '../config/config-store.js';
import { logger } from '../utils/logger.js';
import { handleRequest } from './routes.js';

export class WebUIServer {
  private server: Server;
  private port: number;

  constructor(port: number, store: ConnectionConfigStore) {
    this.port = port;
    this.server = createServer(async (req, res) => {
      try {
        await handleRequest(req, res, store);
      } catch (err) {
        logger.error('Web UI request error', err as Error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Web UI port ${this.port} is already in use, web UI disabled`);
          resolve();
        } else {
          reject(err);
        }
      });
      this.server.listen(this.port, () => {
        logger.info(`Web UI available at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Web UI server stopped');
        resolve();
      });
    });
  }
}
