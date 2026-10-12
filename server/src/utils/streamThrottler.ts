export interface LogMessage {
  timestamp: string;
  text: string;
  stream?: 'stdout' | 'stderr';
}

export interface ThrottlerOptions {
  flushIntervalMs?: number; // default: 50ms
  maxBatchSize?: number; // default: 120 lines per interval (~2400 lines/sec)
}

/**
 * StreamThrottler provides terminal output flood protection inspired by MCSManager.
 * It batches high-frequency log lines to keep WebSocket traffic and DOM rendering smooth,
 * and drops excessive lines with a notice when a server or plugin enters a log-storm loop.
 */
export class StreamThrottler {
  private buffer: LogMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private droppedCount = 0;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private onFlush: (batch: LogMessage[]) => void;

  constructor(onFlush: (batch: LogMessage[]) => void, options: ThrottlerOptions = {}) {
    this.onFlush = onFlush;
    this.flushIntervalMs = options.flushIntervalMs || 50;
    this.maxBatchSize = options.maxBatchSize || 120;
  }

  public push(text: string, stream?: 'stdout' | 'stderr'): void {
    if (this.buffer.length >= this.maxBatchSize) {
      this.droppedCount++;
      return;
    }

    this.buffer.push({
      timestamp: new Date().toISOString(),
      text,
      stream
    });

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  public flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0 && this.droppedCount === 0) {
      return;
    }

    const batch = [...this.buffer];
    this.buffer = [];

    if (this.droppedCount > 0) {
      const dropped = this.droppedCount;
      this.droppedCount = 0;
      batch.push({
        timestamp: new Date().toISOString(),
        text: `\x1b[33m[MCSPanel Áradásvédelem] Konzol logáradás észlelve: ${dropped} sor átugorva a felület stabilitásának megőrzéséhez.\x1b[0m`,
        stream: 'stderr'
      });
    }

    this.onFlush(batch);
  }

  public destroy(): void {
    this.flush();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffer = [];
    this.droppedCount = 0;
  }
}
