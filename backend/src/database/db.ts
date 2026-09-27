import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schemaSql.js';

dotenv.config();

const DB_PATH = process.env.DATABASE_PATH || (process.env.VERCEL ? '/tmp/agrivault.db' : './data/agrivault.db');

// Ensure directory exists
const dir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

let dbInstance: DatabaseSync | null = null;
let isInitializing = false;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(path.resolve(DB_PATH));
    // Enable WAL mode for high concurrency
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');

    if (!isInitializing) {
      isInitializing = true;
      try {
        const check = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='esp_devices'").get();
        if (!check) {
          const schemaPath = path.resolve(__dirname, 'schema.sql');
          if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            dbInstance.exec(schemaSql);
          } else {
            dbInstance.exec(SCHEMA_SQL);
          }
          console.log('[Database] Auto-initialized schema on first connection.');
        }
      } catch (err) {
        console.warn('[Database] Auto-schema init check:', err);
      } finally {
        isInitializing = false;
      }
    }
  }
  return dbInstance;
}

export const db = {
  all<T = any>(sql: string, ...params: any[]): T[] {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.all(...params) as T[];
  },

  get<T = any>(sql: string, ...params: any[]): T | undefined {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.get(...params) as T | undefined;
  },

  run(sql: string, ...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.run(...params);
  },

  exec(sql: string): void {
    const database = getDatabase();
    database.exec(sql);
  },

  transaction<T>(fn: () => T): T {
    const database = getDatabase();
    database.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      database.exec('COMMIT;');
      return result;
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }
};

export function initDatabase(): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    getDatabase().exec(schemaSql);
    console.log('[Database] Schema verified and initialized successfully from schema.sql.');
  } else {
    getDatabase().exec(SCHEMA_SQL);
    console.log('[Database] Schema verified and initialized successfully from embedded schema.');
  }
}

