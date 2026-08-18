#!/usr/bin/env node
import "dotenv/config";
import { loadConfig, ConfigError } from "./config/loader.js";
import { startServer } from "./server/mcpServer.js";

async function main() {
  const configPathArg = process.argv.find((a) => a.startsWith("--config="));
  const configPath = configPathArg ? configPathArg.split("=")[1] : "./agentiam.config.yaml";

  try {
    const config = loadConfig(configPath);
    await startServer(config);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[agentiam] Config error:\n${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
