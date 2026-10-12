import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { DbInstance, DbPermission } from '../types';
import { PropertiesParser } from '../utils/propertiesParser';
import { ProcessManager, ProcessState } from './processManager';
import { ResourceUsageStats } from '../utils/processStats';

export interface InstanceResponse {
  id: string;
  name: string;
  directoryPath: string;
  startCommand: string;
  port: number;
  status: ProcessState['status'];
  pid: number | null;
  startedAt: string | null;
  autoRestart: boolean;
  startOnBoot: boolean;
  lastStartedAt: string | null;
  lastStartedBy: string | null;
  lastStoppedAt: string | null;
  lastStoppedBy: string | null;
  resourceUsage?: ResourceUsageStats;
  version?: string | null;
  permissions?: {
    canViewConsole: boolean;
    canSendCommands: boolean;
    canStart: boolean;
    canStop: boolean;
    canRestart: boolean;
    canKill: boolean;
    canEditConfig: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryDetectionResult {
  exists: boolean;
  directoryPath: string;
  detectedStartFiles: string[];
  selectedStartFile: string | null;
  hasProperties: boolean;
  port: number;
  motd?: string;
  version?: string | null;
  message?: string;
}

export class InstanceService {
  /**
   * Scans a directory on the host machine to detect start scripts and server.properties
   */
  static detectDirectory(directoryPath: string): DirectoryDetectionResult {
    const trimmed = directoryPath.trim();
    if (!trimmed) {
      throw new Error('Kérjük, add meg a könyvtár elérési útját!');
    }

    const resolvedPath = path.resolve(trimmed);
    if (!fs.existsSync(resolvedPath)) {
      return {
        exists: false,
        directoryPath: resolvedPath,
        detectedStartFiles: [],
        selectedStartFile: null,
        hasProperties: false,
        port: 25565,
        message: 'A megadott mappa nem található a számítógépen.'
      };
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return {
        exists: false,
        directoryPath: resolvedPath,
        detectedStartFiles: [],
        selectedStartFile: null,
        hasProperties: false,
        port: 25565,
        message: 'A megadott elérési út nem egy mappa.'
      };
    }

    // Read files in folder
    const files = fs.readdirSync(resolvedPath);
    const isWindows = process.platform === 'win32';

    // Look for startup script files
    const allScriptExtensions = ['.bat', '.cmd', '.sh'];

    // Filter script files
    const scriptFiles = files.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return allScriptExtensions.includes(ext);
    });

    // Prioritized search: start.bat/sh, then run.bat/sh, then others
    const prioritizedNames = isWindows
      ? ['start.bat', 'run.bat', 'start.cmd', 'run.cmd', 'start.sh', 'run.sh']
      : ['start.sh', 'run.sh', 'start.bat', 'run.bat'];

    let selectedStartFile: string | null = null;
    for (const name of prioritizedNames) {
      const found = scriptFiles.find((f) => f.toLowerCase() === name.toLowerCase());
      if (found) {
        selectedStartFile = found;
        break;
      }
    }

    if (!selectedStartFile && scriptFiles.length > 0) {
      selectedStartFile = scriptFiles[0];
    }

    // Read properties
    const props = PropertiesParser.read(resolvedPath);
    const hasProps = fs.existsSync(path.join(resolvedPath, 'server.properties'));

    return {
      exists: true,
      directoryPath: resolvedPath,
      detectedStartFiles: scriptFiles,
      selectedStartFile,
      hasProperties: hasProps,
      port: props.serverPort,
      motd: props.motd,
      version: null,
      message: selectedStartFile
        ? `Indítófájl észlelve: ${selectedStartFile}`
        : 'Nem található indítófájl (pl. start.bat vagy start.sh) a mappában.'
    };
  }

  static createInstance(data: {
    name: string;
    directoryPath: string;
    startFile?: string;
    autoRestart?: boolean;
    startOnBoot?: boolean;
  }): InstanceResponse {
    const trimmedName = data.name.trim();
    const rawPath = data.directoryPath.trim();

    if (!trimmedName) throw new Error('A szerver neve nem lehet üres!');
    if (!rawPath) throw new Error('A szerver könyvtára nem lehet üres!');

    const resolvedPath = path.resolve(rawPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`A megadott könyvtár nem található a gépen: ${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`A megadott elérési út nem mappa: ${resolvedPath}`);
    }

    // Determine startup script
    let startFile = data.startFile?.trim();
    if (!startFile) {
      // Auto-detect
      const detection = this.detectDirectory(resolvedPath);
      if (!detection.selectedStartFile) {
        throw new Error(
          'Nem található indítófájl a mappában! Kérlek, hozz létre egy start.bat (Windows) vagy start.sh (Linux/Mac) fájlt a szerver mappájában.'
        );
      }
      startFile = detection.selectedStartFile;
    }

    // Security check: prevent path traversal and shell argument injection in script filename
    const sanitizedFile = path.basename(startFile);
    if (!/^[a-zA-Z0-9._-]+\.(bat|cmd|sh)$/i.test(sanitizedFile)) {
      throw new Error('Az indítófájl neve csak betűket, számokat, pontot, kötőjelet vagy alulvonást tartalmazhat, és .bat, .cmd vagy .sh kiterjesztésűnek kell lennie!');
    }
    const fullScriptPath = path.join(resolvedPath, sanitizedFile);

    if (!fs.existsSync(fullScriptPath)) {
      throw new Error(`A megadott indítófájl nem található a mappában: ${sanitizedFile}`);
    }

    // Read port from server.properties if present
    const props = PropertiesParser.read(resolvedPath);
    const cachedPort = props.serverPort;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      INSERT INTO instances (
        id, name, directory_path, start_command, cached_port, auto_restart, start_on_boot, cached_version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      id,
      trimmedName,
      resolvedPath,
      sanitizedFile,
      cachedPort,
      data.autoRestart ? 1 : 0,
      data.startOnBoot ? 1 : 0,
      null,
      now,
      now
    );

    const procState = ProcessManager.getStatus(id);

    return {
      id,
      name: trimmedName,
      directoryPath: resolvedPath,
      startCommand: sanitizedFile,
      port: cachedPort,
      status: procState.status,
      pid: procState.pid,
      startedAt: procState.startedAt,
      autoRestart: !!data.autoRestart,
      startOnBoot: !!data.startOnBoot,
      lastStartedAt: null,
      lastStartedBy: null,
      lastStoppedAt: null,
      lastStoppedBy: null,
      resourceUsage: { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB', version: null },
      version: null,
      createdAt: now,
      updatedAt: now
    };
  }

  static async getAllInstances(user: { id: string; isAdmin: boolean }): Promise<InstanceResponse[]> {
    const db = getDb();
    let rows: DbInstance[] = [];

    if (user.isAdmin) {
      rows = db.prepare('SELECT * FROM instances ORDER BY created_at DESC').all() as DbInstance[];
    } else {
      rows = db.prepare(`
        SELECT i.* FROM instances i
        INNER JOIN permissions p ON p.instance_id = i.id
        WHERE p.user_id = ?
        ORDER BY i.created_at DESC
      `).all(user.id) as DbInstance[];
    }

    const results: InstanceResponse[] = [];
    for (const inst of rows) {
      const procState = ProcessManager.getStatus(inst.id);
      const props = PropertiesParser.read(inst.directory_path);
      const port = props.serverPort || inst.cached_port || 25565;

      let permissions;
      if (!user.isAdmin) {
        const p = db.prepare('SELECT * FROM permissions WHERE user_id = ? AND instance_id = ?').get(user.id, inst.id) as DbPermission | undefined;
        if (p) {
          permissions = {
            canViewConsole: p.can_view_console === 1,
            canSendCommands: p.can_send_commands === 1,
            canStart: p.can_start === 1,
            canStop: p.can_stop === 1,
            canRestart: p.can_restart === 1,
            canKill: p.can_kill === 1,
            canEditConfig: p.can_edit_config === 1
          };
        }
      } else {
        permissions = {
          canViewConsole: true,
          canSendCommands: true,
          canStart: true,
          canStop: true,
          canRestart: true,
          canKill: true,
          canEditConfig: true
        };
      }

      const usage = await ProcessManager.getUsage(inst.id);
      const version = ProcessManager.getVersion(inst.id) || inst.cached_version || null;

      results.push({
        id: inst.id,
        name: inst.name,
        directoryPath: inst.directory_path,
        startCommand: inst.start_command,
        port,
        status: procState.status,
        pid: procState.pid,
        startedAt: procState.startedAt,
        autoRestart: inst.auto_restart === 1,
        startOnBoot: inst.start_on_boot === 1,
        lastStartedAt: inst.last_started_at || null,
        lastStartedBy: inst.last_started_by || null,
        lastStoppedAt: inst.last_stopped_at || null,
        lastStoppedBy: inst.last_stopped_by || null,
        resourceUsage: usage,
        version,
        permissions,
        createdAt: inst.created_at,
        updatedAt: inst.updated_at
      });
    }

    return results;
  }

  static async getInstanceById(id: string, user: { id: string; isAdmin: boolean }): Promise<InstanceResponse> {
    const db = getDb();
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as DbInstance | undefined;
    if (!inst) {
      throw new Error('A szerver példány nem található!');
    }

    let permissions;
    if (!user.isAdmin) {
      const p = db.prepare('SELECT * FROM permissions WHERE user_id = ? AND instance_id = ?').get(user.id, inst.id) as DbPermission | undefined;
      if (!p) {
        throw new Error('Nincs hozzáférésed ehhez a szerverhez!');
      }
      permissions = {
        canViewConsole: p.can_view_console === 1,
        canSendCommands: p.can_send_commands === 1,
        canStart: p.can_start === 1,
        canStop: p.can_stop === 1,
        canRestart: p.can_restart === 1,
        canKill: p.can_kill === 1,
        canEditConfig: p.can_edit_config === 1
      };
    } else {
      permissions = {
        canViewConsole: true,
        canSendCommands: true,
        canStart: true,
        canStop: true,
        canRestart: true,
        canKill: true,
        canEditConfig: true
      };
    }

    const procState = ProcessManager.getStatus(inst.id);
    const props = PropertiesParser.read(inst.directory_path);
    const port = props.serverPort || inst.cached_port || 25565;
    const usage = await ProcessManager.getUsage(inst.id);
    const version = ProcessManager.getVersion(inst.id) || inst.cached_version || null;

    return {
      id: inst.id,
      name: inst.name,
      directoryPath: inst.directory_path,
      startCommand: inst.start_command,
      port,
      status: procState.status,
      pid: procState.pid,
      startedAt: procState.startedAt,
      autoRestart: inst.auto_restart === 1,
      startOnBoot: inst.start_on_boot === 1,
      lastStartedAt: inst.last_started_at || null,
      lastStartedBy: inst.last_started_by || null,
      lastStoppedAt: inst.last_stopped_at || null,
      lastStoppedBy: inst.last_stopped_by || null,
      resourceUsage: usage,
      version,
      permissions,
      createdAt: inst.created_at,
      updatedAt: inst.updated_at
    };
  }

  static async updateInstance(
    id: string,
    updates: {
      name?: string;
      directoryPath?: string;
      startFile?: string;
      autoRestart?: boolean;
      startOnBoot?: boolean;
    }
  ): Promise<InstanceResponse> {
    const db = getDb();
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as DbInstance | undefined;
    if (!inst) throw new Error('A szerver példány nem található!');

    let newPath = inst.directory_path;
    let newPort = inst.cached_port;
    let newCmd = inst.start_command;
    let newAutoRestart = inst.auto_restart;
    let newStartOnBoot = inst.start_on_boot;
    let newVersion = inst.cached_version;

    if (updates.directoryPath) {
      const resolved = path.resolve(updates.directoryPath.trim());
      if (!fs.existsSync(resolved)) {
        throw new Error(`A megadott könyvtár nem létezik: ${resolved}`);
      }
      newPath = resolved;
      const props = PropertiesParser.read(newPath);
      newPort = props.serverPort;
    }

    if (updates.startFile) {
      const sanitized = path.basename(updates.startFile.trim());
      if (!/^[a-zA-Z0-9._-]+\.(bat|cmd|sh)$/i.test(sanitized)) {
        throw new Error('Az indítófájl neve csak betűket, számokat, pontot, kötőjelet vagy alulvonást tartalmazhat, és .bat, .cmd vagy .sh kiterjesztésűnek kell lennie!');
      }
      if (!fs.existsSync(path.join(newPath, sanitized))) {
        throw new Error(`A megadott indítófájl nem létezik a mappában: ${sanitized}`);
      }
      newCmd = sanitized;
    }

    if (updates.autoRestart !== undefined) {
      newAutoRestart = updates.autoRestart ? 1 : 0;
    }

    if (updates.startOnBoot !== undefined) {
      newStartOnBoot = updates.startOnBoot ? 1 : 0;
    }

    const newName = updates.name !== undefined ? updates.name.trim() : inst.name;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE instances 
      SET name = ?, directory_path = ?, start_command = ?, cached_port = ?, auto_restart = ?, start_on_boot = ?, cached_version = ?, updated_at = ?
      WHERE id = ?
    `).run(newName, newPath, newCmd, newPort, newAutoRestart, newStartOnBoot, newVersion, now, id);

    return this.getInstanceById(id, { id: '', isAdmin: true });
  }

  static async deleteInstance(id: string): Promise<void> {
    const db = getDb();
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as DbInstance | undefined;
    if (!inst) throw new Error('A szerver példány nem található!');

    await ProcessManager.kill(id, 'Szerver törlés');
    db.prepare('DELETE FROM instances WHERE id = ?').run(id);
  }
}
