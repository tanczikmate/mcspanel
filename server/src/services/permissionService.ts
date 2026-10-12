import crypto from 'crypto';
import { getDb } from '../db';
import { DbPermission, PermissionResponse, UpdatePermissionInput } from '../types';

export class PermissionService {
  static getUserPermissions(userId: string): PermissionResponse[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        p.id,
        p.user_id,
        p.instance_id,
        i.name as instance_name,
        p.can_view_console,
        p.can_send_commands,
        p.can_start,
        p.can_stop,
        p.can_restart,
        p.can_kill,
        p.can_edit_config,
        p.created_at
      FROM permissions p
      LEFT JOIN instances i ON i.id = p.instance_id
      WHERE p.user_id = ?
    `).all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      instanceId: r.instance_id,
      instanceName: r.instance_name || 'Ismeretlen szerver',
      canViewConsole: r.can_view_console === 1,
      canSendCommands: r.can_send_commands === 1,
      canStart: r.can_start === 1,
      canStop: r.can_stop === 1,
      canRestart: r.can_restart === 1,
      canKill: r.can_kill === 1,
      canEditConfig: r.can_edit_config === 1,
      createdAt: r.created_at
    }));
  }

  static getPermission(userId: string, instanceId: string): PermissionResponse | null {
    const db = getDb();
    const r = db.prepare(`
      SELECT 
        p.id,
        p.user_id,
        p.instance_id,
        i.name as instance_name,
        p.can_view_console,
        p.can_send_commands,
        p.can_start,
        p.can_stop,
        p.can_restart,
        p.can_kill,
        p.can_edit_config,
        p.created_at
      FROM permissions p
      LEFT JOIN instances i ON i.id = p.instance_id
      WHERE p.user_id = ? AND p.instance_id = ?
    `).get(userId, instanceId) as any;

    if (!r) return null;

    return {
      id: r.id,
      userId: r.user_id,
      instanceId: r.instance_id,
      instanceName: r.instance_name || 'Ismeretlen szerver',
      canViewConsole: r.can_view_console === 1,
      canSendCommands: r.can_send_commands === 1,
      canStart: r.can_start === 1,
      canStop: r.can_stop === 1,
      canRestart: r.can_restart === 1,
      canKill: r.can_kill === 1,
      canEditConfig: r.can_edit_config === 1,
      createdAt: r.created_at
    };
  }

  static setPermissions(
    userId: string,
    instanceId: string,
    perms: UpdatePermissionInput
  ): PermissionResponse {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM permissions WHERE user_id = ? AND instance_id = ?').get(userId, instanceId) as DbPermission | undefined;

    if (existing) {
      const canViewConsole = perms.canViewConsole !== undefined ? (perms.canViewConsole ? 1 : 0) : existing.can_view_console;
      const canSendCommands = perms.canSendCommands !== undefined ? (perms.canSendCommands ? 1 : 0) : existing.can_send_commands;
      const canStart = perms.canStart !== undefined ? (perms.canStart ? 1 : 0) : existing.can_start;
      const canStop = perms.canStop !== undefined ? (perms.canStop ? 1 : 0) : existing.can_stop;
      const canRestart = perms.canRestart !== undefined ? (perms.canRestart ? 1 : 0) : existing.can_restart;
      const canKill = perms.canKill !== undefined ? (perms.canKill ? 1 : 0) : existing.can_kill;
      const canEditConfig = perms.canEditConfig !== undefined ? (perms.canEditConfig ? 1 : 0) : existing.can_edit_config;

      db.prepare(`
        UPDATE permissions
        SET can_view_console = ?,
            can_send_commands = ?,
            can_start = ?,
            can_stop = ?,
            can_restart = ?,
            can_kill = ?,
            can_edit_config = ?
        WHERE user_id = ? AND instance_id = ?
      `).run(
        canViewConsole,
        canSendCommands,
        canStart,
        canStop,
        canRestart,
        canKill,
        canEditConfig,
        userId,
        instanceId
      );
    } else {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO permissions (
          id, user_id, instance_id,
          can_view_console, can_send_commands, can_start, can_stop, can_restart, can_kill, can_edit_config,
          created_at
        ) VALUES (
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?
        )
      `).run(
        id,
        userId,
        instanceId,
        perms.canViewConsole !== undefined ? (perms.canViewConsole ? 1 : 0) : 1,
        perms.canSendCommands !== undefined ? (perms.canSendCommands ? 1 : 0) : 0,
        perms.canStart !== undefined ? (perms.canStart ? 1 : 0) : 0,
        perms.canStop !== undefined ? (perms.canStop ? 1 : 0) : 0,
        perms.canRestart !== undefined ? (perms.canRestart ? 1 : 0) : 0,
        perms.canKill !== undefined ? (perms.canKill ? 1 : 0) : 0,
        perms.canEditConfig !== undefined ? (perms.canEditConfig ? 1 : 0) : 0,
        now
      );
    }

    return this.getPermission(userId, instanceId)!;
  }

  static getInstanceUsersPermissions(instanceId: string): Array<{
    id: string;
    username: string;
    isAdmin: boolean;
    permissions: PermissionResponse | null;
  }> {
    const db = getDb();
    const users = db.prepare('SELECT id, username, is_admin FROM users ORDER BY is_admin DESC, username ASC').all() as any[];
    const perms = db.prepare('SELECT * FROM permissions WHERE instance_id = ?').all(instanceId) as any[];

    const permMap = new Map<string, any>();
    for (const p of perms) {
      permMap.set(p.user_id, p);
    }

    return users.map((u) => {
      const p = permMap.get(u.id);
      return {
        id: u.id,
        username: u.username,
        isAdmin: u.is_admin === 1,
        permissions: p
          ? {
              id: p.id,
              userId: p.user_id,
              instanceId: p.instance_id,
              instanceName: '',
              canViewConsole: p.can_view_console === 1,
              canSendCommands: p.can_send_commands === 1,
              canStart: p.can_start === 1,
              canStop: p.can_stop === 1,
              canRestart: p.can_restart === 1,
              canKill: p.can_kill === 1,
              canEditConfig: p.can_edit_config === 1,
              createdAt: p.created_at
            }
          : null
      };
    });
  }

  static revokePermissions(userId: string, instanceId: string): void {
    const db = getDb();
    db.prepare('DELETE FROM permissions WHERE user_id = ? AND instance_id = ?').run(userId, instanceId);
  }

  static checkUserPermission(
    userId: string,
    instanceId: string,
    permissionKey:
      | 'canViewConsole'
      | 'canSendCommands'
      | 'canStart'
      | 'canStop'
      | 'canRestart'
      | 'canKill'
      | 'canEditConfig'
  ): boolean {
    const db = getDb();
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as { is_admin: number } | undefined;
    if (!user) return false;

    // Administrators always have full permissions on every instance
    if (user.is_admin === 1) return true;

    // Check specific permission column
    const columnMap: Record<string, string> = {
      canViewConsole: 'can_view_console',
      canSendCommands: 'can_send_commands',
      canStart: 'can_start',
      canStop: 'can_stop',
      canRestart: 'can_restart',
      canKill: 'can_kill',
      canEditConfig: 'can_edit_config'
    };

    const columnName = columnMap[permissionKey];
    if (!columnName) return false;

    const row = db.prepare(`
      SELECT ${columnName} as val 
      FROM permissions 
      WHERE user_id = ? AND instance_id = ?
    `).get(userId, instanceId) as { val: number } | undefined;

    return row ? row.val === 1 : false;
  }
}
