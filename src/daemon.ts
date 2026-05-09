import type { Pipeline } from "./pipeline.js";
import type { Logger } from "./logger.js";

export class Daemon {
  private pipeline: Pipeline;
  private logger: Logger;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(pipeline: Pipeline, logger: Logger, intervalMs = 30000) {
    this.pipeline = pipeline;
    this.logger = logger;
    this.intervalMs = intervalMs;
  }

  start(): void {
    this.running = true;
    this.logger.info("Daemon started", { intervalMs: this.intervalMs });
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Daemon stopped");
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    try {
      await this.pipeline.processOnce();
    } catch (err) {
      this.logger.error("Daemon poll error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(s|m|h)$/);
  if (!match) return 30000;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    default: return 30000;
  }
}
