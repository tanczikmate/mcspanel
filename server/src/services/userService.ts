import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { DbUser, UserResponse } from '../types';

export class UserService {
  static getAllUsers(): UserResponse[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, username, is_admin, last_login_at, created_at, updated_at 
      FROM users 
      ORDER BY created_at ASC
    `).all() as DbUser[];

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      isAdmin: r.is_admin === 1,
      lastLoginAt: r.last_login_at || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  static getUserById(id: string): UserResponse | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, username, is_admin, last_login_at, created_at, updated_at 
      FROM users 
      WHERE id = ?
    `).get(id) as DbUser | undefined;

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      isAdmin: row.is_admin === 1,
      lastLoginAt: row.last_login_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async createUser(username: string, password: string, isAdmin = false): Promise<UserResponse> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      throw new Error('A felhasználónévnek legalább 3 karakter hosszúnak kell lennie.');
    }

    if (!password || password.length < 3) {
      throw new Error('A jelszónak legalább 3 karakter hosszúnak kell lennie.');
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(trimmedUsername);
    if (existing) {
      throw new Error('Ez a felhasználónév már foglalt!');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const insertStmt = db.prepare(`
      INSERT INTO users (id, username, password_hash, is_admin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(id, trimmedUsername, passwordHash, isAdmin ? 1 : 0, now, now);

    return {
      id,
      username: trimmedUsername,
      isAdmin,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    };
  }

  static async updateUser(
    id: string,
    updates: { password?: string; isAdmin?: boolean }
  ): Promise<UserResponse> {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
    if (!user) {
      throw new Error('A megadott felhasználó nem található!');
    }

    // Safety check: if demoting from admin, ensure at least one other admin remains
    if (user.is_admin === 1 && updates.isAdmin === false) {
      const adminCountRow = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get() as { count: number };
      if (adminCountRow.count <= 1) {
        throw new Error('Nem veheted el az utolsó adminisztrátor jogosultságát!');
      }
    }

    const now = new Date().toISOString();
    let newPasswordHash = user.password_hash;
    if (updates.password && updates.password.trim().length > 0) {
      if (updates.password.length < 3) {
        throw new Error('Az új jelszónak legalább 3 karakter hosszúnak kell lennie.');
      }
      const salt = await bcrypt.genSalt(10);
      newPasswordHash = await bcrypt.hash(updates.password, salt);
    }

    const newIsAdmin = updates.isAdmin !== undefined ? (updates.isAdmin ? 1 : 0) : user.is_admin;

    const updateStmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, is_admin = ?, updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(newPasswordHash, newIsAdmin, now, id);

    return {
      id: user.id,
      username: user.username,
      isAdmin: newIsAdmin === 1,
      lastLoginAt: user.last_login_at || null,
      createdAt: user.created_at,
      updatedAt: now
    };
  }

  static deleteUser(id: string, currentUserId: string): void {
    if (id === currentUserId) {
      throw new Error('Nem törölheted a saját fiókodat!');
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
    if (!user) {
      throw new Error('A megadott felhasználó nem található!');
    }

    if (user.is_admin === 1) {
      const adminCountRow = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get() as { count: number };
      if (adminCountRow.count <= 1) {
        throw new Error('Nem törölheted az utolsó adminisztrátort!');
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}
