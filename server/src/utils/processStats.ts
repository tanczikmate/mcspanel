import pidusage from 'pidusage';
import { exec, execFile } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

export async function getChildPids(parentPid: number): Promise<number[]> {
  if (!parentPid || parentPid <= 0) return [];

  if (process.platform === 'win32') {
    try {
      const script = `Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}" | Select-Object -ExpandProperty ProcessId`;
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
      if (!stdout || !stdout.trim()) return [];

      const direct = stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => parseInt(line.trim(), 10))
        .filter((p) => !isNaN(p) && p !== parentPid && p > 0);

      const allChildren: number[] = [...direct];
      for (const childPid of direct) {
        const grandchildren = await getChildPids(childPid);
        allChildren.push(...grandchildren);
      }
      return Array.from(new Set(allChildren));
    } catch {
      return [];
    }
  } else {
    try {
      const { stdout } = await execAsync(`pgrep -P ${parentPid}`);
      const direct = stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => parseInt(line.trim(), 10))
        .filter((p) => !isNaN(p) && p !== parentPid && p > 0);

      const allChildren: number[] = [...direct];
      for (const childPid of direct) {
        const grandchildren = await getChildPids(childPid);
        allChildren.push(...grandchildren);
      }
      return Array.from(new Set(allChildren));
    } catch {
      return [];
    }
  }
}

export interface ResourceUsageStats {
  cpu: number;
  memoryBytes: number;
  memoryFormatted: string;
  players?: {
    online: number;
    max: number;
    names: string[];
  };
  version?: string | null;
}

export async function getProcessUsage(
  parentPidOrPids: number | number[] | null
): Promise<ResourceUsageStats> {
  if (!parentPidOrPids) {
    return { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB' };
  }

  const pidsToQuery: number[] = [];
  if (Array.isArray(parentPidOrPids)) {
    for (const p of parentPidOrPids) {
      if (p && !isNaN(p) && p > 0) pidsToQuery.push(p);
    }
  } else if (parentPidOrPids > 0) {
    pidsToQuery.push(parentPidOrPids);
    const children = await getChildPids(parentPidOrPids);
    pidsToQuery.push(...children);
  }

  const uniquePids = Array.from(new Set(pidsToQuery)).filter((pid) => {
    try {
      return process.kill(pid, 0);
    } catch (e: any) {
      return e.code === 'EPERM';
    }
  });

  if (uniquePids.length === 0) {
    return { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB' };
  }

  try {
    const stats = await pidusage(uniquePids);
    let totalCpu = 0;
    let totalMem = 0;

    for (const pid of uniquePids) {
      if (stats[pid]) {
        totalCpu += stats[pid].cpu || 0;
        totalMem += stats[pid].memory || 0;
      }
    }

    const memMb = Math.round(totalMem / (1024 * 1024));
    return {
      cpu: Math.round(totalCpu * 10) / 10,
      memoryBytes: totalMem,
      memoryFormatted: memMb >= 1024 ? `${(memMb / 1024).toFixed(2)} GB` : `${memMb} MB`
    };
  } catch {
    return { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB' };
  }
}
