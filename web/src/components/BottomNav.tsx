import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, Users, LogOut } from 'lucide-react';

import { Instance } from '../types';

interface BottomNavProps {
  currentTab: 'servers' | 'users';
  onTabChange: (tab: 'servers' | 'users') => void;
  onSelectServer?: (server: Instance | null) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, onSelectServer }) => {
  const { user, logout } = useAuth();

  const handleNav = (tab: 'servers' | 'users') => {
    if (onSelectServer) onSelectServer(null);
    onTabChange(tab);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-md-containerLow/95 backdrop-blur-lg border-t border-md-outlineVariant/70 px-4 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      <button
        onClick={() => handleNav('servers')}
        className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-all ${
          currentTab === 'servers'
            ? 'text-white font-semibold'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <div
          className={`p-1 rounded-full ${
            currentTab === 'servers' ? 'bg-neutral-200 text-neutral-900' : ''
          }`}
        >
          <Server className="w-5 h-5" />
        </div>
        <span className="text-[11px]">Szerverek</span>
      </button>

      {user?.isAdmin && (
        <button
          onClick={() => handleNav('users')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-all ${
            currentTab === 'users'
              ? 'text-white font-semibold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              currentTab === 'users' ? 'bg-neutral-200 text-neutral-900' : ''
            }`}
          >
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Felhasználók</span>
        </button>
      )}

      <button
        onClick={logout}
        className="flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-neutral-400 hover:text-neutral-200 transition-all"
      >
        <div className="p-1">
          <LogOut className="w-5 h-5" />
        </div>
        <span className="text-[11px]">Kilépés</span>
      </button>
    </nav>
  );
};
