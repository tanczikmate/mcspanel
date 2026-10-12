import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AnsiLine, stripAnsi } from '../utils/ansiParser';
import { ServerStatus } from '../types';
import {
  Copy,
  Check,
  Trash2,
  Download,
  Search,
  ArrowDown,
  CornerDownLeft,
  X
} from 'lucide-react';

export interface ConsoleLogEntry {
  id: string | number;
  text: string;
  stream?: 'stdout' | 'stderr';
  timestamp?: string;
}

interface ConsoleViewerProps {
  logs: ConsoleLogEntry[];
  onSendCommand?: (command: string) => void;
  isOnline: boolean;
  serverStatus?: ServerStatus;
  canSendCommands?: boolean;
  onClear?: () => void;
  serverName?: string;
}

export const ConsoleViewer: React.FC<ConsoleViewerProps> = ({
  logs,
  onSendCommand,
  isOnline,
  serverStatus,
  canSendCommands = true,
  onClear,
  serverName = 'Szerver'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autoscroll management
  const [autoScroll, setAutoScroll] = useState(true);
  const [hasNewLogsWhilePaused, setHasNewLogsWhilePaused] = useState(false);

  // Command input & history
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = false) => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    setAutoScroll(true);
    setHasNewLogsWhilePaused(false);
  }, []);

  // Monitor user scroll to pause/resume autoscroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;

    if (isAtBottom) {
      setAutoScroll(true);
      setHasNewLogsWhilePaused(false);
    } else {
      setAutoScroll(false);
    }
  };

  // Scroll on new logs when autoscroll is enabled
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(false);
    } else {
      setHasNewLogsWhilePaused(true);
    }
  }, [logs.length, autoScroll, scrollToBottom]);

  // Filtering logs based on search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((entry) => entry.text.toLowerCase().includes(q));
  }, [logs, searchQuery]);

  // Command submission
  const handleSubmitCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || !onSendCommand) return;

    onSendCommand(trimmed);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);
    setCommand('');

    // Re-focus input
    inputRef.current?.focus();
  };

  // History navigation with Arrow Up / Down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setCommand(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setCommand('');
      } else {
        setHistoryIdx(nextIdx);
        setCommand(history[nextIdx]);
      }
    }
  };

  // Copy logs (respecting current filter/search if active)
  const handleCopyLogs = () => {
    // If user has a mouse selection, copy that; otherwise copy whole filtered log
    const selection = window.getSelection()?.toString();
    const textToCopy = selection && selection.trim().length > 0
      ? selection
      : filteredLogs.map((l) => stripAnsi(l.text)).join('\n');

    if (!textToCopy) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Download log file
  const handleDownloadLogs = () => {
    const raw = filteredLogs.map((l) => stripAnsi(l.text)).join('\n');
    const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `${serverName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}-log-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-[#0C0D0F] rounded-2xl border border-md-outlineVariant/50 overflow-hidden shadow-2xl flex flex-col">
      {/* Console Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#141519] border-b border-neutral-800/80 text-xs">
        {/* Left: Console label & search match count */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="font-mono text-[11px] font-bold text-neutral-400 uppercase tracking-wider select-none mr-1">
            Konzol
          </span>

          {searchQuery && (
            <span className="text-[11px] text-neutral-400 font-mono select-none">
              ({filteredLogs.length} / {logs.length})
            </span>
          )}
        </div>

        {/* Right: Search, Actions, Download, Clear */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Search Toggle / Input */}
          {showSearch ? (
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="Keresés a naplóban..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 sm:w-56 h-7 px-2.5 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-6 p-0.5 text-neutral-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="ml-1 p-1 text-neutral-400 hover:text-white"
                title="Kereső bezárása"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              title="Keresés a naplóban"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopyLogs}
            title="Napló másolása a vágólapra (vagy a kijelölt szöveg)"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Download Logs Button */}
          <button
            onClick={handleDownloadLogs}
            title="Napló letöltése (.txt)"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear Button */}
          {onClear && (
            <button
              onClick={onClear}
              title="Konzol törlése"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Console Log Output Area (Native DOM Scrolling) */}
      <div className="relative w-full overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto px-3.5 py-2.5 font-mono text-[13px] leading-[1.35] tracking-normal select-text text-[#E2E2E6]"
          style={{ height: '380px', minHeight: '380px', maxHeight: '380px' }}
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-neutral-500 text-center select-none font-mono text-xs">
              {searchQuery
                ? 'Nincs találat a megadott keresésre.'
                : 'A konzol üres. A szerver kimenete itt fog megjelenni.'}
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                key={entry.id}
                className="whitespace-pre-wrap break-all py-[0.5px] hover:bg-white/[0.03] transition-colors"
              >
                <AnsiLine text={entry.text} />
              </div>
            ))
          )}
        </div>

        {/* Floating "Scroll to bottom" button when autoscroll is paused */}
        {!autoScroll && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/95 hover:bg-neutral-700 text-xs text-white shadow-xl border border-neutral-700/80 backdrop-blur-xs transition-all active:scale-95 animate-fade-in"
          >
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>{hasNewLogsWhilePaused ? 'Új sorok érkeztek' : 'Ugrás az aljára'}</span>
          </button>
        )}
      </div>

      {/* Docked Command Input Bar at the Bottom */}
      {canSendCommands && (
        <form
          onSubmit={handleSubmitCommand}
          className="flex items-center gap-2 bg-[#121316] px-3.5 py-2.5 border-t border-neutral-800/80"
        >
          <span className="text-emerald-400 font-mono font-bold text-sm select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={
              isOnline
                ? 'Minecraft parancs beírása... (pl. list, op <név>, help, stop)'
                : serverStatus === 'STARTING'
                ? 'A szerver indulása folyamatban... (parancs az indítás befejezése után küldhető)'
                : serverStatus === 'STOPPING'
                ? 'A szerver leállítása folyamatban van...'
                : 'A szerver offline (parancs küldéséhez indítsd el a szervert)'
            }
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isOnline}
            className="flex-1 bg-transparent text-xs sm:text-sm font-mono text-white placeholder-neutral-500 focus:outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!isOnline || !command.trim()}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-900 hover:bg-white active:scale-95 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>Küldés</span>
            <CornerDownLeft className="w-3 h-3 text-neutral-600" />
          </button>
        </form>
      )}
    </div>
  );
};
