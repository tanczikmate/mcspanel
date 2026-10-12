import { FastifyInstance, FastifyRequest } from 'fastify';
import { ProcessManager } from '../services/processManager';
import { PermissionService } from '../services/permissionService';
import { JWTPayload } from '../types';
import { getDb } from '../db';

interface WsParams {
  id: string;
}

interface WsQuery {
  token?: string;
}

export async function wsRoutes(app: FastifyInstance) {
  app.get<{ Params: WsParams; Querystring: WsQuery }>(
    '/api/instances/:id/console',
    { websocket: true },
    (socket /* WebSocket */, req /* FastifyRequest */) => {
      const instanceId = req.params.id;
      const queryToken = req.query.token;

      let authUser: JWTPayload | null = null;
      let isInitialized = false;
      let unsubscribe: (() => void) | null = null;
      let metricsInterval: NodeJS.Timeout | null = null;

      // Helper to verify token and validate against DB
      const verifyToken = (token: string): JWTPayload | null => {
        try {
          const payload = app.jwt.verify<JWTPayload>(token);
          if (!payload || !payload.id) return null;
          const db = getDb();
          const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(payload.id) as
            | { id: string; username: string; is_admin: number }
            | undefined;
          if (!user) return null;
          return {
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin === 1
          };
        } catch {
          return null;
        }
      };

      const cleanup = () => {
        if (metricsInterval) {
          clearInterval(metricsInterval);
          metricsInterval = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      };

      const initConnection = (user: JWTPayload) => {
        if (isInitialized) return;
        isInitialized = true;

        // Check console view permission
        const canView = PermissionService.checkUserPermission(user.id, instanceId, 'canViewConsole');
        if (!canView) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Nincs jogosultságod a szerver konzoljának megtekintésére!'
          }));
          socket.close(4003, 'Forbidden');
          return;
        }

        // Send initial buffered history, status, resource usage
        const logs = ProcessManager.getLogs(instanceId);
        const state = ProcessManager.getStatus(instanceId);

        ProcessManager.getUsage(instanceId).then((usage) => {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({
              type: 'init',
              data: {
                state,
                logs,
                usage
              }
            }));
          }
        });

        // Periodic live metrics
        metricsInterval = setInterval(async () => {
          if (socket.readyState === socket.OPEN) {
            const usage = await ProcessManager.getUsage(instanceId);
            socket.send(JSON.stringify({
              type: 'metrics',
              data: usage
            }));
          } else {
            cleanup();
          }
        }, 2000);

        // Subscribe to live log and status streams
        unsubscribe = ProcessManager.subscribe(instanceId, (msg) => {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(msg));
          }
        });
      };

      if (queryToken) {
        authUser = verifyToken(queryToken);
      }

      if (authUser) {
        initConnection(authUser);
      } else {
        // Wait for first message to be an auth packet if not in query params
        socket.send(JSON.stringify({
          type: 'auth_required',
          message: 'Hitelesítés szükséges a konzolhoz. Kérlek, küldd el a tokent.'
        }));
      }

      // Handle incoming messages from client
      socket.on('message', (raw: Buffer | string) => {
        try {
          const payload = JSON.parse(raw.toString('utf-8'));

          if (payload.type === 'auth') {
            const user = verifyToken(payload.token);
            if (!user) {
              socket.send(JSON.stringify({ type: 'error', message: 'Érvénytelen token!' }));
              socket.close(4001, 'Unauthorized');
              return;
            }
            authUser = user;
            initConnection(user);
            return;
          }

          if (payload.type === 'command') {
            if (!authUser) {
              socket.send(JSON.stringify({ type: 'error', message: 'Nem vagy hitelesítve!' }));
              return;
            }

            const canSend = PermissionService.checkUserPermission(authUser.id, instanceId, 'canSendCommands');
            if (!canSend) {
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Nincs parancsküldési jogosultságod erre a szerverre!'
              }));
              return;
            }

            if (payload.command && typeof payload.command === 'string') {
              ProcessManager.sendCommand(instanceId, payload.command, authUser?.username || 'Konzol');
            }
          }
        } catch (e: any) {
          socket.send(JSON.stringify({ type: 'error', message: e.message }));
        }
      });

      socket.on('close', cleanup);
      socket.on('error', cleanup);
    }
  );
}
