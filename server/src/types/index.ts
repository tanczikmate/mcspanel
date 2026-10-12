import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; username: string; isAdmin: boolean };
    user: { id: string; username: string; isAdmin: boolean };
  }
}

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  is_admin: number;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserResponse {
  id: string;
  username: string;
  isAdmin: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DbInstance {
  id: string;
  name: string;
  directory_path: string;
  start_command: string;
  cached_port: number | null;
  auto_restart: number;
  start_on_boot: number;
  cached_version: string | null;
  last_started_at: string | null;
  last_started_by: string | null;
  last_stopped_at: string | null;
  last_stopped_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPermission {
  id: string;
  user_id: string;
  instance_id: string;
  can_view_console: number;
  can_send_commands: number;
  can_start: number;
  can_stop: number;
  can_restart: number;
  can_kill: number;
  can_edit_config: number;
  created_at: string;
}

export interface PermissionResponse {
  id: string;
  userId: string;
  instanceId: string;
  instanceName?: string;
  canViewConsole: boolean;
  canSendCommands: boolean;
  canStart: boolean;
  canStop: boolean;
  canRestart: boolean;
  canKill: boolean;
  canEditConfig: boolean;
  createdAt: string;
}

export interface UpdatePermissionInput {
  canViewConsole?: boolean;
  canSendCommands?: boolean;
  canStart?: boolean;
  canStop?: boolean;
  canRestart?: boolean;
  canKill?: boolean;
  canEditConfig?: boolean;
}

export interface JWTPayload {
  id: string;
  username: string;
  isAdmin: boolean;
}
