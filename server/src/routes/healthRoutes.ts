import { FastifyInstance } from 'fastify';
import os from 'os';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      platform: {
        os: process.platform,
        arch: process.arch,
        node: process.version,
        hostname: os.hostname()
      }
    };
  });
}
