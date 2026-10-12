import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, Users, LogOut, Terminal } from 'lucide-react';

import { Instance } from '../types';

interface NavbarProps {
  currentTab: 'servers' | 'users';
  onTabChange: (tab: 'servers' | 'users') => void;
  onSelectServer?: (server: Instance | null) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onSelectServer }) => {
  const { user, logout } = useAuth();

  const handleNav = (tab: 'servers' | 'users') => {
    if (onSelectServer) onSelectServer(null);
    onTabChange(tab);
  };

  return (
    <header className="sticky top-0 z-40 bg-md-containerLow/80 backdrop-blur-md border-b border-md-outlineVariant/60 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => handleNav('servers')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-lg bg-[#1e2025] flex items-center justify-center text-white border border-neutral-800 group-hover:border-neutral-600 transition-all shadow-sm">
            <Terminal className="w-5 h-5 text-neutral-200" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg text-white">MCSPanel</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-2">
          <button
            onClick={() => handleNav('servers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'servers'
                ? 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Szerverek</span>
          </button>

          {user?.isAdmin && (
            <button
              onClick={() => handleNav('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'users'
                  ? 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm'
                  : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Felhasználók</span>
            </button>
          )}
        </nav>

        {/* User profile & actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-neutral-200">{user?.username}</span>
              {user?.isAdmin && (
                <span className="text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-md border border-red-800/60">
                  Admin
                </span>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            title="Kijelentkezés"
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
