import { exec, execFile } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

/**
 * Finds PID of any process listening on the given TCP port.
 */
export async function findPidByPort(port: number): Promise<number | null> {
  if (!port || port <= 0) return null;
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      const { stdout } = await execAsync('netstat -ano -p tcp');
      const lines = stdout.split(/\r?\n/);
      const portRegex = new RegExp(`[:.]${port}\\s+.*LISTENING\\s+(\\d+)`, 'i');

      for (const line of lines) {
        const match = line.match(portRegex);
        if (match && match[1]) {
          const pid = parseInt(match[1], 10);
          if (pid > 0 && pid !== process.pid) {
            return pid;
          }
        }
      }
    } else {
      // Linux / macOS
      try {
        const { stdout } = await execAsync(`lsof -ti :${port}`);
        const pids = stdout.trim().split(/\s+/).map((p) => parseInt(p, 10)).filter(Boolean);
        if (pids.length > 0 && pids[0] !== process.pid) {
          return pids[0];
        }
      } catch {
        const { stdout } = await execAsync(`fuser ${port}/tcp`);
        const pid = parseInt(stdout.trim(), 10);
        if (pid > 0 && pid !== process.pid) {
          return pid;
        }
      }
    }
  } catch {
    // Port not in use or command error
  }

  return null;
}

/**
 * Finds any orphaned Java processes running for a given server directory.
 */
export async function findJavaPidsInDir(serverDir: string): Promise<number[]> {
  const isWindows = process.platform === 'win32';
  const foundPids: number[] = [];
  const normalizedDir = path.resolve(serverDir).toLowerCase();
  const dirName = path.basename(serverDir).toLowerCase();

  try {
    if (isWindows) {
      // Query Win32_Process using PowerShell
      const script = `Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'java' } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`;
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
      if (!stdout || !stdout.trim()) return [];

      let list: any = JSON.parse(stdout);
      if (!Array.isArray(list)) list = [list];

      for (const item of list) {
        if (!item || !item.ProcessId || item.ProcessId === process.pid) continue;
        const cmd = (item.CommandLine || '').toLowerCase();
        if (cmd.includes(normalizedDir) || (cmd.includes(dirName) && cmd.includes('server.jar'))) {
          foundPids.push(item.ProcessId);
        }
      }
    } else {
      // Unix: ps -ef | grep java
      const { stdout } = await execAsync('ps -ef | grep java | grep -v grep');
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes(normalizedDir)) {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            const pid = parseInt(parts[1], 10);
            if (pid && pid !== process.pid) foundPids.push(pid);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return Array.from(new Set(foundPids));
}

/**
 * Forcefully terminates a process and its entire process tree.
 */
export async function forceKillPid(pid: number): Promise<boolean> {
  if (!pid || pid <= 0 || pid === process.pid) return false;

  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      await execAsync(`taskkill /F /T /PID ${pid}`);
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        process.kill(pid, 'SIGKILL');
      }
    }
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Pre-flight cleaner: Ensures any lingering or orphaned processes holding
 * the server's port or files are terminated before launching the server.
 */
export async function cleanupOrphanedServerProcesses(
  port: number | undefined,
  serverDir: string
): Promise<number[]> {
  const killedPids: number[] = [];

  // 1. Check if the port is occupied
  if (port) {
    const portPid = await findPidByPort(port);
    if (portPid) {
      const killed = await forceKillPid(portPid);
      if (killed) killedPids.push(portPid);
    }
  }

  // 2. Check if any java processes are running in this directory
  const javaPids = await findJavaPidsInDir(serverDir);
  for (const pid of javaPids) {
    if (!killedPids.includes(pid)) {
      const killed = await forceKillPid(pid);
      if (killed) killedPids.push(pid);
    }
  }

  // Give the operating system time to release file descriptors and port bindings
  if (killedPids.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return killedPids;
}
