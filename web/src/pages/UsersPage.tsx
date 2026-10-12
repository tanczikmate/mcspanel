import React, { useEffect, useState } from 'react';
import { User, Instance, Permission } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { Modal } from '../components/Modal';
import {
  UserPlus,
  Trash2,
  Server,
  Check,
  X,
  Sliders,
  Loader2,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { alert, confirm } = useDialog();

  const [users, setUsers] = useState<User[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add user modal state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Password change modal state
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Permission editor modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);

  const fetchUsersAndInstances = async () => {
    setIsLoading(true);
    try {
      const [uRes, iRes] = await Promise.all([api.getUsers(), api.getInstances()]);
      setUsers(uRes.users);
      setInstances(iRes.instances);
    } catch (e: any) {
      await alert(e.message || 'Hiba az adatok betöltésekor', 'Hiba történt', { variant: 'danger' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndInstances();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 3) {
      await alert('A jelszónak legalább 3 karakter hosszúnak kell lennie!', 'Figyelem', { variant: 'warning' });
      return;
    }
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        isAdmin: newIsAdmin
      });
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      setIsAddUserOpen(false);
      await fetchUsersAndInstances();
      await alert('Felhasználó sikeresen létrehozva!', 'Sikeres művelet', { variant: 'success' });
    } catch (e: any) {
      await alert(e.message || 'Nem sikerült létrehozni a felhasználót', 'Hiba történt', { variant: 'danger' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (changePasswordVal.length < 3) {
      await alert('A jelszónak legalább 3 karakter hosszúnak kell lennie!', 'Figyelem', { variant: 'warning' });
      return;
    }

    setPasswordLoading(true);
    try {
      await api.updateUser(passwordUser.id, { password: changePasswordVal });
      await alert(`A(z) ${passwordUser.username} felhasználó jelszava sikeresen módosítva!`, 'Sikeres módosítás', { variant: 'success' });
      setPasswordUser(null);
      setChangePasswordVal('');
    } catch (e: any) {
      await alert(e.message || 'Hiba a jelszó módosításakor', 'Hiba történt', { variant: 'danger' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    const confirmed = await confirm(
      `Biztosan törölni szeretnéd a(z) "${targetUser.username}" felhasználót a rendszerből?`,
      'Felhasználó törlése',
      { confirmText: 'Felhasználó törlése', variant: 'danger' }
    );
    if (!confirmed) return;

    try {
      await api.deleteUser(targetUser.id);
      await fetchUsersAndInstances();
    } catch (e: any) {
      await alert(e.message || 'Nem sikerült törölni a felhasználót', 'Hiba történt', { variant: 'danger' });
    }
  };

  const openPermissionManager = async (targetUser: User) => {
    setSelectedUser(targetUser);
    try {
      const res = await api.getUserPermissions(targetUser.id);
      setUserPermissions(res.permissions);
      setIsPermModalOpen(true);
    } catch (e: any) {
      await alert(e.message || 'Hiba a jogosultságok lekérdezésekor', 'Hiba történt', { variant: 'danger' });
    }
  };

  const togglePermission = async (
    instanceId: string,
    permKey: keyof Omit<Permission, 'id' | 'userId' | 'instanceId' | 'instanceName' | 'createdAt'>
  ) => {
    if (!selectedUser) return;

    const existing = userPermissions.find((p) => p.instanceId === instanceId);
    const currentValue = existing ? existing[permKey] : false;
    const newValue = !currentValue;

    try {
      const updated = await api.setUserPermissions(selectedUser.id, instanceId, {
        [permKey]: newValue
      });

      setUserPermissions((prev) => {
        const idx = prev.findIndex((p) => p.instanceId === instanceId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updated.permission;
          return next;
        }
        return [...prev, updated.permission];
      });
    } catch (e: any) {
      await alert(e.message || 'Hiba a jogosultság mentésekor', 'Hiba történt', { variant: 'danger' });
    }
  };

  const handleRevokeAll = async (instanceId: string) => {
    if (!selectedUser) return;
    try {
      await api.revokeUserPermissions(selectedUser.id, instanceId);
      setUserPermissions((prev) => prev.filter((p) => p.instanceId !== instanceId));
    } catch (e: any) {
      await alert(e.message || 'Hiba a jog visszavonásakor', 'Hiba történt', { variant: 'danger' });
    }
  };

  const formatLastLogin = (dateStr?: string | null) => {
    if (!dateStr) return 'Még nem lépett be';
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
      return 'Még nem lépett be';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-md-container rounded-2xl p-5 sm:p-6 border border-md-outlineVariant/50 shadow-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Felhasználók és hozzáférések</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
              {users.length} fiók
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Kezeld a felhasználói fiókokat, jelszavakat és jogosultságokat. A részletes szerver-hozzáférések közvetlenül az egyes szerverek oldalán is beállíthatók.
          </p>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all shadow-md shrink-0 w-full sm:w-auto justify-center"
        >
          <UserPlus className="w-4 h-4" />
          <span>Új felhasználó</span>
        </button>
      </div>

      {/* MOBILE VIEW: Responsive Cards (No horizontal scroll needed) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-md-container rounded-2xl border border-md-outlineVariant/50 p-8 text-center text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-white" />
            <span>Betöltés...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-md-container rounded-2xl border border-md-outlineVariant/50 p-8 text-center text-neutral-400">
            Nincsenek felhasználók.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="bg-md-container rounded-2xl border border-md-outlineVariant/50 p-4 space-y-3 shadow-md"
            >
              {/* Header row: avatar, username + admin badge, delete button */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-white text-xs border border-neutral-700 shrink-0">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="font-semibold text-white truncate text-sm">{u.username}</span>
                    {u.isAdmin && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-800/60 shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                {u.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDeleteUser(u)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/60 transition-colors shrink-0"
                    title="Felhasználó törlése"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-md-outlineVariant/30">
                <div>
                  <span className="text-neutral-500 block text-[11px] mb-0.5">Létrehozva</span>
                  <span className="text-neutral-300 font-medium">
                    {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px] mb-0.5">Utolsó belépés</span>
                  <span className={u.lastLoginAt ? 'text-neutral-300 font-medium' : 'text-neutral-500 italic'}>
                    {formatLastLogin(u.lastLoginAt)}
                  </span>
                </div>
              </div>

              {/* Actions buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-md-outlineVariant/30">
                <button
                  onClick={() => {
                    setPasswordUser(u);
                    setChangePasswordVal('');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Jelszó</span>
                </button>

                {!u.isAdmin && (
                  <button
                    onClick={() => openPermissionManager(u)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Jogok</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP VIEW: Clean Table */}
      <div className="hidden md:block bg-md-container rounded-2xl border border-md-outlineVariant/50 overflow-hidden shadow-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#131417] text-neutral-400 text-xs uppercase tracking-wider border-b border-md-outlineVariant/40">
            <tr>
              <th className="px-6 py-3.5">Felhasználó</th>
              <th className="px-6 py-3.5">Létrehozva</th>
              <th className="px-6 py-3.5">Utolsó belépés</th>
              <th className="px-6 py-3.5 text-right">Műveletek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-md-outlineVariant/30">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-white" />
                  <span>Betöltés...</span>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-neutral-400">
                  Nincsenek felhasználók.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-800/40 transition-colors">
                  {/* Felhasználó + Admin Badge ha admin */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-white text-xs border border-neutral-700 shrink-0">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{u.username}</span>
                        {u.isAdmin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-800/60">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Létrehozva */}
                  <td className="px-6 py-4 text-xs text-neutral-400">
                    {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                  </td>

                  {/* Utolsó belépés */}
                  <td className="px-6 py-4 text-xs">
                    <span className={u.lastLoginAt ? 'text-neutral-300' : 'text-neutral-500 italic'}>
                      {formatLastLogin(u.lastLoginAt)}
                    </span>
                  </td>

                  {/* Műveletek */}
                  <td className="px-6 py-4 text-right space-x-1.5">
                    {/* Change Password button */}
                    <button
                      onClick={() => {
                        setPasswordUser(u);
                        setChangePasswordVal('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                      title="Jelszó módosítása"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Jelszó</span>
                    </button>

                    {/* Permissions button for non-admin */}
                    {!u.isAdmin && (
                      <button
                        onClick={() => openPermissionManager(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                        title="Szerver jogosultságok"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Jogok</span>
                      </button>
                    )}

                    {/* Delete user button */}
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/60 transition-colors inline-flex items-center"
                        title="Felhasználó törlése"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={!!passwordUser}
        onClose={() => setPasswordUser(null)}
        className="bg-md-container w-full max-w-md rounded-2xl border border-md-outlineVariant shadow-2xl overflow-hidden p-6"
      >
        {passwordUser && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Jelszó módosítása: {passwordUser.username}</span>
              </h3>
              <button
                onClick={() => setPasswordUser(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Új jelszó</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Legalább 3 karakter"
                    value={changePasswordVal}
                    onChange={(e) => setChangePasswordVal(e.target.value)}
                    required
                    minLength={3}
                    autoFocus
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white focus:outline-none focus:border-neutral-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  A mentés után a felhasználó azonnal az új jelszavával tud majd belépni.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-md-outlineVariant/30">
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="px-4 py-2 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading || changePasswordVal.length < 3}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-40 transition-colors"
                >
                  {passwordLoading ? 'Mentés...' : 'Jelszó mentése'}
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        className="bg-md-container w-full max-w-md rounded-2xl border border-md-outlineVariant shadow-2xl overflow-hidden p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Új felhasználó létrehozása</h3>
          <button
            onClick={() => setIsAddUserOpen(false)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Felhasználónév</label>
            <input
              type="text"
              placeholder="pl. moderator1"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              minLength={3}
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white focus:outline-none focus:border-neutral-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Jelszó</label>
            <input
              type="password"
              placeholder="Legalább 3 karakter"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={3}
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant text-sm text-white focus:outline-none focus:border-neutral-300"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isAdminCheckbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-neutral-200 focus:ring-0"
            />
            <label htmlFor="isAdminCheckbox" className="text-xs text-neutral-300 select-none">
              Adminisztrátori jogosultság (minden szerverhez teljes hozzáférés)
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-md-outlineVariant/30">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="px-4 py-2 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-900 hover:bg-white transition-colors"
            >
              Létrehozás
            </button>
          </div>
        </form>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={isPermModalOpen && !!selectedUser}
        onClose={() => setIsPermModalOpen(false)}
        className="bg-md-container w-full max-w-3xl rounded-2xl border border-md-outlineVariant shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {selectedUser && (
          <>
            <div className="px-6 py-4 border-b border-md-outlineVariant/40 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Jogosultságok:</span>
                  <span className="text-neutral-300 font-mono">{selectedUser.username}</span>
                </h3>
                <p className="text-xs text-neutral-400">Jelöld be, hogy melyik szerverhez mihez férhet hozzá.</p>
              </div>
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {instances.length === 0 ? (
                <p className="text-xs text-neutral-400">Még nincs létrehozott szerver a rendszerben.</p>
              ) : (
                instances.map((inst) => {
                  const perm = userPermissions.find((p) => p.instanceId === inst.id);
                  const hasAccess = !!perm;

                  return (
                    <div
                      key={inst.id}
                      className="bg-md-containerLowest rounded-xl p-4 border border-md-outlineVariant/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-neutral-300" />
                          <h4 className="text-sm font-bold text-white">{inst.name}</h4>
                          <span className="text-[11px] font-mono text-neutral-400">:{inst.port}</span>
                        </div>
                        {hasAccess && (
                          <button
                            onClick={() => handleRevokeAll(inst.id)}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Hozzáférés visszavonása
                          </button>
                        )}
                      </div>

                      {/* Permissions toggles */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-md-outlineVariant/30">
                        {[
                          { key: 'canViewConsole', label: 'Konzol olvasása' },
                          { key: 'canSendCommands', label: 'Parancsküldés' },
                          { key: 'canStart', label: 'Indítás' },
                          { key: 'canStop', label: 'Leállítás' },
                          { key: 'canRestart', label: 'Újraindítás' },
                          { key: 'canKill', label: 'Kényszerített leállítás (kill)' }
                        ].map(({ key, label }) => {
                          const isActive = perm ? !!(perm as any)[key] : false;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => togglePermission(inst.id, key as any)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                isActive
                                  ? 'bg-neutral-800 border-neutral-600 text-white shadow-sm'
                                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              <span>{label}</span>
                              {isActive ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-neutral-700" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 border-t border-md-outlineVariant/30 text-right">
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-900 hover:bg-white transition-colors"
              >
                Kész
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};
