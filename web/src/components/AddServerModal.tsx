import React, { useState } from 'react';
import {
  X,
  Server,
  Folder,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from './Modal';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; directoryPath: string; startFile?: string }) => Promise<void>;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [directoryPath, setDirectoryPath] = useState('');
  const [startFile, setStartFile] = useState('');
  const [detectedFiles, setDetectedFiles] = useState<string[]>([]);
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [detectedVersion, setDetectedVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = async (pathToCheck = directoryPath) => {
    const trimmed = pathToCheck.trim();
    if (!trimmed) return;

    setIsChecking(true);
    setCheckMessage(null);
    setError(null);

    try {
      const res = await api.detectDirectory(trimmed);

      if (!res.exists) {
        setCheckStatus('error');
        setCheckMessage(res.message || 'A megadott mappa nem található a gépen.');
        setDetectedFiles([]);
        setDetectedPort(null);
        setDetectedVersion(null);
        return;
      }

      setDetectedFiles(res.detectedStartFiles);
      setDetectedPort(res.port);
      setDetectedVersion(res.version || null);

      if (res.selectedStartFile) {
        setStartFile(res.selectedStartFile);
        setCheckStatus('success');
        const verStr = res.version ? ` • Verzió: ${res.version}` : '';
        setCheckMessage(`Indítófájl észlelve: ${res.selectedStartFile} (Port: :${res.port}${verStr})`);
      } else {
        setStartFile('');
        setCheckStatus('warning');
        setCheckMessage(
          'Nem található indítófájl (start.bat / start.sh / run.bat / run.sh) ebben a mappában!'
        );
      }

      // Auto-populate name if empty
      if (!name.trim()) {
        const parts = trimmed.split(/[\\/]/).filter(Boolean);
        if (parts.length > 0) {
          setName(parts[parts.length - 1]);
        }
      }
    } catch (err: any) {
      setCheckStatus('error');
      setCheckMessage(err.message || 'Hiba történt a könyvtár ellenőrzésekor.');
      setDetectedFiles([]);
      setDetectedPort(null);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedPath = directoryPath.trim();

    if (!trimmedName || !trimmedPath) {
      setError('Kérjük, tölts ki minden kötelező mezőt!');
      return;
    }

    if (checkStatus !== 'success' && !startFile) {
      setError('A szerverhez kötelező egy érvényes indítófájl (pl. start.bat vagy start.sh) a mappában!');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        name: trimmedName,
        directoryPath: trimmedPath,
        startFile: startFile.trim() || undefined
      });
      // Reset form
      setName('');
      setDirectoryPath('');
      setStartFile('');
      setDetectedFiles([]);
      setDetectedPort(null);
      setDetectedVersion(null);
      setCheckStatus('idle');
      setCheckMessage(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Nem sikerült hozzáadni a szervert!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="bg-md-container w-full max-w-xl rounded-2xl border border-md-outlineVariant/60 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
    >
      {/* Modal Header */}
        <div className="px-6 py-5 border-b border-md-outlineVariant/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-md-containerHighest flex items-center justify-center text-white border border-md-outlineVariant">
              <Server className="w-5 h-5 text-neutral-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Új szerver hozzáadása</h2>
              <p className="text-xs text-neutral-400">Biztonságos fájlalapú indítás és könyvtárészlelés</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Directory Path Input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-neutral-400" />
                Szerver könyvtárának elérési útja *
              </span>
              <button
                type="button"
                onClick={() => handleDetect()}
                disabled={isChecking || !directoryPath.trim()}
                className="text-[11px] text-neutral-300 hover:text-white flex items-center gap-1 hover:underline disabled:opacity-40"
              >
                <Search className="w-3 h-3" />
                <span>Mappa ellenőrzése</span>
              </button>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="pl. C:\Minecraft\Servers\Survival vagy /home/mc/server"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                onBlur={() => handleDetect()}
                required
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant/70 text-xs sm:text-sm font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleDetect()}
                disabled={isChecking || !directoryPath.trim()}
                title="Mappa beolvasása"
                className="px-3 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Add meg a gépeden lévő Minecraft szerver mappa teljes elérési útját.
            </p>
          </div>

          {/* Directory Detection Feedback Box */}
          {checkStatus === 'success' && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/70 text-emerald-300 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Érvényes szerver mappa és indítófájl észlelve!</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {detectedVersion && (
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-900/60 border border-emerald-700/60 text-emerald-200">
                      {detectedVersion}
                    </span>
                  )}
                  {detectedPort && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-900/60 border border-emerald-700/60 text-emerald-200">
                      :{detectedPort}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                {checkMessage}
              </p>
              {detectedFiles.length > 1 && (
                <div className="pt-2 border-t border-emerald-800/40">
                  <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
                    Válaszd ki az indítófájlt:
                  </label>
                  <select
                    value={startFile}
                    onChange={(e) => setStartFile(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-emerald-700/60 text-xs font-mono text-white focus:outline-none"
                  >
                    {detectedFiles.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {checkStatus === 'warning' && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/70 text-amber-300 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Hiányzó indítófájl</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                A mappa létezik, de nem található benne felismert indítófájl. A szerver indításához hozz létre egy fájlt a szerver mappájában az alábbi nevek valamelyikével:
              </p>
              <div className="bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800 font-mono text-[11px] space-y-1">
                <div>
                  <span className="text-neutral-400">Windows: </span>
                  <span className="text-emerald-400 font-bold">start.bat</span>
                  <span className="text-neutral-400"> vagy </span>
                  <span className="text-emerald-400">run.bat</span>
                </div>
                <div>
                  <span className="text-neutral-400">Linux / macOS: </span>
                  <span className="text-emerald-400 font-bold">start.sh</span>
                  <span className="text-neutral-400"> vagy </span>
                  <span className="text-emerald-400">run.sh</span>
                </div>
              </div>
            </div>
          )}

          {checkStatus === 'error' && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/70 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{checkMessage}</span>
            </div>
          )}

          {/* Server Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Szerver megnevezése *
            </label>
            <input
              type="text"
              placeholder="pl. Survival Szerver"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant/70 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
            />
          </div>

          {/* Selected Startup File */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-neutral-400" />
              Indítófájl neve
            </label>
            <input
              type="text"
              value={startFile}
              onChange={(e) => setStartFile(e.target.value)}
              placeholder="start.bat vagy start.sh"
              className="w-full px-3.5 py-2.5 rounded-lg bg-md-containerLowest border border-md-outlineVariant/70 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 transition-colors"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              A szerver indításakor ezt a parancsfájlt fogja végrehajtani a rendszer a mappa gyökeréből.
            </p>
          </div>

          {/* Security & Architecture Info Box */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Biztonsági védelem</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              A rendszer a jogosulatlan parancsfuttatások (Remote Code Execution) megelőzése érdekében 
              nem engedélyez tetszőleges parancsszöveg beillesztését. Kizárólag a szerver mappájában 
              elhelyezett, jóváhagyott <span className="font-mono text-neutral-300">start.bat</span> (Windows) vagy <span className="font-mono text-neutral-300">start.sh</span> (Linux) fájlt indítja el.
            </p>
            <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-400 border-t border-neutral-800">
              <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>A szerver portját és MOTD-jét a rendszer a <span className="font-mono text-neutral-300">server.properties</span> fájlból olvassa ki automatikusan.</span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-md-outlineVariant/30">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isLoading || isChecking || (!startFile && checkStatus !== 'success')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Hozzáadás folyamatban...</span>
                </>
              ) : (
                <span>Szerver hozzáadása</span>
              )}
            </button>
          </div>
        </form>
    </Modal>
  );
};
