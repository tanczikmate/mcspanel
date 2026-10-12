import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/authService';

const setupInputSchema = z.object({
  username: z.string()
    .min(3, 'A felhasználónévnek legalább 3 karakter hosszúnak kell lennie')
    .max(32, 'A felhasználónév maximum 32 karakter lehet')
    .regex(/^[a-zA-Z0-9_-]+$/, 'A felhasználónév csak betűket, számokat, alulvonást és kötőjelet tartalmazhat'),
  password: z.string()
    .min(3, 'A jelszónak legalább 3 karakter hosszúnak kell lennie')
    .max(128, 'A jelszó legfeljebb 128 karakter lehet')
});

export async function setupRoutes(app: FastifyInstance) {
  // Check if system setup is required
  app.get('/api/setup/status', async () => {
    const isRequired = AuthService.isSetupRequired();
    return {
      isConfigured: !isRequired,
      setupRequired: isRequired
    };
  });

  // Perform initial admin setup
  app.post('/api/setup/init', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Check if setup is already done
    if (!AuthService.isSetupRequired()) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'A rendszer beállítása már korábban megtörtént. Az adminisztrátor már létezik.'
      });
    }

    // 2. Validate input
    const parseResult = setupInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return reply.status(400).send({
        error: 'Bad Request',
        message: issue.message
      });
    }

    const { username, password } = parseResult.data;

    try {
      // 3. Create admin user
      const user = await AuthService.createInitialAdmin(username, password);

      // 4. Generate JWT token
      const token = app.jwt.sign(
        {
          id: user.id,
          username: user.username,
          isAdmin: true
        },
        { expiresIn: '7d' }
      );

      return reply.status(201).send({
        success: true,
        message: 'Adminisztrátori fiók sikeresen létrehozva!',
        user,
        token
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Hiba történt a regisztráció során.'
      });
    }
  });
}
