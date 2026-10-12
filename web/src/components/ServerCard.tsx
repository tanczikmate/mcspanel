import React, { useState } from 'react';
import { Instance } from '../types';
import { useDialog } from '../context/DialogContext';
import { Play, Square, RotateCw, Folder, Network, ChevronRight, HardDrive, Layers, Loader2 } from 'lucide-react';

interface ServerCardProps {
  instance: Instance;
  onClick: (instance: Instance) => void;
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onRestart: (id: string) => Promise<void>;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  instance,
  onClick,
  onStart,
  onStop,
  onRestart
}) => {
  const { alert } = useDialog();
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (e: React.MouseEvent, actionFn: (id: string) => Promise<void>) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await actionFn(instance.id);
    } catch (e: any) {
      await alert(e.message || 'Művelet sikertelen', 'Hiba történt', { variant: 'danger' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (instance.status) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        );
      case 'STARTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Indulás...
          </span>
        );
      case 'STOPPING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Leállítás...
          </span>
        );
      case 'CRASHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/60">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Hiba / Crash
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
            <span className="w-2 h-2 rounded-full bg-neutral-600" />
            Offline
          </span>
        );
    }
  };

  const perms = instance.permissions;
  const isOnline = instance.status === 'RUNNING';
  const isTransitioning = instance.status === 'STARTING' || instance.status === 'STOPPING';
  const displayVersion = instance.resourceUsage?.version || instance.version;

  return (
    <div
      onClick={() => onClick(instance)}
      className="group bg-md-container rounded-2xl p-5 border border-md-outlineVariant/50 hover:border-neutral-500/60 hover:bg-md-containerHigh transition-all shadow-md flex flex-col justify-between cursor-pointer active:scale-[0.99]"
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-white truncate group-hover:text-neutral-100 transition-colors flex items-center gap-2">
              <span>{instance.name}</span>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-neutral-400 font-mono bg-neutral-900/90 px-2 py-0.5 rounded-md border border-neutral-800">
                <Network className="w-3 h-3 text-neutral-400" />
                :{instance.port}
              </span>
              {displayVersion && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-300 font-medium bg-neutral-900/90 px-2 py-0.5 rounded-md border border-neutral-800" title={`Verzió: ${displayVersion}`}>
                  <Layers className="w-3 h-3 text-neutral-400" />
                  <span>{displayVersion}</span>
                </span>
              )}
              {instance.pid && (
                <span className="text-[11px] text-neutral-500 font-mono">
                  PID: {instance.pid}
                </span>
              )}
            </div>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Directory & Script info */}
        <div className="space-y-1.5 my-3 bg-md-containerLowest/70 p-3 rounded-xl border border-md-outlineVariant/30">
          <div className="flex items-center gap-2 text-xs text-neutral-400 truncate">
            <Folder className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
            <span className="truncate font-mono text-[11px] text-neutral-300" title={instance.directoryPath}>
              {instance.directoryPath}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 truncate">
            <span className="text-[11px] text-neutral-500">Indítófájl:</span>
            <span className="truncate font-mono text-[11px] text-neutral-300">
              {instance.startCommand}
            </span>
          </div>
        </div>

        {/* Resource Usage Mini Badges if Running */}
        {isOnline && instance.resourceUsage && (
          <div className="flex items-center gap-3 mb-2 text-xs text-neutral-400">
            <div className="flex items-center gap-1 bg-neutral-900/80 px-2 py-0.5 rounded-md border border-neutral-800">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-neutral-200">{instance.resourceUsage.memoryFormatted} RAM</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center justify-between gap-2 border-t border-md-outlineVariant/30">
        <div className="flex items-center gap-1.5">
          {/* Start button */}
          {(!isOnline && !isTransitioning) && perms?.canStart && (
            <button
              disabled={actionLoading}
              onClick={(e) => handleAction(e, onStart)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Indítás</span>
            </button>
          )}

          {/* Starting indicator */}
          {instance.status === 'STARTING' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300/90 bg-amber-950/40 border border-amber-900/50">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>Indulás...</span>
            </span>
          )}

          {/* Stopping indicator */}
          {instance.status === 'STOPPING' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-300/90 bg-rose-950/40 border border-rose-900/50">
              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              <span>Leállítás...</span>
            </span>
          )}

          {/* Stop button (only when server is actually RUNNING) */}
          {isOnline && perms?.canStop && (
            <button
              disabled={actionLoading}
              onClick={(e) => handleAction(e, onStop)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Leállítás</span>
            </button>
          )}

          {/* Restart button */}
          {isOnline && perms?.canRestart && (
            <button
              disabled={actionLoading}
              onClick={(e) => handleAction(e, onRestart)}
              title="Újraindítás"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-[11px] text-neutral-500 group-hover:text-neutral-400 flex items-center gap-1">
          <span>Kattints a megnyitáshoz</span>
        </div>
      </div>
    </div>
  );
};
