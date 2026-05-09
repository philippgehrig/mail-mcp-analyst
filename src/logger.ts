type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel): Logger {
  const minLevel = LEVELS[level];

  function log(lvl: LogLevel, msg: string, extra?: Record<string, unknown>) {
    if (LEVELS[lvl] < minLevel) return;
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...extra,
    });
    process.stdout.write(entry + "\n");
  }

  return {
    debug: (msg, extra) => log("debug", msg, extra),
    info: (msg, extra) => log("info", msg, extra),
    warn: (msg, extra) => log("warn", msg, extra),
    error: (msg, extra) => log("error", msg, extra),
  };
}
