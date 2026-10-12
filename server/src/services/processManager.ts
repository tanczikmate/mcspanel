import { spawn, ChildProcess, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { DbInstance } from '../types';
import { getProcessUsage, getChildPids, ResourceUsageStats } from '../utils/processStats';
import { pingMinecraftServer } from '../utils/minecraftPing';
import { cleanupOrphanedServerProcesses, findPidByPort, findJavaPidsInDir } from '../utils/processFinder';
import { VersionDetector } from '../utils/versionDetector';
import { StreamThrottler, LogMessage } from '../utils/streamThrottler';
import { ResourceHistoryTracker, ResourceHistoryPoint } from '../utils/resourceHistory';

export { LogMessage, ResourceHistoryPoint };

export type ProcessStatus = 'OFFLINE' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'CRASHED';

export interface ProcessState {
  status: ProcessStatus;
  pid: number | null;
  startedAt: string | null;
}

function isPidAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    return process.kill(pid, 0);
  } catch (e: any) {
    return e.code === 'EPERM';
  }
}

export class ProcessManager {
  private static instances: Map<string, {
    process: ChildProcess | null;
    status: ProcessStatus;
    pid: number | null;
    startedAt: string | null;
    logs: LogMessage[];
    listeners: Set<(msg: { type: 'log' | 'logs' | 'status' | 'metrics'; data: any }) => void>;
    stoppingTimeout: NodeJS.Timeout | null;
    deliberateStop: boolean;
    restartTimer: NodeJS.Timeout | null;
    hasExited: boolean;
    players: {
      online: number;
      max: number;
      names: string[];
    };
    version: string | null;
    childPids: Set<number>;
    resourceHistory: ResourceHistoryTracker;
    throttler: StreamThrottler;
    recentCrashes: number[];
    lastJavaScanTime: number;
  }> = new Map();

  private static MAX_LOG_HISTORY = 1000;
  private static samplingLoopStarted = false;

  private static getOrCreateHolder(instanceId: string) {
    let holder = this.instances.get(instanceId);
    if (!holder) {
      const throttler = new StreamThrottler((batch: LogMessage[]) => {
        const h = this.instances.get(instanceId);
        if (!h) return;
        for (const item of batch) {
          h.logs.push(item);
          if (h.logs.length > this.MAX_LOG_HISTORY) {
            h.logs.shift();
          }
          // Check if this log line announces or reveals the Minecraft version
          const detectedVer = VersionDetector.parseLogLine(item.text);
          if (detectedVer && h.version !== detectedVer) {
            h.version = detectedVer;
            try {
              const db = getDb();
              db.prepare('UPDATE instances SET cached_version = ? WHERE id = ?').run(detectedVer, instanceId);
            } catch {}
          }
        }

        if (batch.length === 1) {
          this.broadcast(instanceId, { type: 'log', data: batch[0] });
        } else if (batch.length > 1) {
          this.broadcast(instanceId, { type: 'logs', data: batch });
        }
      });

      holder = {
        process: null,
        status: 'OFFLINE',
        pid: null,
        startedAt: null,
        logs: [],
        listeners: new Set(),
        stoppingTimeout: null,
        deliberateStop: false,
        restartTimer: null,
        hasExited: false,
        players: {
          online: 0,
          max: 20,
          names: []
        },
        version: null,
        childPids: new Set(),
        resourceHistory: new ResourceHistoryTracker(60),
        throttler,
        recentCrashes: [],
        lastJavaScanTime: 0
      };
      this.instances.set(instanceId, holder);

      // Ensure background sampling loop is active
      this.startBackgroundSampling();

      // Attempt to load cached version previously detected from the running server
      try {
        const db = getDb();
        const row = db.prepare('SELECT cached_version FROM instances WHERE id = ?').get(instanceId) as
          | { cached_version: string | null }
          | undefined;
        if (row?.cached_version) {
          holder.version = row.cached_version;
        }
      } catch {}
    }
    return holder;
  }

  static getVersion(instanceId: string): string | null {
    const holder = this.getOrCreateHolder(instanceId);
    return holder.version;
  }

  static getStatus(instanceId: string): ProcessState {
    const holder = this.getOrCreateHolder(instanceId);

    // Liveness check: If marked active but OS process is gone, check child processes before declaring OFFLINE
    if (holder.status !== 'OFFLINE' && holder.pid && !isPidAlive(holder.pid)) {
      let childAdopted = false;
      for (const cp of holder.childPids) {
        if (isPidAlive(cp)) {
          holder.pid = cp;
          childAdopted = true;
          break;
        }
      }
      if (!childAdopted) {
        holder.status = 'OFFLINE';
        holder.process = null;
        holder.pid = null;
        holder.startedAt = null;
        holder.childPids.clear();
      }
    }

    return {
      status: holder.status,
      pid: holder.pid,
      startedAt: holder.startedAt
    };
  }

  static async getUsage(instanceId: string): Promise<ResourceUsageStats> {
    const holder = this.instances.get(instanceId);
    if (!holder || !holder.pid || holder.status === 'OFFLINE' || holder.status === 'STOPPING') {
      return {
        cpu: 0,
        memoryBytes: 0,
        memoryFormatted: '0 MB',
        players: { online: 0, max: 20, names: [] },
        version: holder?.version || null
      };
    }

    // Check liveness
    if (!isPidAlive(holder.pid)) {
      let childAdopted = false;
      for (const cp of holder.childPids) {
        if (isPidAlive(cp)) {
          holder.pid = cp;
          childAdopted = true;
          break;
        }
      }
      if (!childAdopted) {
        holder.status = 'OFFLINE';
        holder.process = null;
        holder.pid = null;
        holder.startedAt = null;
        holder.childPids.clear();
        this.broadcast(instanceId, {
          type: 'status',
          data: { status: 'OFFLINE', pid: null, startedAt: null }
        });
        return {
          cpu: 0,
          memoryBytes: 0,
          memoryFormatted: '0 MB',
          players: { online: 0, max: 20, names: [] },
          version: holder?.version || null
        };
      }
    }

    // Clean up any dead child processes from our tracked set
    for (const cp of holder.childPids) {
      if (!isPidAlive(cp)) {
        holder.childPids.delete(cp);
      }
    }

    // If no child Java process is tracked yet, attempt to discover it
    try {
      const db = getDb();
      const inst = db.prepare('SELECT cached_port, directory_path FROM instances WHERE id = ?').get(instanceId) as
        | { cached_port: number | null; directory_path: string }
        | undefined;
      const port = inst?.cached_port || 25565;

      if (holder.childPids.size === 0) {
        // Method 1: Check listening TCP port (fastest, identifies java.exe instantly once bound)
        const portPid = await findPidByPort(port);
        if (portPid && portPid !== holder.pid && isPidAlive(portPid)) {
          holder.childPids.add(portPid);
        }

        // Method 2: Check java.exe processes running in this instance directory (throttled to max once per 6s)
        const nowMs = Date.now();
        if (holder.childPids.size === 0 && inst?.directory_path && (nowMs - holder.lastJavaScanTime > 6000)) {
          holder.lastJavaScanTime = nowMs;
          const javaPids = await findJavaPidsInDir(inst.directory_path);
          for (const jp of javaPids) {
            if (jp !== holder.pid && isPidAlive(jp)) {
              holder.childPids.add(jp);
            }
          }
        }

        // Method 3: Query child processes of holder.pid
        if (holder.childPids.size === 0 && holder.pid) {
          const children = await getChildPids(holder.pid);
          for (const cp of children) {
            if (isPidAlive(cp)) {
              holder.childPids.add(cp);
            }
          }
        }
      }
    } catch {}

    // Calculate aggregated usage across parent (cmd.exe) and all child processes (java.exe)
    const allPids = [holder.pid, ...Array.from(holder.childPids)];
    const usage = await getProcessUsage(allPids);

    // Query live Minecraft server ping (SLP) on the server port
    try {
      const db = getDb();
      const inst = db.prepare('SELECT cached_port FROM instances WHERE id = ?').get(instanceId) as { cached_port: number | null } | undefined;
      const port = inst?.cached_port || 25565;

      const pingRes = await pingMinecraftServer('127.0.0.1', port, 1000);
      if (pingRes) {
        holder.players = {
          online: pingRes.playersOnline,
          max: pingRes.playersMax,
          names: pingRes.playerNames
        };
        if (pingRes.version) {
          const cleaned = VersionDetector.cleanVersion(pingRes.version);
          if (cleaned && holder.version !== cleaned) {
            holder.version = cleaned;
            try {
              db.prepare('UPDATE instances SET cached_version = ? WHERE id = ?').run(cleaned, instanceId);
            } catch {}
          }
        }
        if (holder.status === 'STARTING') {
          this.setStatus(instanceId, 'RUNNING');
          holder.recentCrashes = [];
        }
      }
    } catch {}

    // Push point into rolling resource history
    holder.resourceHistory.push({
      cpu: usage.cpu,
      memoryBytes: usage.memoryBytes
    });

    return {
      ...usage,
      players: holder.players,
      version: holder.version
    };
  }

  static getResourceHistory(instanceId: string): ResourceHistoryPoint[] {
    const holder = this.getOrCreateHolder(instanceId);
    return holder.resourceHistory.getHistory();
  }

  public static startBackgroundSampling(): void {
    if (this.samplingLoopStarted) return;
    this.samplingLoopStarted = true;

    const timer = setInterval(async () => {
      for (const [id, holder] of this.instances.entries()) {
        if (holder.status === 'RUNNING' || holder.status === 'STARTING') {
          try {
            await this.getUsage(id);
          } catch {}
        }
      }
    }, 4000);
    timer.unref();
  }

  static getLogs(instanceId: string): LogMessage[] {
    const holder = this.getOrCreateHolder(instanceId);
    return [...holder.logs];
  }

  static subscribe(instanceId: string, listener: (msg: { type: 'log' | 'logs' | 'status' | 'metrics'; data: any }) => void): () => void {
    const holder = this.getOrCreateHolder(instanceId);
    holder.listeners.add(listener);
    return () => {
      holder.listeners.delete(listener);
    };
  }

  private static broadcast(instanceId: string, msg: { type: 'log' | 'logs' | 'status' | 'metrics'; data: any }) {
    const holder = this.getOrCreateHolder(instanceId);
    for (const listener of holder.listeners) {
      try {
        listener(msg);
      } catch {
        // ignore listener errors
      }
    }
  }

  private static appendLog(instanceId: string, text: string, stream?: 'stdout' | 'stderr') {
    if (!text || !text.trim()) return;
    const holder = this.getOrCreateHolder(instanceId);
    holder.throttler.push(text, stream);
  }

  public static flushLogs(instanceId: string): void {
    const holder = this.instances.get(instanceId);
    if (holder) {
      holder.throttler.flush();
    }
  }

  private static setStatus(instanceId: string, status: ProcessStatus) {
    const holder = this.getOrCreateHolder(instanceId);
    holder.status = status;
    this.broadcast(instanceId, {
      type: 'status',
      data: {
        status,
        pid: holder.pid,
        startedAt: holder.startedAt
      }
    });
  }

  /**
   * Start a Minecraft server instance
   */
  static async start(instanceId: string, initiatedBy = 'Rendszer'): Promise<ProcessState> {
    const holder = this.getOrCreateHolder(instanceId);

    // If marked active, check if process is really alive
    if (holder.status === 'RUNNING' || holder.status === 'STARTING') {
      if (holder.pid && isPidAlive(holder.pid)) {
        throw new Error('A szerver már fut vagy indulás alatt áll!');
      } else {
        // Process is dead, clean up previous state
        holder.status = 'OFFLINE';
        holder.process = null;
        holder.pid = null;
      }
    }

    if (holder.restartTimer) {
      clearTimeout(holder.restartTimer);
      holder.restartTimer = null;
    }
    holder.deliberateStop = false;
    holder.hasExited = false;
    holder.players = { online: 0, max: 20, names: [] };
    holder.childPids.clear();

    const db = getDb();
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as DbInstance | undefined;
    if (!instance) {
      throw new Error('A megadott szerver példány nem található az adatbázisban!');
    }

    const scriptName = path.basename(instance.start_command.trim());
    if (!scriptName) {
      throw new Error('Nincs megadva indítófájl a szerverhez!');
    }

    const serverDir = path.resolve(instance.directory_path);
    const fullScriptPath = path.join(serverDir, scriptName);

    if (!fs.existsSync(fullScriptPath)) {
      throw new Error(`A megadott indítófájl nem található a mappában: ${scriptName}`);
    }

    // Pre-flight check: automatically clean up any orphaned processes holding the port or files
    try {
      const cleanedPids = await cleanupOrphanedServerProcesses(instance.cached_port || undefined, serverDir);
      if (cleanedPids.length > 0) {
        this.appendLog(
          instanceId,
          `[MCSPanel Figyelem] Korábbi lezáratlan folyamat(ok) észlelve (PID: ${cleanedPids.join(', ')}). A panel felszabadította a portot és a zárolt fájlokat.`
        );
      }
    } catch (e: any) {
      console.error('Pre-flight cleanup error:', e);
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE instances 
      SET last_started_at = ?, last_started_by = ?, updated_at = ? 
      WHERE id = ?
    `).run(now, initiatedBy, now, instanceId);

    this.appendLog(instanceId, `[MCSPanel] Szerver indítása: ${scriptName} (${serverDir})`);
    this.setStatus(instanceId, 'STARTING');

    const isWindows = process.platform === 'win32';
    const spawnEnv = {
      ...process.env,
      FORCE_COLOR: '3',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    };
    
    // Spawn verified startup script safely
    let child: ChildProcess;
    if (isWindows) {
      if (scriptName.toLowerCase().endsWith('.sh')) {
        child = spawn('bash', [scriptName], {
          cwd: serverDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: spawnEnv,
          windowsHide: true
        });
      } else {
        child = spawn('cmd.exe', ['/c', scriptName], {
          cwd: serverDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: spawnEnv,
          windowsHide: true
        });
      }
    } else {
      child = spawn('bash', ['./' + scriptName], {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: spawnEnv
      });
    }

    holder.process = child;
    holder.pid = child.pid || null;
    holder.startedAt = now;

    // Handle process termination idempotently
    const handleExit = (code: number | null, signal: string | null) => {
      if (holder.hasExited) return;
      holder.hasExited = true;

      if (holder.stoppingTimeout) {
        clearTimeout(holder.stoppingTimeout);
        holder.stoppingTimeout = null;
      }

      this.appendLog(
        instanceId,
        `[MCSPanel] A folyamat leállt. (Kód: ${code ?? 'N/A'}, Szignál: ${signal ?? 'N/A'})`
      );
      this.flushLogs(instanceId);

      const wasDeliberate = holder.deliberateStop;
      holder.process = null;
      holder.pid = null;
      holder.startedAt = null;
      holder.players = { online: 0, max: 20, names: [] };

      const exitTime = new Date().toISOString();

      if (wasDeliberate) {
        holder.deliberateStop = false;
        this.setStatus(instanceId, 'OFFLINE');
      } else {
        // Unexpected stop or crash
        db.prepare(`
          UPDATE instances 
          SET last_stopped_at = ?, last_stopped_by = 'Váratlan leállás / Crash', updated_at = ? 
          WHERE id = ?
        `).run(exitTime, exitTime, instanceId);

        if (code === 0) {
          this.setStatus(instanceId, 'OFFLINE');
        } else {
          this.setStatus(instanceId, 'CRASHED');
        }

        // Check auto_restart setting
        const instRow = db.prepare('SELECT auto_restart FROM instances WHERE id = ?').get(instanceId) as { auto_restart: number } | undefined;
        if (instRow && instRow.auto_restart === 1) {
          const nowMs = Date.now();
          holder.recentCrashes = holder.recentCrashes.filter((t) => nowMs - t < 60000);
          holder.recentCrashes.push(nowMs);

          if (holder.recentCrashes.length >= 3) {
            this.appendLog(
              instanceId,
              '[MCSPanel Figyelem] A szerver 60 másodpercen belül 3 alkalommal váratlanul leállt (Crash-loop védelem aktív). Az automatikus újraindítás leállítva.'
            );
            this.setStatus(instanceId, 'CRASHED');
          } else {
            this.appendLog(
              instanceId,
              `[MCSPanel] A szerver váratlanul leállt (${holder.recentCrashes.length}/3). Automatikus újraindítás 5 másodperc múlva...`
            );
            holder.restartTimer = setTimeout(() => {
              this.start(instanceId, 'Rendszer (auto-restart)').catch((err) => {
                this.appendLog(instanceId, `[MCSPanel Hiba] Sikertelen automatikus újraindítás: ${err.message}`);
              });
            }, 5000);
          }
        }
      }
    };

    // Stream stdout without extraneous empty lines
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        this.appendLog(instanceId, line);

        const lower = line.toLowerCase();

        // 1. Detect batch file 'pause' hanging (e.g. "Press any key to continue . . ." or "A folytatáshoz nyomjon...")
        if (
          lower.includes('press any key to continue') ||
          lower.includes('folytatáshoz nyomjon') ||
          lower.includes('nyomjon le egy billentyűt')
        ) {
          this.appendLog(instanceId, '[MCSPanel] A parancsfájl lefutott (pause észlelve). Lezárás...');
          try {
            child.stdin?.write('\r\n');
          } catch {}
          setTimeout(() => {
            if (holder.process && !holder.hasExited) {
              this.kill(instanceId, 'Befejezett folyamat').catch(() => {});
            }
          }, 600);
        }

        // 2. Detect common fatal errors (e.g. file lock or port collision)
        if (
          line.includes('A folyamat nem éri el a fájlt') ||
          line.includes('The process cannot access the file') ||
          line.includes('Unable to access jarfile') ||
          line.includes('FAILED TO BIND TO PORT') ||
          line.includes('Address already in use')
        ) {
          this.appendLog(instanceId, '[MCSPanel Figyelem] Kritikus hiba: a fájl zárolva van vagy a port foglalt egy másik folyamat által!');
        }

        // 3. Detect Minecraft server ready state
        if (holder.status === 'STARTING') {
          if (line.includes('Done (') || line.includes('For help, type "help"') || line.includes('Server started')) {
            this.setStatus(instanceId, 'RUNNING');
            holder.recentCrashes = [];
          }
        }

        // 4. Track player joins and leaves from log text
        const joinMatch = line.match(/(?:INFO\]: |\[Server\] )([a-zA-Z0-9_]{2,16}) (?:joined the game|logged in with entity id)/i);
        if (joinMatch) {
          const pName = joinMatch[1];
          if (!holder.players.names.includes(pName)) {
            holder.players.names.push(pName);
          }
          holder.players.online = holder.players.names.length;
        }

        const leaveMatch = line.match(/(?:INFO\]: |\[Server\] )([a-zA-Z0-9_]{2,16}) (?:left the game|lost connection)/i);
        if (leaveMatch) {
          const pName = leaveMatch[1];
          holder.players.names = holder.players.names.filter((n) => n.toLowerCase() !== pName.toLowerCase());
          holder.players.online = holder.players.names.length;
        }
      }
    });

    // Stream stderr
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        this.appendLog(instanceId, `[STDERR] ${line}`);
      }
    });

    // Listen to both exit and close events
    child.on('exit', (code, signal) => handleExit(code, signal));
    child.on('close', (code, signal) => handleExit(code, signal));

    child.on('error', (err) => {
      this.appendLog(instanceId, `[MCSPanel Hiba] Nem sikerült elindítani a folyamatot: ${err.message}`);
      handleExit(1, null);
    });

    return {
      status: holder.status,
      pid: holder.pid,
      startedAt: holder.startedAt
    };
  }

  /**
   * Send a command to the server's stdin
   */
  static sendCommand(instanceId: string, command: string, sender = 'Konzol'): void {
    const holder = this.getOrCreateHolder(instanceId);
    if (!holder.process || !holder.process.stdin || holder.status === 'OFFLINE') {
      throw new Error('A szerver nem fut, nem lehet parancsot küldeni!');
    }
    if (holder.status === 'STARTING') {
      throw new Error('A szerver még indulás alatt áll, parancsok csak a teljes betöltődés után küldhetők!');
    }
    if (holder.status === 'STOPPING') {
      throw new Error('A szerver leállítása folyamatban van, már nem fogad új parancsokat!');
    }

    const cleanCmd = command.trim();
    if (!cleanCmd) return;

    this.appendLog(instanceId, `> ${cleanCmd}`);
    this.flushLogs(instanceId);

    // If command is stop or /stop, mark this as deliberate shutdown
    const isStopCommand = /^\/?stop(\s.*)?$/i.test(cleanCmd);
    if (isStopCommand) {
      holder.deliberateStop = true;
      const db = getDb();
      const now = new Date().toISOString();
      const stoppedBy = sender && sender !== 'Konzol' ? `${sender} (konzol: stop)` : 'Konzol (stop parancs)';
      try {
        db.prepare(`
          UPDATE instances 
          SET last_stopped_at = ?, last_stopped_by = ?, updated_at = ? 
          WHERE id = ?
        `).run(now, stoppedBy, now, instanceId);
      } catch {}

      this.setStatus(instanceId, 'STOPPING');
      this.appendLog(instanceId, `[MCSPanel] Kíméletes leállítás észlelve (${stoppedBy})...`);

      // Arm watchdog timeout to prevent hanging forever
      if (!holder.stoppingTimeout) {
        holder.stoppingTimeout = setTimeout(() => {
          if (holder.process && holder.status === 'STOPPING') {
            this.appendLog(instanceId, '[MCSPanel] A leállítás időtúllépés miatt nem fejeződött be. Kényszerített leállítás (kill)...');
            this.kill(instanceId, stoppedBy).catch(() => {});
          }
        }, 25000);
      }
    }

    // Strip leading slash if user typed a chat-style command (e.g. /stop or /list)
    const commandToSend = cleanCmd.startsWith('/') ? cleanCmd.slice(1) : cleanCmd;
    holder.process.stdin.write(`${commandToSend}\n`);
  }

  /**
   * Graceful stop: sends 'stop' command to stdin and waits for process to terminate
   */
  static async stop(instanceId: string, timeoutMs = 25000, initiatedBy = 'Rendszer'): Promise<void> {
    const holder = this.getOrCreateHolder(instanceId);
    if (!holder.process || holder.status === 'OFFLINE') {
      throw new Error('A szerver jelenleg nem fut!');
    }
    if (holder.status === 'STARTING') {
      throw new Error(
        'A szerver még indulás alatt áll, amíg nem fejeződött be az indítás, nem lehet kíméletesen leállítani! (Ha a folyamat elakadt, használd a Kill funkciót.)'
      );
    }
    if (holder.status === 'STOPPING') {
      throw new Error('A szerver leállítása már folyamatban van!');
    }

    if (holder.restartTimer) {
      clearTimeout(holder.restartTimer);
      holder.restartTimer = null;
    }
    holder.deliberateStop = true;

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE instances 
      SET last_stopped_at = ?, last_stopped_by = ?, updated_at = ? 
      WHERE id = ?
    `).run(now, initiatedBy, now, instanceId);

    this.setStatus(instanceId, 'STOPPING');
    this.appendLog(instanceId, '[MCSPanel] Kíméletes leállítás kezdeményezve (stop parancs)...');

    try {
      holder.process.stdin?.write('stop\n');
    } catch (e: any) {
      this.appendLog(instanceId, `[MCSPanel] Hiba a stop parancs küldésekor: ${e.message}`);
    }

    // Arm timeout to force kill if it hangs
    holder.stoppingTimeout = setTimeout(() => {
      if (holder.process && holder.status === 'STOPPING') {
        this.appendLog(instanceId, '[MCSPanel] A leállítás időtúllépés miatt nem fejeződött be. Kényszerített leállítás (kill)...');
        this.kill(instanceId, initiatedBy).catch(() => {});
      }
    }, timeoutMs);
  }

  /**
   * Force kill the process and all child processes
   */
  static async kill(instanceId: string, initiatedBy = 'Rendszer'): Promise<void> {
    const holder = this.getOrCreateHolder(instanceId);
    const pid = holder.pid;

    if (holder.restartTimer) {
      clearTimeout(holder.restartTimer);
      holder.restartTimer = null;
    }
    holder.deliberateStop = true;

    const db = getDb();
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as DbInstance | undefined;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE instances 
      SET last_stopped_at = ?, last_stopped_by = ?, updated_at = ? 
      WHERE id = ?
    `).run(now, initiatedBy, now, instanceId);

    // Also clean up any lingering Java processes associated with this directory or port
    if (instance) {
      try {
        cleanupOrphanedServerProcesses(instance.cached_port || undefined, path.resolve(instance.directory_path)).catch(() => {});
      } catch {}
    }

    if (!pid) {
      holder.process = null;
      holder.pid = null;
      holder.startedAt = null;
      holder.players = { online: 0, max: 20, names: [] };
      this.setStatus(instanceId, 'OFFLINE');
      return;
    }

    this.appendLog(instanceId, `[MCSPanel] Kényszerített leállítás (Process Kill, PID: ${pid})...`);

    if (process.platform === 'win32') {
      // Windows: taskkill terminates whole process tree (/T) forcefully (/F)
      await new Promise<void>((resolve) => {
        exec(`taskkill /F /T /PID ${pid}`, () => {
          resolve();
        });
      });
      holder.process = null;
      holder.pid = null;
      holder.startedAt = null;
      holder.players = { online: 0, max: 20, names: [] };
      this.setStatus(instanceId, 'OFFLINE');
    } else {
      // Unix / macOS: kill process tree or send SIGKILL
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
      holder.process = null;
      holder.pid = null;
      holder.startedAt = null;
      holder.players = { online: 0, max: 20, names: [] };
      this.setStatus(instanceId, 'OFFLINE');
    }
  }

  /**
   * Restart server
   */
  static async restart(instanceId: string, initiatedBy = 'Rendszer'): Promise<ProcessState> {
    const holder = this.getOrCreateHolder(instanceId);
    if (holder.status === 'STARTING') {
      throw new Error('A szerver még indulás alatt áll, kérlek várd meg amíg befejeződik az indítás az újraindítás előtt!');
    }
    if (holder.status === 'STOPPING') {
      throw new Error('A szerver leállítása folyamatban van, kérlek várd meg amíg leáll!');
    }
    if (holder.status !== 'OFFLINE') {
      await this.stop(instanceId, 25000, initiatedBy);
      // Wait gracefully for process to exit (up to 25 seconds)
      const maxWaitMs = 25000;
      const startTime = Date.now();
      while (this.getStatus(instanceId).status !== 'OFFLINE' && Date.now() - startTime < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (this.getStatus(instanceId).status !== 'OFFLINE' || holder.process) {
        this.appendLog(instanceId, '[MCSPanel] A kíméletes leállítás időtúllépést ért el, kényszerített leállítás folyamatban...');
        await this.kill(instanceId, initiatedBy);
      }
      // Wait a brief moment to ensure ports and file locks are released by the OS
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    return this.start(instanceId, initiatedBy);
  }

  /**
   * Stop all active servers gracefully when shutting down MCSPanel
   */
  static async stopAll(): Promise<void> {
    const activeInstances = Array.from(this.instances.entries()).filter(
      ([, holder]) => holder.process && holder.status !== 'OFFLINE'
    );
    if (activeInstances.length === 0) return;

    // Send graceful stop command to all running servers in parallel (or kill starting ones)
    await Promise.all(
      activeInstances.map(async ([id, holder]) => {
        try {
          if (holder.status === 'RUNNING') {
            await this.stop(id, 15000, 'MCSPanel Leállás');
          } else if (holder.status === 'STARTING') {
            await this.kill(id, 'MCSPanel Leállás (Indulás közben)');
          }
        } catch {}
      })
    );

    // Wait gracefully for all servers to save world data and exit (up to 15 seconds)
    const startTime = Date.now();
    while (
      activeInstances.some(([id]) => this.getStatus(id).status !== 'OFFLINE') &&
      Date.now() - startTime < 15000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Force kill any process that timed out and failed to exit
    for (const [id, holder] of activeInstances) {
      if (this.getStatus(id).status !== 'OFFLINE' || holder.process) {
        try {
          await this.kill(id, 'MCSPanel Leállás (Időtúllépés)');
        } catch {}
      }
    }
  }
}
