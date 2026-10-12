import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/authService';

const loginSchema = z.object({
  username: z.string().min(1, 'A felhasználónév megadása kötelező'),
  password: z.string().min(1, 'A jelszó megadása kötelező')
});

const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

// Periodic cleanup of stale lockout records
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedLoginAttempts.entries()) {
    if (entry.lockedUntil < now) {
      failedLoginAttempts.delete(ip);
    }
  }
}, 300000);
rateLimitCleanup.unref();

export async function authRoutes(app: FastifyInstance) {
  // Login endpoint
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientIp = request.ip || 'unknown';
    const now = Date.now();
    const attempt = failedLoginAttempts.get(clientIp);

    if (attempt && attempt.lockedUntil > now) {
      const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Túl sok sikertelen bejelentkezési kísérlet! Kérjük, várj még ${waitSeconds} másodpercet.`
      });
    }

    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parseResult.error.issues[0].message
      });
    }

    const { username, password } = parseResult.data;

    try {
      const user = await AuthService.validateCredentials(username, password);
      // Reset lockout on success
      failedLoginAttempts.delete(clientIp);

      const token = app.jwt.sign(
        {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin
        },
        { expiresIn: '7d' }
      );

      return reply.send({
        success: true,
        message: 'Sikeres bejelentkezés!',
        token,
        user
      });
    } catch (err: any) {
      const cur = failedLoginAttempts.get(clientIp) || { count: 0, lockedUntil: 0 };
      cur.count += 1;
      if (cur.count >= 5) {
        cur.lockedUntil = Date.now() + 60000; // Lock for 60 seconds
        cur.count = 0;
      }
      failedLoginAttempts.set(clientIp, cur);

      return reply.status(401).send({
        error: 'Unauthorized',
        message: err.message || 'Érvénytelen bejelentkezési adatok!'
      });
    }
  });

  // Get current user profile
  app.get(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = AuthService.getUserById(request.user.id);
      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'A bejelentkezett felhasználó nem található az adatbázisban.'
        });
      }

      return reply.send({
        user
      });
    }
  );
}
