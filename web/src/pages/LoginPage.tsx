import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Terminal, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) return;

    setIsLoading(true);
    try {
      await login(trimmedUsername, password);

      // Prompt browser to save credentials via the W3C Credential Management API
      if (typeof window !== 'undefined' && 'PasswordCredential' in window) {
        try {
          const cred = new (window as any).PasswordCredential({
            id: trimmedUsername,
            password: password,
            name: trimmedUsername
          });
          if (navigator.credentials && navigator.credentials.store) {
            await navigator.credentials.store(cred);
          }
        } catch {
          // Ignore if blocked or unsupported by browser context
        }
      }
    } catch (err: any) {
      setError(err.message || 'Sikertelen bejelentkezés!');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-md-surface via-md-surfaceDim to-black">
      {/* Hidden iframe target for native form submission signaling */}
      <iframe name="login-sink" id="login-sink" style={{ display: 'none' }} title="login-sink" />

      <div className="w-full max-w-sm bg-md-container rounded-2xl p-8 border border-md-outlineVariant/60 shadow-2xl relative overflow-hidden">
        {/* Top subtle border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-600 via-neutral-300 to-neutral-600" />

        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-md-containerHighest border border-neutral-700 flex items-center justify-center text-white shadow-md">
            <Terminal className="w-6 h-6 text-neutral-200" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">MCSPanel</h1>
          <p className="text-xs text-neutral-400 mt-1">Jelentkezz be a szervereid kezeléséhez</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        <form
          id="login-form"
          name="login"
          method="post"
          action="javascript:void(0)"
          target="login-sink"
          autoComplete="off"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Felhasználónév
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Felhasználónév"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
              <span>Jelszó</span>
              <Lock className="w-3.5 h-3.5 text-neutral-500" />
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Jelszó"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                title={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-lg font-semibold text-sm bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <span>{isLoading ? 'Bejelentkezés...' : 'Bejelentkezés'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
