import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Instance, ResourceUsage, ServerStatus, Permission } from '../types';
import { authStorage, api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { ConsoleViewer, ConsoleLogEntry } from '../components/ConsoleViewer';
import { Modal } from '../components/Modal';
import {
  Play,
  Square,
  RotateCw,
  Skull,
  ArrowLeft,
  Network,
  HardDrive,
  Clock,
  PowerOff,
  RefreshCcw,
  Zap,
  Users,
  Check,
  UserCheck,
  Loader2,
  Layers,
  Trash2,
  Pencil,
  Settings
} from 'lucide-react';

interface InstancePageProps {
  instanceId: string;
  onBack: () => void;
}

interface InstanceUserAccess {
  id: string;
  username: string;
  isAdmin: boolean;
  permissions: Permission | null;
}

export const InstancePage: React.FC<InstancePageProps> = ({ instanceId, onBack }) => {
  const { user: currentUser } = useAuth();
  const { alert, confirm } = useDialog();
  const wsRef = useRef<WebSocket | null>(null);
  const logIdRef = useRef<number>(0);

  const [instance, setInstance] = useState<Instance | null>(null);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<ServerStatus>('OFFLINE');
  const [usage, setUsage] = useState<ResourceUsage>({
    cpu: 0,
    memoryBytes: 0,
    memoryFormatted: '0 MB',
    jvmHeap: null,
    players: { online: 0, max: 20, names: [] }
  });
  const [isConnected, setIsConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [autoRestart, setAutoRestart] = useState(false);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Instance users access state (for admins)
  const [instanceUsers, setInstanceUsers] = useState<InstanceUserAccess[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Helper to append a single log line cleanly with a buffer limit
  const appendLog = useCallback((text: string, stream?: 'stdout' | 'stderr', timestamp?: string) => {
    if (!text || !text.trim()) return;
    const newEntry: ConsoleLogEntry = {
      id: ++logIdRef.current,
      text,
      stream,
      timestamp
    };
    setLogs((prev) => {
      const next = [...prev, newEntry];
      return next.length > 3000 ? next.slice(next.length - 3000) : next;
    });
  }, []);

  // Helper to append a batched set of log lines (stream throttler support)
  const appendLogsBatch = useCallback((entries: Array<{ text: string; stream?: 'stdout' | 'stderr'; timestamp?: string }>) => {
    if (!entries || entries.length === 0) return;
    const newItems: ConsoleLogEntry[] = [];
    for (const e of entries) {
      if (e.text && e.text.trim()) {
        newItems.push({
          id: ++logIdRef.current,
          text: e.text,
          stream: e.stream,
          timestamp: e.timestamp || new Date().toISOString()
        });
      }
    }
    if (newItems.length === 0) return;
    setLogs((prev) => {
      const next = [...prev, ...newItems];
      return next.length > 3000 ? next.slice(next.length - 3000) : next;
    });
  }, []);

  // Fetch instance details
  const refreshInstance = useCallback(async () => {
    try {
      const res = await api.getInstance(instanceId);
      setInstance(res.instance);
      setCurrentStatus(res.instance.status);
      setAutoRestart(!!res.instance.autoRestart);
      setStartOnBoot(!!res.instance.startOnBoot);
      if (res.instance.resourceUsage) {
        setUsage(res.instance.resourceUsage);
      }
    } catch (err: any) {
      console.error('Failed to load instance:', err);
    }
  }, [instanceId]);

  // Fetch users permissions for this instance (admin only)
  const refreshInstanceUsers = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await api.getInstanceUsers(instanceId);
      setInstanceUsers(res.users);
    } catch (err: any) {
      console.error('Failed to load instance users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [instanceId, currentUser?.isAdmin]);

  useEffect(() => {
    refreshInstance();
    refreshInstanceUsers();
  }, [refreshInstance, refreshInstanceUsers]);

  // Sync browser document title with server name
  useEffect(() => {
    if (instance?.name) {
      document.title = `${instance.name} – MCSPanel`;
    }
    return () => {
      document.title = 'MCSPanel';
    };
  }, [instance?.name]);

  // WebSocket Connection for real-time logs, metrics and status
  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/instances/${instanceId}/console?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      appendLog('\x1b[90m[MCSPanel] Konzol kapcsolat sikeresen felépítve.\x1b[0m');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          if (msg.data.state?.status) {
            setCurrentStatus(msg.data.state.status);
          }
          if (msg.data.usage) {
            setUsage(msg.data.usage);
          }
          if (Array.isArray(msg.data.logs)) {
            const initialList: ConsoleLogEntry[] = msg.data.logs
              .filter((l: any) => l.text && l.text.trim())
              .map((l: any) => ({
                id: ++logIdRef.current,
                text: l.text,
                stream: l.stream,
                timestamp: l.timestamp
              }));
            setLogs(initialList.length > 3000 ? initialList.slice(initialList.length - 3000) : initialList);
          }
        } else if (msg.type === 'log') {
          if (msg.data.text && msg.data.text.trim()) {
            appendLog(msg.data.text, msg.data.stream, msg.data.timestamp);
          }
        } else if (msg.type === 'logs') {
          // Throttled batch of logs
          if (Array.isArray(msg.data) && msg.data.length > 0) {
            appendLogsBatch(msg.data);
          }
        } else if (msg.type === 'status') {
          setCurrentStatus(msg.data.status);
          refreshInstance();
        } else if (msg.type === 'metrics') {
          if (msg.data) {
            setUsage(msg.data);
          }
        } else if (msg.type === 'error') {
          appendLog(`\x1b[31m[Hiba] ${msg.message}\x1b[0m`, 'stderr');
        }
      } catch {
        if (event.data && typeof event.data === 'string' && event.data.trim()) {
          appendLog(event.data);
        }
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      appendLog('\x1b[90m[MCSPanel] Konzol kapcsolat lezárva.\x1b[0m');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [instanceId, appendLog, refreshInstance]);

  // Send Command Handler
  const handleSendCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', command: trimmed }));
    } else {
      api.sendCommand(instanceId, trimmed).catch((err) => {
        appendLog(`\x1b[31m[Hiba] ${err.message}\x1b[0m`, 'stderr');
      });
    }
  };

  const handleAction = async (actionFn: () => Promise<any>) => {
    setActionLoading(true);
    try {
      await actionFn();
      await refreshInstance();
    } catch (e: any) {
      await alert(e.message || 'Hiba a művelet végrehajtásakor', 'Hiba történt', { variant: 'danger' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!instance) return;
    const confirmed = await confirm(
      `Biztosan törölni szeretnéd a(z) "${instance.name}" szervert az MCSPanelből?\n\n(A szerver fájljai a mappában megmaradnak, csak a panelből kerül eltávolításra).`,
      'Szerver törlése',
      { confirmText: 'Szerver törlése', variant: 'danger' }
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await api.deleteInstance(instanceId);
      onBack();
    } catch (e: any) {
      await alert(e.message || 'Nem sikerült törölni a szervert', 'Hiba történt', { variant: 'danger' });
      setActionLoading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNameInput.trim();
    if (!trimmed) {
      await alert('A szerver neve nem lehet üres!', 'Figyelem', { variant: 'warning' });
      return;
    }
    if (trimmed === instance?.name) {
      setIsRenameModalOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await api.updateInstance(instanceId, { name: trimmed });
      setInstance(res.instance);
      setIsRenameModalOpen(false);
      await alert('A szerver sikeresen átnevezve!', 'Sikeres módosítás', { variant: 'success' });
    } catch (e: any) {
      await alert(e.message || 'Nem sikerült átnevezni a szervert', 'Hiba történt', { variant: 'danger' });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleToggleAutoRestart = async () => {
    const nextVal = !autoRestart;
    setAutoRestart(nextVal);
    setIsUpdatingConfig(true);
    try {
      await api.updateInstance(instanceId, { autoRestart: nextVal });
    } catch (e: any) {
      setAutoRestart(!nextVal);
      await alert(e.message || 'Nem sikerült elmenteni a beállítást', 'Hiba történt', { variant: 'danger' });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleToggleStartOnBoot = async () => {
    const nextVal = !startOnBoot;
    setStartOnBoot(nextVal);
    setIsUpdatingConfig(true);
    try {
      await api.updateInstance(instanceId, { startOnBoot: nextVal });
    } catch (e: any) {
      setStartOnBoot(!nextVal);
      await alert(e.message || 'Nem sikerült elmenteni a beállítást', 'Hiba történt', { variant: 'danger' });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Toggle single user permission
  const handleToggleUserPermission = async (userId: string, permKey: string) => {
    const target = instanceUsers.find((u) => u.id === userId);
    if (!target) return;
    const currentVal = target.permissions ? !!(target.permissions as any)[permKey] : false;
    const nextVal = !currentVal;

    try {
      const res = await api.setUserPermissions(userId, instanceId, {
        [permKey]: nextVal
      });

      setInstanceUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: res.permission } : u))
      );
    } catch (e: any) {
      await alert(e.message || 'Hiba a jogosultság mentésekor', 'Hiba történt', { variant: 'danger' });
    }
  };

  // Grant all permissions to a user
  const handleGrantAll = async (userId: string) => {
    try {
      const res = await api.setUserPermissions(userId, instanceId, {
        canViewConsole: true,
        canSendCommands: true,
        canStart: true,
        canStop: true,
        canRestart: true,
        canKill: true
      });
      setInstanceUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: res.permission } : u))
      );
    } catch (e: any) {
      await alert(e.message || 'Hiba a jogosultságok megadásakor', 'Hiba történt', { variant: 'danger' });
    }
  };

  // Revoke all access for a user
  const handleRevokeUser = async (userId: string) => {
    try {
      await api.revokeUserPermissions(userId, instanceId);
      setInstanceUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: null } : u))
      );
    } catch (e: any) {
      await alert(e.message || 'Hiba a jogosultság visszavonásakor', 'Hiba történt', { variant: 'danger' });
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Még nem volt';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusInfo = (status: ServerStatus) => {
    switch (status) {
      case 'RUNNING':
        return {
          label: 'Online',
          className: 'text-emerald-400 font-semibold',
          dotClass: 'bg-emerald-400 animate-pulse'
        };
      case 'STARTING':
        return {
          label: 'Indulás...',
          className: 'text-amber-400 font-semibold',
          dotClass: 'bg-amber-400 animate-ping'
        };
      case 'STOPPING':
        return {
          label: 'Leállítás...',
          className: 'text-rose-400 font-semibold',
          dotClass: 'bg-rose-400'
        };
      case 'CRASHED':
        return {
          label: 'Hiba / Crash',
          className: 'text-red-400 font-semibold',
          dotClass: 'bg-red-400'
        };
      case 'OFFLINE':
      default:
        return {
          label: 'Offline',
          className: 'text-neutral-400 font-medium',
          dotClass: 'bg-neutral-600'
        };
    }
  };

  const perms = instance?.permissions;
  const isOnline = currentStatus === 'RUNNING';
  const statusInfo = getStatusInfo(currentStatus);

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] max-w-7xl mx-auto px-3 py-3 sm:p-6 pb-24 sm:pb-8 space-y-3.5 sm:space-y-4">
      {/* 1. TOP HEADER & ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-md-container p-3 sm:px-4 sm:py-3.5 rounded-2xl border border-md-outlineVariant/50 shadow-md">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0 mt-0.5 sm:mt-0"
            title="Vissza a szervereimhez"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
              <h1 className="text-base sm:text-lg font-bold text-white truncate max-w-[220px] sm:max-w-none">
                {instance?.name || 'Szerver betöltése...'}
              </h1>
              {currentUser?.isAdmin && instance && (
                <button
                  type="button"
                  onClick={() => {
                    setNewNameInput(instance.name);
                    setIsRenameModalOpen(true);
                  }}
                  title="Szerver átnevezése"
                  className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-neutral-400 font-mono bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                <Network className="w-3 h-3 text-neutral-400" />
                :{instance?.port || 25565}
              </span>
              {(usage.version || instance?.version) && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-300 font-medium bg-neutral-900 px-2.5 py-0.5 rounded-md border border-neutral-800" title={`Verzió: ${usage.version || instance?.version}`}>
                  <Layers className="w-3 h-3 text-neutral-400" />
                  <span>{usage.version || instance?.version}</span>
                </span>
              )}
              {isOnline && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-800/60">
                  <Users className="w-3 h-3" />
                  <span>{usage.players?.online || 0} online</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-400 mt-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-neutral-300">
                <span>Állapot:</span>
                <span className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                  <span className={statusInfo.className}>{statusInfo.label}</span>
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400' : 'bg-neutral-500'
                  }`}
                />
                {isConnected ? 'Élő kapcsolat' : 'Kapcsolódás...'}
              </span>
            </div>
          </div>
        </div>

        {/* Server Control Buttons (Responsive on mobile) */}
        <div className="flex items-center gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-neutral-800/80">
          {!isOnline && currentStatus !== 'STARTING' && currentStatus !== 'STOPPING' && perms?.canStart && (
            <button
              disabled={actionLoading}
              onClick={() => handleAction(() => api.startInstance(instanceId))}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Indítás</span>
            </button>
          )}

          {currentStatus === 'STARTING' && (
            <div className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/50 select-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Indulás folyamatban...</span>
            </div>
          )}

          {currentStatus === 'STOPPING' && (
            <div className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 text-rose-300 border border-rose-800/50 select-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              <span>Leállítás folyamatban...</span>
            </div>
          )}

          {isOnline && perms?.canStop && (
            <button
              disabled={actionLoading}
              onClick={() => handleAction(() => api.stopInstance(instanceId))}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Leállítás</span>
            </button>
          )}

          {isOnline && perms?.canRestart && (
            <button
              disabled={actionLoading}
              onClick={() => handleAction(() => api.restartInstance(instanceId))}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Újraindítás</span>
            </button>
          )}

          {currentStatus !== 'OFFLINE' && perms?.canKill && (
            <button
              disabled={actionLoading}
              onClick={async () => {
                const confirmed = await confirm(
                  'Biztosan kényszerítve leállítod a folyamatot? (Nem mentett világadatok veszhetnek el)',
                  'Kényszerített leállítás',
                  { confirmText: 'Folyamat leállítása (Kill)', variant: 'danger' }
                );
                if (confirmed) {
                  handleAction(() => api.killInstance(instanceId));
                }
              }}
              title="Kényszerített leállítás (Kill)"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800 hover:bg-red-900 active:scale-95 transition-all disabled:opacity-50"
            >
              <Skull className="w-3.5 h-3.5" />
              <span>Kill</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MODERN NATIVE CONSOLE VIEWER (DIRECTLY UNDER HEADER) */}
      <ConsoleViewer
        logs={logs}
        onSendCommand={handleSendCommand}
        isOnline={isOnline}
        serverStatus={currentStatus}
        canSendCommands={perms?.canSendCommands}
        onClear={() => setLogs([])}
        serverName={instance?.name}
      />

      {/* 3. METRICS & INSTANCE INFO GRID (UNDER THE CONSOLE) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Metric 1: Online Players */}
        <div className="bg-md-container p-3 sm:p-3.5 rounded-xl border border-md-outlineVariant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Játékosok</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-bold font-mono text-white">
              {isOnline ? `${usage.players?.online || 0} / ${usage.players?.max || 20}` : '0 / 20'}
            </div>
            {isOnline && usage.players?.names && usage.players.names.length > 0 && (
              <div className="text-[10px] text-neutral-400 truncate mt-0.5" title={usage.players.names.join(', ')}>
                {usage.players.names.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: RAM Usage */}
        <div className="bg-md-container p-3 sm:p-3.5 rounded-xl border border-md-outlineVariant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Memória (RAM)</span>
            <HardDrive className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-bold font-mono text-white">
              {isOnline ? usage.memoryFormatted : '0 MB'}
            </div>
            {isOnline && usage.jvmHeap && (
              <div className="text-[10px] text-neutral-400 truncate mt-0.5" title={`JVM Heap: ${usage.jvmHeap.usedFormatted} / ${usage.jvmHeap.maxFormatted}`}>
                Heap: {usage.jvmHeap.usedFormatted} / {usage.jvmHeap.maxFormatted}
              </div>
            )}
          </div>
        </div>

        {/* Metric 3: Version (spans 2 on mobile to fit nicely without gaps) */}
        <div className="col-span-2 sm:col-span-1 bg-md-container p-3 sm:p-3.5 rounded-xl border border-md-outlineVariant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Verzió</span>
            <Layers className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-white truncate" title={usage.version || instance?.version || 'N/A'}>
              {usage.version || instance?.version || 'N/A'}
            </div>
            <div className="text-[10px] text-neutral-400 truncate mt-0.5">
              {isOnline ? 'Aktív verzió' : 'Észlelt verzió'}
            </div>
          </div>
        </div>

        {/* Metric 5: Last Started */}
        <div className="bg-md-container p-3.5 rounded-xl border border-md-outlineVariant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Utolsó indítás</span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <div className="text-xs font-medium text-white truncate">
              {formatDate(instance?.lastStartedAt)}
            </div>
            {instance?.lastStartedBy && (
              <div className="text-[11px] text-neutral-400 truncate">
                általa: {instance.lastStartedBy}
              </div>
            )}
          </div>
        </div>

        {/* Metric 6: Last Stopped */}
        <div className="bg-md-container p-3.5 rounded-xl border border-md-outlineVariant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Utolsó leállítás</span>
            <PowerOff className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <div className="text-xs font-medium text-white truncate">
              {formatDate(instance?.lastStoppedAt)}
            </div>
            {instance?.lastStoppedBy && (
              <div className="text-[11px] text-neutral-400 truncate">
                általa: {instance.lastStoppedBy}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. SETTINGS TOGGLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-md-container p-4 rounded-xl border border-md-outlineVariant/40">
        {/* Toggle 1: Auto Restart */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <RefreshCcw className="w-3.5 h-3.5 text-neutral-300" />
              <span>Automatikus újraindítás</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Újraindítja a szervert váratlan leállás vagy crash esetén.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoRestart}
            disabled={isUpdatingConfig}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
              autoRestart ? 'bg-emerald-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                autoRestart ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Start on Boot */}
        <div className="flex items-center justify-between gap-3 border-t sm:border-t-0 sm:border-l border-neutral-800 pt-3 sm:pt-0 sm:pl-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Zap className="w-3.5 h-3.5 text-neutral-300" />
              <span>Indítás a panel indulásakor</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Automatikusan elindul, amikor az MCSPanel elstartol.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleStartOnBoot}
            disabled={isUpdatingConfig}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
              startOnBoot ? 'bg-emerald-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                startOnBoot ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 5. USER ACCESS & PERMISSIONS (MANAGED DIRECTLY ON THE INSTANCE PAGE - ADMIN ONLY) */}
      {currentUser?.isAdmin && (
        <div className="bg-md-container rounded-2xl border border-md-outlineVariant/40 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Felhasználói hozzáférések ehhez a szerverhez</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Kezeld, hogy a vezérlőpult felhasználói indíthatják-e, leállíthatják-e ezt a szervert, vagy láthatják-e a konzolt.
              </p>
            </div>
            {loadingUsers && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
          </div>

          <div className="space-y-3 pt-1">
            {instanceUsers.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3 text-center">Nincsenek további felhasználók a rendszerben.</p>
            ) : (
              instanceUsers.map((u) => {
                const p = u.permissions;
                const hasAny = !!p && Object.entries(p).some(([k, v]) => k.startsWith('can') && v === true);

                return (
                  <div
                    key={u.id}
                    className="bg-[#121316] rounded-xl p-3.5 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-white text-xs border border-neutral-700">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-semibold text-white">{u.username}</span>
                          {u.isAdmin ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-md border border-red-800/60">
                              Admin
                            </span>
                          ) : (
                            hasAny && (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded-md border border-emerald-800/50">
                                Hozzáférés aktív
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {u.isAdmin ? (
                      <div className="text-xs text-neutral-400 italic">
                        Az adminisztrátorok automatikusan minden művelethez hozzáférnek.
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                          {[
                            { key: 'canStart', label: 'Indítás' },
                            { key: 'canStop', label: 'Leállítás' },
                            { key: 'canRestart', label: 'Újraindítás' },
                            { key: 'canKill', label: 'Kill' },
                            { key: 'canViewConsole', label: 'Konzol' },
                            { key: 'canSendCommands', label: 'Parancsok' }
                          ].map(({ key, label }) => {
                            const isActive = p ? !!(p as any)[key] : false;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleToggleUserPermission(u.id, key)}
                                className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  isActive
                                    ? 'bg-neutral-200 text-neutral-900 border-white font-semibold shadow-xs'
                                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                                }`}
                              >
                                {isActive && <Check className="w-3 h-3 text-neutral-900 stroke-[3]" />}
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1.5 sm:pt-0 sm:pl-2 sm:border-l border-neutral-800/80">
                          <button
                            type="button"
                            onClick={() => handleGrantAll(u.id)}
                            className="flex-1 sm:flex-initial px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-center"
                          >
                            Összes
                          </button>
                          {hasAny && (
                            <button
                              type="button"
                              onClick={() => handleRevokeUser(u.id)}
                              className="flex-1 sm:flex-initial px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 rounded-lg border border-rose-900/40 transition-colors text-center"
                            >
                              Törlés
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 6. INSTANCE SETTINGS & MANAGEMENT (ADMIN ONLY) */}
      {currentUser?.isAdmin && (
        <div className="bg-md-container rounded-2xl border border-md-outlineVariant/40 p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-neutral-400" />
              <span>Szerver beállítások és kezelés</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Itt módosíthatod a szerver nevét a panelben, vagy szükség esetén eltávolíthatod a nyilvántartásból.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Rename Server Card */}
            <div className="bg-[#121316] rounded-xl p-4 border border-neutral-800/80 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-white font-semibold text-xs sm:text-sm">
                  <Pencil className="w-4 h-4 text-neutral-300" />
                  <span>Szerver átnevezése</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Módosítsd a szerver megjelenített nevét az MCSPanel felületén.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewNameInput(instance?.name || '');
                  setIsRenameModalOpen(true);
                }}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white transition-colors w-full sm:w-auto self-start"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Átnevezés</span>
              </button>
            </div>

            {/* Delete Server Card */}
            <div className="bg-[#121316] rounded-xl p-4 border border-rose-950/40 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs sm:text-sm">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Szerver törlése a panelből</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Eltávolítja a szervert az MCSPanelből. A szerver mappája és fájljai nem törlődnek a lemezről.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDeleteInstance}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-950/40 text-rose-300 hover:text-white hover:bg-rose-950/80 border border-rose-900/60 active:scale-95 transition-all w-full sm:w-auto self-start disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Szerver törlése</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      <Modal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        className="bg-md-container w-full max-w-md rounded-2xl border border-md-outlineVariant shadow-2xl p-6"
      >
        <form onSubmit={handleRenameSubmit}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Szerver átnevezése</h3>
              <p className="text-xs text-neutral-400">Add meg a szerver új megjelenített nevét.</p>
            </div>
          </div>

          <div className="space-y-3 my-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Szerver új neve
              </label>
              <input
                type="text"
                autoFocus
                required
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                placeholder="pl. SMP Túlélő 1.20"
                className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsRenameModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isRenaming || !newNameInput.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-neutral-200 text-neutral-900 transition-all disabled:opacity-50"
            >
              {isRenaming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Mentés</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
