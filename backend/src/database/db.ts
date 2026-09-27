import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schemaSql.js';

dotenv.config();

export const isVercel = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.VERCEL_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NOW_REGION
);

function findWorkspaceRoot(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'frontend')) && fs.existsSync(path.join(dir, 'backend'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function getResolvedDbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (isVercel) return '/tmp/agrivault.db';

  const root = findWorkspaceRoot();
  return path.resolve(root, 'data', 'agrivault.db');
}

const DB_PATH = getResolvedDbPath();

// Ensure database directory exists safely without crashing on read-only environments
try {
  const dir = path.dirname(path.resolve(DB_PATH));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch {
  // Read-only filesystem or restricted environment
}

export interface UniversalDatabase {
  all<T = any>(sql: string, ...params: any[]): T[];
  get<T = any>(sql: string, ...params: any[]): T | undefined;
  run(sql: string, ...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  exec(sql: string): void;
  prepare(sql: string): any;
  transaction<T>(fn: () => T): T;
}

let dbInstance: UniversalDatabase | null = null;
let initPromise: Promise<UniversalDatabase> | null = null;

let isInsideTransaction = false;
let saveTimeout: NodeJS.Timeout | null = null;

function scheduleSave(sqlDb: any): void {
  if (isInsideTransaction) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const filePath = path.resolve(DB_PATH);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = sqlDb.export();
      fs.writeFileSync(filePath, Buffer.from(data));
    } catch {
      // In serverless, filesystem writes may be limited
    }
  }, 500);
}

function ensureSchema(database: UniversalDatabase): void {
  try {
    const check = database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='esp_devices'");
    if (!check) {
      database.exec(SCHEMA_SQL);
      console.log('[Database] Schema verified and initialized successfully from embedded schema.');
    }
  } catch (err: any) {
    console.warn('[Database] Schema check notice:', err?.message || err);
  }
}

function createSqlJsWrapper(sqlDb: any): UniversalDatabase {
  return {
    all<T = any>(sql: string, ...params: any[]): T[] {
      const stmt = sqlDb.prepare(sql);
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flatParams.length > 0) stmt.bind(flatParams);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    },
    get<T = any>(sql: string, ...params: any[]): T | undefined {
      const stmt = sqlDb.prepare(sql);
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flatParams.length > 0) stmt.bind(flatParams);
      let row: T | undefined = undefined;
      if (stmt.step()) {
        row = stmt.getAsObject() as T;
      }
      stmt.free();
      return row;
    },
    run(sql: string, ...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
      const stmt = sqlDb.prepare(sql);
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      stmt.run(flatParams);
      stmt.free();
      let lastInsertRowid = 0;
      let changes = 0;
      try {
        const res = sqlDb.exec('SELECT last_insert_rowid() as id, changes() as ch');
        lastInsertRowid = res[0]?.values[0]?.[0] ?? 0;
        changes = res[0]?.values[0]?.[1] ?? 0;
      } catch {
        // ignore
      }
      scheduleSave(sqlDb);
      return { changes, lastInsertRowid };
    },
    exec(sql: string): void {
      sqlDb.exec(sql);
      scheduleSave(sqlDb);
    },
    prepare(sql: string) {
      return {
        all: (...p: any[]) => this.all(sql, ...p),
        get: (...p: any[]) => this.get(sql, ...p),
        run: (...p: any[]) => this.run(sql, ...p)
      };
    },
    transaction<T>(fn: () => T): T {
      isInsideTransaction = true;
      sqlDb.exec('BEGIN TRANSACTION;');
      try {
        const res = fn();
        sqlDb.exec('COMMIT;');
        isInsideTransaction = false;
        scheduleSave(sqlDb);
        return res;
      } catch (e) {
        sqlDb.exec('ROLLBACK;');
        isInsideTransaction = false;
        throw e;
      }
    }
  };
}

function tryLoadNativeSqlite(): boolean {
  if (isVercel) {
    // Avoid attempting native node:sqlite on Vercel
    return false;
  }
  try {
    const req = typeof require !== 'undefined' ? require : null;
    if (!req) return false;
    const nodeSqlite = req('node:sqlite');
    if (nodeSqlite && nodeSqlite.DatabaseSync) {
      const nativeDb = new nodeSqlite.DatabaseSync(path.resolve(DB_PATH));
      nativeDb.exec('PRAGMA journal_mode = WAL;');
      nativeDb.exec('PRAGMA synchronous = NORMAL;');
      nativeDb.exec('PRAGMA foreign_keys = ON;');

      dbInstance = {
        all<T = any>(sql: string, ...params: any[]): T[] {
          const stmt = nativeDb.prepare(sql);
          return stmt.all(...params) as T[];
        },
        get<T = any>(sql: string, ...params: any[]): T | undefined {
          const stmt = nativeDb.prepare(sql);
          return stmt.get(...params) as T | undefined;
        },
        run(sql: string, ...params: any[]) {
          const stmt = nativeDb.prepare(sql);
          return stmt.run(...params);
        },
        exec(sql: string): void {
          nativeDb.exec(sql);
        },
        prepare(sql: string) {
          return nativeDb.prepare(sql);
        },
        transaction<T>(fn: () => T): T {
          nativeDb.exec('BEGIN TRANSACTION;');
          try {
            const res = fn();
            nativeDb.exec('COMMIT;');
            return res;
          } catch (e) {
            nativeDb.exec('ROLLBACK;');
            throw e;
          }
        }
      };

      console.log('[Database] Connected via native node:sqlite engine.');
      return true;
    }
  } catch {
    // Native node:sqlite not supported in this runtime
  }
  return false;
}

export async function initDatabase(): Promise<UniversalDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Try native node:sqlite first (local environment)
    if (tryLoadNativeSqlite() && dbInstance) {
      ensureSchema(dbInstance);
      return dbInstance;
    }

    // 2. Portable WebAssembly/JS fallback using sql.js (Vercel & serverless)
    console.log('[Database] Initializing portable SQLite engine (sql.js)...');
    const initSqlJs = require('sql.js/dist/sql-asm.js');
    const SQL = await initSqlJs();

    let fileBuffer: Buffer | null = null;
    if (fs.existsSync(path.resolve(DB_PATH))) {
      try {
        fileBuffer = fs.readFileSync(path.resolve(DB_PATH));
      } catch {
        // ignore
      }
    }

    let sqlDb: any;
    if (fileBuffer && fileBuffer.length > 0) {
      try {
        sqlDb = new SQL.Database(fileBuffer);
        sqlDb.exec('SELECT 1;');
      } catch (err: any) {
        console.warn('[Database] Existing database buffer incompatible or corrupted, starting fresh database:', err?.message || err);
        sqlDb = new SQL.Database();
      }
    } else {
      sqlDb = new SQL.Database();
    }
    dbInstance = createSqlJsWrapper(sqlDb);
    console.log('[Database] Connected via portable sql.js engine.');
    ensureSchema(dbInstance);
    return dbInstance;
  })();

  return initPromise;
}

export function getDatabase(): UniversalDatabase {
  if (!dbInstance) {
    if (tryLoadNativeSqlite() && dbInstance) {
      ensureSchema(dbInstance);
      return dbInstance;
    }
    throw new Error('Database is initializing. Ensure initDatabase() is awaited before queries.');
  }
  return dbInstance;
}

export const db: UniversalDatabase = {
  all<T = any>(sql: string, ...params: any[]): T[] {
    return getDatabase().all<T>(sql, ...params);
  },
  get<T = any>(sql: string, ...params: any[]): T | undefined {
    return getDatabase().get<T>(sql, ...params);
  },
  run(sql: string, ...params: any[]) {
    return getDatabase().run(sql, ...params);
  },
  exec(sql: string): void {
    getDatabase().exec(sql);
  },
  prepare(sql: string) {
    return getDatabase().prepare(sql);
  },
  transaction<T>(fn: () => T): T {
    return getDatabase().transaction(fn);
  }
};
