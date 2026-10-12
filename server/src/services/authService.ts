import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { DbUser, UserResponse } from '../types';

export class AuthService {
  static isSetupRequired(): boolean {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return row.count === 0;
  }

  static async createInitialAdmin(username: string, password: string): Promise<UserResponse> {
    if (!this.isSetupRequired()) {
      throw new Error('A rendszer beállítása már megtörtént! Az adminisztrátori fiók már létezik.');
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      throw new Error('A felhasználónévnek legalább 3 karakter hosszúnak kell lennie.');
    }

    if (!password || password.length < 3) {
      throw new Error('A jelszónak legalább 3 karakter hosszúnak kell lennie.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT INTO users (id, username, password_hash, is_admin, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
    `);

    insertStmt.run(id, trimmedUsername, passwordHash, now, now, now);

    return {
      id,
      username: trimmedUsername,
      isAdmin: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now
    };
  }

  static async validateCredentials(username: string, password: string): Promise<UserResponse> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      throw new Error('Kérjük, adja meg a felhasználónevet és a jelszót!');
    }

    const db = getDb();
    const row = db.prepare(`
      SELECT id, username, password_hash, is_admin, last_login_at, created_at, updated_at 
      FROM users 
      WHERE username = ? COLLATE NOCASE
    `).get(trimmedUsername) as DbUser | undefined;

    if (!row) {
      throw new Error('Érvénytelen felhasználónév vagy jelszó!');
    }

    const isMatch = await bcrypt.compare(password, row.password_hash);
    if (!isMatch) {
      throw new Error('Érvénytelen felhasználónév vagy jelszó!');
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, row.id);

    return {
      id: row.id,
      username: row.username,
      isAdmin: row.is_admin === 1,
      lastLoginAt: now,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
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
}
