import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { InstanceService } from '../services/instanceService';
import { ProcessManager } from '../services/processManager';
import { PermissionService } from '../services/permissionService';

const detectDirectorySchema = z.object({
  directoryPath: z.string().min(1, 'A szerver könyvtárának megadása kötelező')
});

const createInstanceSchema = z.object({
  name: z.string().min(1, 'A szerver nevének megadása kötelező'),
  directoryPath: z.string().min(1, 'A szerver könyvtárának megadása kötelező'),
  startFile: z.string().optional(),
  autoRestart: z.boolean().optional(),
  startOnBoot: z.boolean().optional()
});

const updateInstanceSchema = z.object({
  name: z.string().optional(),
  directoryPath: z.string().optional(),
  startFile: z.string().optional(),
  autoRestart: z.boolean().optional(),
  startOnBoot: z.boolean().optional()
});

const commandSchema = z.object({
  command: z.string().min(1, 'A parancs nem lehet üres')
});

interface IdParams {
  id: string;
}

export async function instanceRoutes(app: FastifyInstance) {
  // 0. Detect directory scripts and server properties (Admin only)
  app.post('/api/instances/detect', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const parseResult = detectDirectorySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parseResult.error.issues[0].message
      });
    }

    try {
      const result = InstanceService.detectDirectory(parseResult.data.directoryPath);
      return reply.send({
        success: true,
        ...result
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 1. List accessible instances
  app.get('/api/instances', { preHandler: [app.authenticate] }, async (request) => {
    const instances = await InstanceService.getAllInstances(request.user);
    return { instances };
  });

  // 2. Create instance (Admin only)
  app.post('/api/instances', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const parseResult = createInstanceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parseResult.error.issues[0].message
      });
    }

    try {
      const instance = InstanceService.createInstance(parseResult.data);
      return reply.status(201).send({
        success: true,
        message: 'Szerver sikeresen hozzáadva!',
        instance
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 3. Get single instance
  app.get<{ Params: IdParams }>('/api/instances/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const instance = await InstanceService.getInstanceById(id, request.user);
      return { instance };
    } catch (err: any) {
      return reply.status(404).send({
        error: 'Not Found',
        message: err.message
      });
    }
  });

  // 3.5. Get instance live resource usage
  app.get<{ Params: IdParams }>('/api/instances/:id/usage', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canViewConsole')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver adatainak megtekintésére!'
      });
    }
    const usage = await ProcessManager.getUsage(id);
    return { success: true, usage };
  });

  // 4. Update instance config (Admin or canEditConfig)
  app.put<{ Params: IdParams }>('/api/instances/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canEditConfig')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver beállításainak módosítására!'
      });
    }

    const parseResult = updateInstanceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parseResult.error.issues[0].message
      });
    }

    try {
      const updated = await InstanceService.updateInstance(id, parseResult.data);
      return reply.send({
        success: true,
        message: 'Szerver beállításai sikeresen frissítve!',
        instance: updated
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 5. Delete instance (Admin only)
  app.delete<{ Params: IdParams }>('/api/instances/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    try {
      await InstanceService.deleteInstance(id);
      return reply.send({
        success: true,
        message: 'Szerver sikeresen törölve!'
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 6. Start server
  app.post<{ Params: IdParams }>('/api/instances/:id/start', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canStart')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver elindítására!'
      });
    }

    try {
      const state = await ProcessManager.start(id, request.user.username);
      return reply.send({
        success: true,
        message: 'Szerver indítása folyamatban...',
        state
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 7. Stop server (graceful)
  app.post<{ Params: IdParams }>('/api/instances/:id/stop', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canStop')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver leállítására!'
      });
    }

    try {
      await ProcessManager.stop(id, 25000, request.user.username);
      return reply.send({
        success: true,
        message: 'Szerver leállítása folyamatban (stop parancs elküldve)...'
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 8. Restart server
  app.post<{ Params: IdParams }>('/api/instances/:id/restart', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canRestart')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver újraindítására!'
      });
    }

    try {
      const state = await ProcessManager.restart(id, request.user.username);
      return reply.send({
        success: true,
        message: 'Szerver újraindítása folyamatban...',
        state
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 9. Kill server (force)
  app.post<{ Params: IdParams }>('/api/instances/:id/kill', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canKill')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver kényszerített leállítására (kill)!'
      });
    }

    try {
      await ProcessManager.kill(id, request.user.username);
      return reply.send({
        success: true,
        message: 'Szerver folyamat kényszerítve leállítva!'
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 10. Send command
  app.post<{ Params: IdParams }>('/api/instances/:id/command', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canSendCommands')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod parancsot küldeni ebbe a szerverbe!'
      });
    }

    const parseResult = commandSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parseResult.error.issues[0].message
      });
    }

    try {
      ProcessManager.sendCommand(id, parseResult.data.command, request.user.username);
      return reply.send({
        success: true,
        message: 'Parancs elküldve!'
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 11. Get logs buffer
  app.get<{ Params: IdParams }>('/api/instances/:id/logs', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canViewConsole')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver konzoljának megtekintésére!'
      });
    }

    const logs = ProcessManager.getLogs(id);
    const state = ProcessManager.getStatus(id);
    return {
      logs,
      state
    };
  });

  // 12. Get users with permissions for this instance (Admin only)
  app.get<{ Params: IdParams }>('/api/instances/:id/users', { preHandler: [app.requireAdmin] }, async (request) => {
    const { id } = request.params;
    const users = PermissionService.getInstanceUsersPermissions(id);
    return { users };
  });

  // 13. Get resource history (CPU & RAM time-series)
  app.get<{ Params: IdParams }>('/api/instances/:id/resource-history', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    if (!PermissionService.checkUserPermission(request.user.id, id, 'canViewConsole')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Nincs jogosultságod a szerver adatainak megtekintésére!'
      });
    }

    const history = ProcessManager.getResourceHistory(id);
    return {
      history
    };
  });
}
