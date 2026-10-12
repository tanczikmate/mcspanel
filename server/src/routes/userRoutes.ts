import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/userService';
import { PermissionService } from '../services/permissionService';

const createUserSchema = z.object({
  username: z.string()
    .min(3, 'A felhasználónévnek legalább 3 karakter hosszúnak kell lennie')
    .max(32, 'A felhasználónév maximum 32 karakter lehet')
    .regex(/^[a-zA-Z0-9_-]+$/, 'A felhasználónév csak betűket, számokat, alulvonást és kötőjelet tartalmazhat'),
  password: z.string()
    .min(3, 'A jelszónak legalább 3 karakter hosszúnak kell lennie')
    .max(128, 'A jelszó legfeljebb 128 karakter lehet'),
  isAdmin: z.boolean().optional().default(false)
});

const updateUserSchema = z.object({
  password: z.string().min(3, 'A jelszónak legalább 3 karakter hosszúnak kell lennie').max(128).optional(),
  isAdmin: z.boolean().optional()
});

const updatePermissionSchema = z.object({
  canViewConsole: z.boolean().optional(),
  canSendCommands: z.boolean().optional(),
  canStart: z.boolean().optional(),
  canStop: z.boolean().optional(),
  canRestart: z.boolean().optional(),
  canKill: z.boolean().optional(),
  canEditConfig: z.boolean().optional()
});

interface IdParams {
  id: string;
}

interface InstancePermParams {
  id: string;
  instanceId: string;
}

export async function userRoutes(app: FastifyInstance) {
  // 1. List all users (Admin only)
  app.get('/api/users', { preHandler: [app.requireAdmin] }, async () => {
    const users = UserService.getAllUsers();
    return { users };
  });

  // 2. Create a new user (Admin only)
  app.post('/api/users', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const parseResult = createUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parseResult.error.issues[0].message
      });
    }

    const { username, password, isAdmin } = parseResult.data;

    try {
      const user = await UserService.createUser(username, password, isAdmin);
      return reply.status(201).send({
        success: true,
        message: 'Felhasználó sikeresen létrehozva!',
        user
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // 3. Update a user (Admin only)
  app.put<{ Params: IdParams }>(
    '/api/users/:id',
    { preHandler: [app.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const parseResult = updateUserSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parseResult.error.issues[0].message
        });
      }

      try {
        const updatedUser = await UserService.updateUser(id, parseResult.data);
        return reply.send({
          success: true,
          message: 'Felhasználó sikeresen frissítve!',
          user: updatedUser
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err.message
        });
      }
    }
  );

  // 4. Delete a user (Admin only)
  app.delete<{ Params: IdParams }>(
    '/api/users/:id',
    { preHandler: [app.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      try {
        UserService.deleteUser(id, request.user.id);
        return reply.send({
          success: true,
          message: 'Felhasználó sikeresen törölve!'
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err.message
        });
      }
    }
  );

  // 5. Get user's permissions
  app.get<{ Params: IdParams }>(
    '/api/users/:id/permissions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      // Allow users to view their own permissions, or admin can view anyone's
      if (request.user.id !== id && !request.user.isAdmin) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Csak a saját jogosultságaidat tekintheted meg!'
        });
      }

      const permissions = PermissionService.getUserPermissions(id);
      return reply.send({ permissions });
    }
  );

  // 6. Update user's permissions for an instance (Admin only)
  app.put<{ Params: InstancePermParams }>(
    '/api/users/:id/permissions/:instanceId',
    { preHandler: [app.requireAdmin] },
    async (request, reply) => {
      const { id, instanceId } = request.params;
      const parseResult = updatePermissionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parseResult.error.issues[0].message
        });
      }

      try {
        const permission = PermissionService.setPermissions(id, instanceId, parseResult.data);
        return reply.send({
          success: true,
          message: 'Jogosultságok sikeresen mentve!',
          permission
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err.message
        });
      }
    }
  );

  // 7. Revoke user's permissions for an instance (Admin only)
  app.delete<{ Params: InstancePermParams }>(
    '/api/users/:id/permissions/:instanceId',
    { preHandler: [app.requireAdmin] },
    async (request, reply) => {
      const { id, instanceId } = request.params;
      try {
        PermissionService.revokePermissions(id, instanceId);
        return reply.send({
          success: true,
          message: 'Hozzáférési jog sikeresen visszavonva!'
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err.message
        });
      }
    }
  );
}
