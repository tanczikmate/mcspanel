export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export type ServerStatus = 'OFFLINE' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'CRASHED';

export interface InstancePermissions {
  canViewConsole: boolean;
  canSendCommands: boolean;
  canStart: boolean;
  canStop: boolean;
  canRestart: boolean;
  canKill: boolean;
  canEditConfig: boolean;
}

export interface ResourceHistoryPoint {
  timestamp: number;
  time: string;
  cpu: number;
  memoryBytes: number;
  memoryMB: number;
}

export interface JvmHeapStats {
  usedBytes: number;
  maxBytes: number;
  usedFormatted: string;
  maxFormatted: string;
  percent: number;
}

export interface ResourceUsage {
  cpu: number;
  memoryBytes: number;
  memoryFormatted: string;
  jvmHeap?: JvmHeapStats | null;
  players?: {
    online: number;
    max: number;
    names: string[];
  };
  version?: string | null;
}

export interface Instance {
  id: string;
  name: string;
  directoryPath: string;
  startCommand: string;
  port: number;
  status: ServerStatus;
  pid: number | null;
  startedAt: string | null;
  autoRestart?: boolean;
  startOnBoot?: boolean;
  lastStartedAt?: string | null;
  lastStartedBy?: string | null;
  lastStoppedAt?: string | null;
  lastStoppedBy?: string | null;
  resourceUsage?: ResourceUsage | null;
  version?: string | null;
  permissions?: InstancePermissions;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
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
