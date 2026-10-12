import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export const SetupPage: React.FC = () => {
  const { initSetup } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 3) {
      setError('A jelszónak legalább 3 karakter hosszúnak kell lennie!');
      return;
    }

    if (password !== confirmPassword) {
      setError('A két jelszó nem egyezik meg!');
      return;
    }

    setIsLoading(true);
    try {
      await initSetup(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Hiba történt a beállítás során!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-md-surface via-md-surfaceDim to-black">
      <div className="w-full max-w-md bg-md-container rounded-2xl p-8 border border-md-outlineVariant/60 shadow-2xl relative overflow-hidden">
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-600 via-neutral-300 to-neutral-600" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-md-containerHighest border border-neutral-700 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-8 h-8 text-neutral-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">MCSPanel telepítés</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Üdvözlünk! Hozd létre az elsődleges adminisztrátori fiókodat a vezérlőpult használatához.
          </p>
        </div>

        {/* Info box */}
        <div className="mb-5 p-3 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-neutral-300 shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-400 leading-relaxed">
            Ez lesz a fő rendszergazda fiókod. Ezzel tudsz majd szervereket hozzáadni és új felhasználókat kezelni.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Admin felhasználónév
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white focus:outline-none focus:border-neutral-300 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Mester jelszó
            </label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Legalább 3 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={3}
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Jelszó megerősítése
            </label>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Ismételd meg a jelszót"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-lg font-semibold text-sm bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <span>{isLoading ? 'Létrehozás folyamatban...' : 'Admin fiók létrehozása'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
