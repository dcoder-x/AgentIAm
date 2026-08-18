// Minimal stderr JSON-lines logger. Never writes to stdout — stdout is
// the MCP stdio JSON-RPC channel, and a stray write there would corrupt
// the protocol stream.

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  process.stderr.write(JSON.stringify(line) + "\n");
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
