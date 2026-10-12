import { Instance, User, Permission, ServerStatus, ResourceHistoryPoint } from '../types';

const TOKEN_KEY = 'mcspanel_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY)
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});
  
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      authStorage.clearToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error(data.message || data.error || `Kérés hiba (${res.status})`);
  }

  return data as T;
}

export const api = {
  // Setup
  getSetupStatus: () => apiFetch<{ isConfigured: boolean; setupRequired: boolean }>('/api/setup/status'),
  initSetup: (username: string, password: string) =>
    apiFetch<{ success: boolean; token: string; user: User }>('/api/setup/init', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  // Auth
  login: (username: string, password: string) =>
    apiFetch<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  getMe: () => apiFetch<{ user: User }>('/api/auth/me'),

  // Instances
  getInstances: () => apiFetch<{ instances: Instance[] }>('/api/instances'),
  getInstance: (id: string) => apiFetch<{ instance: Instance }>(`/api/instances/${id}`),
  getInstanceUsers: (instanceId: string) =>
    apiFetch<{
      users: Array<{
        id: string;
        username: string;
        isAdmin: boolean;
        permissions: Permission | null;
      }>;
    }>(`/api/instances/${instanceId}/users`),
  detectDirectory: (directoryPath: string) =>
    apiFetch<{
      success: boolean;
      exists: boolean;
      directoryPath: string;
      detectedStartFiles: string[];
      selectedStartFile: string | null;
      hasProperties: boolean;
      port: number;
      motd?: string;
      version?: string | null;
      message?: string;
    }>('/api/instances/detect', {
      method: 'POST',
      body: JSON.stringify({ directoryPath })
    }),
  createInstance: (data: { name: string; directoryPath: string; startFile?: string }) =>
    apiFetch<{ success: boolean; instance: Instance }>('/api/instances', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateInstance: (
    id: string,
    data: { name?: string; directoryPath?: string; startFile?: string; autoRestart?: boolean; startOnBoot?: boolean }
  ) =>
    apiFetch<{ success: boolean; instance: Instance }>(`/api/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteInstance: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/instances/${id}`, {
      method: 'DELETE'
    }),

  // Server control
  startInstance: (id: string) =>
    apiFetch<{ success: boolean; state: any }>(`/api/instances/${id}/start`, { method: 'POST' }),
  stopInstance: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/instances/${id}/stop`, { method: 'POST' }),
  restartInstance: (id: string) =>
    apiFetch<{ success: boolean; state: any }>(`/api/instances/${id}/restart`, { method: 'POST' }),
  killInstance: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/instances/${id}/kill`, { method: 'POST' }),
  sendCommand: (id: string, command: string) =>
    apiFetch<{ success: boolean }>(`/api/instances/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ command })
    }),
  getLogs: (id: string) =>
    apiFetch<{ logs: { timestamp: string; text: string }[]; state: { status: ServerStatus; pid: number | null } }>(
      `/api/instances/${id}/logs`
    ),
  getResourceHistory: (id: string) =>
    apiFetch<{ history: ResourceHistoryPoint[] }>(`/api/instances/${id}/resource-history`),

  // Users & Permissions (Admin)
  getUsers: () => apiFetch<{ users: User[] }>('/api/users'),
  createUser: (data: { username: string; password: string; isAdmin?: boolean }) =>
    apiFetch<{ success: boolean; user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id: string, data: { password?: string; isAdmin?: boolean }) =>
    apiFetch<{ success: boolean; user: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteUser: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/users/${id}`, {
      method: 'DELETE'
    }),
  getUserPermissions: (userId: string) =>
    apiFetch<{ permissions: Permission[] }>(`/api/users/${userId}/permissions`),
  setUserPermissions: (userId: string, instanceId: string, perms: Partial<Permission>) =>
    apiFetch<{ success: boolean; permission: Permission }>(`/api/users/${userId}/permissions/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify(perms)
    }),
  revokeUserPermissions: (userId: string, instanceId: string) =>
    apiFetch<{ success: boolean }>(`/api/users/${userId}/permissions/${instanceId}`, {
      method: 'DELETE'
    })
};
