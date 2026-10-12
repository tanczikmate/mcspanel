import pidusage from 'pidusage';
import { exec, execFile } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

export interface JvmHeapStats {
  usedBytes: number;
  maxBytes: number;
  usedFormatted: string;
  maxFormatted: string;
  percent: number;
}

export interface ResourceUsageStats {
  cpu: number;
  memoryBytes: number;
  memoryFormatted: string;
  jvmHeap?: JvmHeapStats | null;
  players?: {
    online: number;
    max: number;
    names: string[];
  };
  version?: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = Math.round(bytes / (1024 * 1024));
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb} MB`;
}

function parseUnit(val: string, u: string): number {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  const mult = u.toUpperCase() === 'G' ? 1024 * 1024 * 1024 : u.toUpperCase() === 'M' ? 1024 * 1024 : u.toUpperCase() === 'K' ? 1024 : 1;
  return Math.round(num * mult);
}

export function parseJvmHeap(output: string): JvmHeapStats | null {
  if (!output) return null;

  // 1. ZGC or Shenandoah: "ZHeap used 1230M, capacity 1416M, max capacity 8192M"
  const zgcMatch = output.match(/(?:ZHeap|Shenandoah)[^\n]*used\s+([0-9.]+)\s*([KMGTP]?)[^,\n]*,.*?(?:max(?:\s+capacity)?\s+([0-9.]+)\s*([KMGTP]?))/i);
  if (zgcMatch) {
    const usedBytes = parseUnit(zgcMatch[1], zgcMatch[2]);
    const maxBytes = parseUnit(zgcMatch[3], zgcMatch[4]);
    const percent = maxBytes > 0 ? Math.round((usedBytes / maxBytes) * 100) : 0;
    return {
      usedBytes,
      maxBytes,
      usedFormatted: formatBytes(usedBytes),
      maxFormatted: formatBytes(maxBytes),
      percent
    };
  }

  // 2. G1GC: "garbage-first heap total 2097152K, used 524288K"
  const g1Match = output.match(/garbage-first heap.*?total\s+([0-9.]+)\s*([KMGTP]?).*?used\s+([0-9.]+)\s*([KMGTP]?)/i);
  if (g1Match) {
    const usedBytes = parseUnit(g1Match[3], g1Match[4]);
    const maxBytes = parseUnit(g1Match[1], g1Match[2]);
    const percent = maxBytes > 0 ? Math.round((usedBytes / maxBytes) * 100) : 0;
    return {
      usedBytes,
      maxBytes,
      usedFormatted: formatBytes(usedBytes),
      maxFormatted: formatBytes(maxBytes),
      percent
    };
  }

  // 3. Generational (Young + Tenured / Old before Metaspace)
  const heapSection = output.split(/Metaspace/i)[0];
  const usedMatches = [...heapSection.matchAll(/\bused\s+([0-9.]+)\s*([KMGTP]?)/gi)];
  const totalMatches = [...heapSection.matchAll(/\b(?:total|capacity)\s+([0-9.]+)\s*([KMGTP]?)/gi)];

  if (usedMatches.length > 0) {
    let usedBytes = 0;
    for (const m of usedMatches) {
      usedBytes += parseUnit(m[1], m[2]);
    }
    let maxBytes = 0;
    for (const m of totalMatches) {
      maxBytes += parseUnit(m[1], m[2]);
    }
    const finalMax = maxBytes || usedBytes;
    const percent = finalMax > 0 ? Math.round((usedBytes / finalMax) * 100) : 0;
    return {
      usedBytes,
      maxBytes: finalMax,
      usedFormatted: formatBytes(usedBytes),
      maxFormatted: formatBytes(finalMax),
      percent
    };
  }

  return null;
}

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

async function getWindowsProcessDetails(pids: number[]): Promise<{ totalPrivateMem: number; javaPid: number | null; javaPath: string | null }> {
  if (!pids || pids.length === 0) {
    return { totalPrivateMem: 0, javaPid: null, javaPath: null };
  }

  const psScript = `
    $pids = @(${pids.join(',')});
    $procs = $pids | ForEach-Object { try { Get-Process -Id $_ -ErrorAction Stop } catch {} };
    $mem = ($procs | Measure-Object -Property PrivateMemorySize64 -Sum).Sum;
    $javaProc = $procs | Where-Object { $_.ProcessName -like '*java*' } | Select-Object -First 1;
    $res = @{
      mem = if ($mem) { [int64]$mem } else { 0 };
      javaPid = if ($javaProc) { $javaProc.Id } else { $null };
      javaPath = if ($javaProc) { $javaProc.Path } else { $null }
    };
    $res | ConvertTo-Json -Compress
  `;

  try {
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psScript], { timeout: 3000 });
    const parsed = JSON.parse(stdout.trim());
    return {
      totalPrivateMem: parsed.mem || 0,
      javaPid: parsed.javaPid || null,
      javaPath: parsed.javaPath || null
    };
  } catch {
    return { totalPrivateMem: 0, javaPid: null, javaPath: null };
  }
}

async function queryJvmHeap(javaPid: number, javaPath: string | null): Promise<JvmHeapStats | null> {
  if (!javaPid) return null;
  let jcmdBin: string | null = null;

  if (javaPath) {
    const candidate = path.join(path.dirname(javaPath), process.platform === 'win32' ? 'jcmd.exe' : 'jcmd');
    if (fs.existsSync(candidate)) {
      jcmdBin = candidate;
    }
  }

  if (!jcmdBin && process.env.JAVA_HOME) {
    const candidate = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'jcmd.exe' : 'jcmd');
    if (fs.existsSync(candidate)) {
      jcmdBin = candidate;
    }
  }

  if (!jcmdBin) {
    jcmdBin = 'jcmd';
  }

  try {
    const { stdout } = await execFileAsync(jcmdBin, [String(javaPid), 'GC.heap_info'], { timeout: 2000 });
    return parseJvmHeap(stdout);
  } catch {
    return null;
  }
}

interface CacheEntry {
  timestamp: number;
  data: ResourceUsageStats;
}

const statsCache = new Map<string, CacheEntry>();

export async function getProcessUsage(
  parentPidOrPids: number | number[] | null
): Promise<ResourceUsageStats> {
  if (!parentPidOrPids) {
    return { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB', jvmHeap: null };
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
    return { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB', jvmHeap: null };
  }

  const cacheKey = uniquePids.slice().sort().join(',');
  const cached = statsCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 1800) {
    return cached.data;
  }

  try {
    const [pidStatsRaw, winDetails] = await Promise.all([
      pidusage(uniquePids).catch(() => ({} as Record<string, any>)),
      process.platform === 'win32'
        ? getWindowsProcessDetails(uniquePids)
        : Promise.resolve({ totalPrivateMem: 0, javaPid: null, javaPath: null })
    ]);
    const pidStats = pidStatsRaw as Record<string, any>;

    let totalCpu = 0;
    let totalMem = 0;

    for (const pid of uniquePids) {
      const stat = pidStats[pid] || pidStats[String(pid)];
      if (stat) {
        totalCpu += stat.cpu || 0;
        totalMem += stat.memory || 0;
      }
    }

    let memoryBytes = totalMem;
    if (process.platform === 'win32' && winDetails.totalPrivateMem > 0) {
      memoryBytes = winDetails.totalPrivateMem;
    }

    const memoryFormatted = formatBytes(memoryBytes);

    let jvmHeap: JvmHeapStats | null = null;
    if (winDetails.javaPid) {
      jvmHeap = await queryJvmHeap(winDetails.javaPid, winDetails.javaPath);
    }

    const result: ResourceUsageStats = {
      cpu: Math.round(totalCpu * 10) / 10,
      memoryBytes,
      memoryFormatted,
      jvmHeap
    };

    statsCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  } catch {
    return { cpu: 0, memoryBytes: 0, memoryFormatted: '0 MB', jvmHeap: null };
  }
}
