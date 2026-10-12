import React, { useEffect, useState } from 'react';
import { Instance } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ServerCard } from '../components/ServerCard';
import { AddServerModal } from '../components/AddServerModal';
import { Plus, RefreshCw, Layers } from 'lucide-react';

interface DashboardPageProps {
  onSelectServer: (instance: Instance) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectServer }) => {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await api.getInstances();
      setInstances(res.instances);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Nem sikerült betölteni a szervereket.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances(true);

    // Periodic status refresh every 3 seconds
    const interval = setInterval(() => {
      fetchInstances(false);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateServer = async (data: { name: string; directoryPath: string; startFile?: string }) => {
    await api.createInstance(data);
    await fetchInstances(false);
  };

  const handleStart = async (id: string) => {
    await api.startInstance(id);
    await fetchInstances(false);
  };

  const handleStop = async (id: string) => {
    await api.stopInstance(id);
    await fetchInstances(false);
  };

  const handleRestart = async (id: string) => {
    await api.restartInstance(id);
    await fetchInstances(false);
  };

  const onlineCount = instances.filter((i) => i.status === 'RUNNING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Banner / Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-md-container rounded-2xl p-6 border border-md-outlineVariant/50 shadow-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Szervereim</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
              {instances.length} db
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Kezeld, indítsd el és figyeld a helyi Minecraft szervereid működését valós időben.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-neutral-300 font-medium">Futó:</span>
            <span className="font-bold text-white font-mono">{onlineCount}</span>
          </div>

          <button
            onClick={() => fetchInstances(true)}
            title="Frissítés"
            className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {user?.isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Szerver hozzáadása</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Grid of Servers */}
      {instances.length === 0 && !isLoading ? (
        <div className="text-center py-16 px-4 bg-md-containerLow rounded-2xl border border-md-outlineVariant/40 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-xl bg-md-containerHighest flex items-center justify-center text-neutral-400 mb-4 border border-neutral-800">
            <Layers className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-base font-bold text-white">Még nincs hozzáadva egyetlen szerver sem</h3>
          <p className="text-xs text-neutral-400 max-w-sm mt-1.5 mb-6">
            Hozz létre egy Minecraft szervert a számítógépeden, majd add hozzá a könyvtárának megadásával.
          </p>
          {user?.isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Első szerver hozzáadása</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {instances.map((inst) => (
            <ServerCard
              key={inst.id}
              instance={inst}
              onClick={onSelectServer}
              onStart={handleStart}
              onStop={handleStop}
              onRestart={handleRestart}
            />
          ))}
        </div>
      )}

      {/* Add Server Modal */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateServer}
      />
    </div>
  );
};
