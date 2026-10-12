import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { InstancePage } from './pages/InstancePage';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Loader2 } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, isLoading, setupRequired } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  // Sync state with browser popstate (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-md-surface text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <span className="text-xs font-medium tracking-wider uppercase text-neutral-400">
            MCSPanel betöltése...
          </span>
        </div>
      </div>
    );
  }

  // 1. Initial Setup Wizard if no admin exists
  if (setupRequired) {
    return <SetupPage />;
  }

  // 2. Login Page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // 3. Dedicated Server Instance View (/servers/:id or /instances/:id)
  const serverMatch = currentPath.match(/^\/(?:servers|instances)\/([a-zA-Z0-9_-]+)/);
  if (serverMatch) {
    const instanceId = serverMatch[1];
    return (
      <div className="min-h-screen bg-md-surface pb-16 md:pb-0 flex flex-col">
        <Navbar
          currentTab="servers"
          onTabChange={(tab) => navigate(tab === 'users' ? '/users' : '/')}
        />
        <main className="flex-1">
          <InstancePage
            instanceId={instanceId}
            onBack={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  // 4. Main App (Dashboard or Users tabs)
  const currentTab = currentPath.startsWith('/users') ? 'users' : 'servers';

  return (
    <div className="min-h-screen bg-md-surface pb-20 md:pb-8 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => navigate(tab === 'users' ? '/users' : '/')}
      />

      <main className="flex-1">
        {currentTab === 'servers' && (
          <DashboardPage onSelectServer={(inst) => navigate(`/servers/${inst.id}`)} />
        )}
        {currentTab === 'users' && user.isAdmin && <UsersPage />}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => navigate(tab === 'users' ? '/users' : '/')}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};
