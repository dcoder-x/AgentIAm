#!/usr/bin/env node
import "dotenv/config";
import { loadConfig, ConfigError } from "./config/loader.js";
import { startServer } from "./server/mcpServer.js";
import { closeDb } from "./storage/db.js";
import { logger } from "./logger.js";
import { runInit, InitError } from "./cli/init.js";

async function main() {
  if (process.argv[2] === "init") {
    try {
      runInit();
      console.error(
        "[agentiam] Created agentiam.config.yaml — edit it, then set your role secrets as env vars, then run agentiam."
      );
      process.exit(0);
    } catch (err) {
      if (err instanceof InitError) {
        console.error(`[agentiam] ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
  }

  const configPathArg = process.argv.find((a) => a.startsWith("--config="));
  const configPath = configPathArg ? configPathArg.split("=")[1] : "./agentiam.config.yaml";

  try {
    const config = loadConfig(configPath);
    logger.info("server starting", { configPath });
    const server = await startServer(config);
    logger.info("server ready");

    // Note: on Windows, SIGTERM/SIGINT delivered programmatically (e.g. by
    // a parent process managing this as a child, which is how an MCP
    // client typically runs it) may not reliably trigger these handlers —
    // a Node.js/Windows platform limitation, not specific to AgentIAm.
    // Ctrl+C at an interactive terminal works reliably on all platforms.
    // SQLite's WAL mode means an unclean exit is still safe, just not
    // graceful — no data loss either way.
    const shutdown = async (signal: string) => {
      logger.info("shutting down", { signal });
      try {
        await server.close(); // also closes the stdio transport
      } finally {
        closeDb();
        process.exit(0);
      }
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[agentiam] Config error:\n${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
