import { IncomingMessage, ServerResponse } from 'node:http';
import { ConnectionConfigStore } from '../config/config-store.js';
import { DatabaseDriverFactory } from '../database/factory.js';
import { DatabaseConfigSchema } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { WEB_UI_HTML } from './ui.js';

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function html(res: ServerResponse, content: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: ConnectionConfigStore
): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';
  const path = url.pathname;

  // Serve UI
  if (path === '/' && method === 'GET') {
    return html(res, WEB_UI_HTML);
  }

  // API routes
  if (!path.startsWith('/api/connections')) {
    return json(res, { error: 'Not found' }, 404);
  }

  const segments = path.replace('/api/connections', '').split('/').filter(Boolean);

  try {
    // POST /api/connections/test — test without saving
    if (method === 'POST' && segments.length === 1 && segments[0] === 'test') {
      const body = JSON.parse(await readBody(req));
      const config = DatabaseConfigSchema.parse(body);
      return await testConnectionDirect(res, config);
    }

    // GET /api/connections
    if (method === 'GET' && segments.length === 0) {
      const connections = store.getAll();
      return json(res, { success: true, connections });
    }

    // POST /api/connections
    if (method === 'POST' && segments.length === 0) {
      const body = JSON.parse(await readBody(req));
      const config = DatabaseConfigSchema.parse(body);
      store.create(config);
      return json(res, { success: true, connection: config }, 201);
    }

    // Routes with :name
    if (segments.length >= 1) {
      const name = decodeURIComponent(segments[0]);

      // POST /api/connections/:name/test
      if (method === 'POST' && segments.length === 2 && segments[1] === 'test') {
        const config = store.getByName(name);
        if (!config) return json(res, { success: false, error: `Connection '${name}' not found` }, 404);
        return await testConnectionDirect(res, config);
      }

      // GET /api/connections/:name
      if (method === 'GET' && segments.length === 1) {
        const config = store.getByName(name);
        if (!config) return json(res, { success: false, error: `Connection '${name}' not found` }, 404);
        return json(res, { success: true, connection: config });
      }

      // PUT /api/connections/:name
      if (method === 'PUT' && segments.length === 1) {
        const body = JSON.parse(await readBody(req));
        store.update(name, body);
        const updated = store.getByName(body.name ?? name);
        return json(res, { success: true, connection: updated });
      }

      // DELETE /api/connections/:name
      if (method === 'DELETE' && segments.length === 1) {
        store.delete(name);
        return json(res, { success: true });
      }
    }

    return json(res, { error: 'Not found' }, 404);
  } catch (error) {
    const message = (error as Error).message;
    logger.error('Web UI API error', error as Error);

    if (message.includes('UNIQUE constraint')) {
      return json(res, { success: false, error: 'A connection with this name already exists' }, 409);
    }
    return json(res, { success: false, error: message }, 400);
  }
}

async function testConnectionDirect(res: ServerResponse, config: any): Promise<void> {
  try {
    const driver = await DatabaseDriverFactory.createAndConnect(config);
    await driver.disconnect();
    return json(res, { success: true, message: 'Connection successful' });
  } catch (error) {
    return json(res, { success: false, error: (error as Error).message });
  }
}
