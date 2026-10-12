export interface ResourceHistoryPoint {
  timestamp: number; // unix milliseconds
  time: string; // HH:mm:ss
  cpu: number; // percent (0-100+)
  memoryBytes: number;
  memoryMB: number; // Megabytes
}

/**
 * ResourceHistoryTracker maintains a rolling time-series window of CPU and RAM usage,
 * inspired by MCSManager's VisualDataSubsystem LineQueue.
 */
export class ResourceHistoryTracker {
  private readonly maxSize: number;
  private queue: ResourceHistoryPoint[] = [];

  constructor(maxSize = 60) {
    this.maxSize = maxSize;
  }

  public push(point: { cpu: number; memoryBytes: number; timestamp?: number }): ResourceHistoryPoint {
    const ts = point.timestamp || Date.now();
    const d = new Date(ts);
    const time = d.toTimeString().split(' ')[0];
    const memoryMB = Math.round(point.memoryBytes / (1024 * 1024));
    const cpu = Number(point.cpu.toFixed(1));

    const item: ResourceHistoryPoint = {
      timestamp: ts,
      time,
      cpu,
      memoryBytes: point.memoryBytes,
      memoryMB
    };

    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }
    this.queue.push(item);

    return item;
  }

  public getHistory(): ResourceHistoryPoint[] {
    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
  }
}
