import { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'A kéréshez érvényes bejelentkezési token szükséges!'
    });
  }

  // Active database verification: Ensure the user still exists in DB and sync roles
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(request.user.id) as
      | { id: string; username: string; is_admin: number }
      | undefined;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'A felhasználói fiók már nem létezik vagy törölve lett.'
      });
    }

    // Refresh user state from current database record
    request.user.isAdmin = user.is_admin === 1;
    request.user.username = user.username;
  } catch {
    // If DB check fails unexpectedly, proceed with token payload
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (!request.user || !request.user.isAdmin) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Ehhez a művelethez adminisztrátori jogosultság szükséges!'
    });
  }
}
