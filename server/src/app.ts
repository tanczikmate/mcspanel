import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { authenticate, requireAdmin } from './middleware/authMiddleware';
import { healthRoutes } from './routes/healthRoutes';
import { setupRoutes } from './routes/setupRoutes';
import { authRoutes } from './routes/authRoutes';
import { userRoutes } from './routes/userRoutes';
import { instanceRoutes } from './routes/instanceRoutes';
import { wsRoutes } from './routes/wsRoutes';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: true
  });

  // Support empty JSON bodies gracefully
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, defaultDone) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      defaultDone(null, {});
      return;
    }
    try {
      const json = JSON.parse(body as string);
      defaultDone(null, json);
    } catch (err: any) {
      defaultDone(err, undefined);
    }
  });

  // Enable CORS
  app.register(cors, {
    origin: true,
    credentials: true
  });

  // Enable JWT
  app.register(jwt, {
    secret: config.JWT_SECRET
  });

  // Register Auth Decorators
  app.decorate('authenticate', authenticate);
  app.decorate('requireAdmin', requireAdmin);

  // Enable WebSocket
  app.register(websocket);

  // Register API Routes
  app.register(healthRoutes);
  app.register(setupRoutes);
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(instanceRoutes);
  app.register(wsRoutes);

  // Serve frontend build if available (production mode)
  const webDistPath = path.join(config.ROOT_DIR, 'web', 'dist');
  if (fs.existsSync(webDistPath)) {
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false
    });

    // SPA fallback: return index.html for unmatched non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Endpoint ${request.url} not found`
        });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
