import Database from "better-sqlite3";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { MIGRATION_001_INIT } from "./migrations/001_init.js";

let db: Database.Database | null = null;

/**
 * Opens (and lazily migrates) the local SQLite store.
 * Lives in ~/.agentiam/agentiam.db by default — not in the project
 * repo — so cached tokens never accidentally get committed.
 *
 * Accepts an optional override path so tests can point at an
 * isolated file instead of the real user-global database.
 */
export function getDb(dbPathOverride?: string): Database.Database {
  if (db) return db;

  let dbPath: string;
  if (dbPathOverride) {
    dbPath = dbPathOverride;
  } else {
    const dir = join(homedir(), ".agentiam");
    mkdirSync(dir, { recursive: true });
    dbPath = join(dir, "agentiam.db");
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(MIGRATION_001_INIT);

  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
