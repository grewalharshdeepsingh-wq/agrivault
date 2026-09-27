"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.isVercel = void 0;
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const schemaSql_js_1 = require("./schemaSql.js");
dotenv_1.default.config();
exports.isVercel = Boolean(process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_REGION ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION);
const DB_PATH = process.env.DATABASE_PATH || (exports.isVercel ? '/tmp/agrivault.db' : './data/agrivault.db');
// Ensure database directory exists safely without crashing on read-only environments
try {
    const dir = node_path_1.default.dirname(node_path_1.default.resolve(DB_PATH));
    if (!node_fs_1.default.existsSync(dir)) {
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
catch {
    // Read-only filesystem or restricted environment
}
let dbInstance = null;
let initPromise = null;
function saveSqlJsToFile(sqlDb) {
    try {
        const data = sqlDb.export();
        node_fs_1.default.writeFileSync(node_path_1.default.resolve(DB_PATH), Buffer.from(data));
    }
    catch {
        // In serverless, filesystem writes may be limited
    }
}
function ensureSchema(database) {
    try {
        const check = database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='esp_devices'");
        if (!check) {
            database.exec(schemaSql_js_1.SCHEMA_SQL);
            console.log('[Database] Schema verified and initialized successfully from embedded schema.');
        }
    }
    catch (err) {
        console.warn('[Database] Schema check notice:', err?.message || err);
    }
}
function createSqlJsWrapper(sqlDb) {
    return {
        all(sql, ...params) {
            const stmt = sqlDb.prepare(sql);
            const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
            if (flatParams.length > 0)
                stmt.bind(flatParams);
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            return rows;
        },
        get(sql, ...params) {
            const stmt = sqlDb.prepare(sql);
            const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
            if (flatParams.length > 0)
                stmt.bind(flatParams);
            let row = undefined;
            if (stmt.step()) {
                row = stmt.getAsObject();
            }
            stmt.free();
            return row;
        },
        run(sql, ...params) {
            const stmt = sqlDb.prepare(sql);
            const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
            stmt.run(flatParams);
            stmt.free();
            saveSqlJsToFile(sqlDb);
            const res = sqlDb.exec('SELECT last_insert_rowid() as id, changes() as ch');
            const lastInsertRowid = res[0]?.values[0]?.[0] ?? 0;
            const changes = res[0]?.values[0]?.[1] ?? 0;
            return { changes, lastInsertRowid };
        },
        exec(sql) {
            sqlDb.exec(sql);
            saveSqlJsToFile(sqlDb);
        },
        prepare(sql) {
            return {
                all: (...p) => this.all(sql, ...p),
                get: (...p) => this.get(sql, ...p),
                run: (...p) => this.run(sql, ...p)
            };
        },
        transaction(fn) {
            sqlDb.exec('BEGIN TRANSACTION;');
            try {
                const res = fn();
                sqlDb.exec('COMMIT;');
                saveSqlJsToFile(sqlDb);
                return res;
            }
            catch (e) {
                sqlDb.exec('ROLLBACK;');
                throw e;
            }
        }
    };
}
function tryLoadNativeSqlite() {
    if (exports.isVercel) {
        // Avoid attempting native node:sqlite on Vercel
        return false;
    }
    try {
        const req = typeof require !== 'undefined' ? require : null;
        if (!req)
            return false;
        const nodeSqlite = req('node:sqlite');
        if (nodeSqlite && nodeSqlite.DatabaseSync) {
            const nativeDb = new nodeSqlite.DatabaseSync(node_path_1.default.resolve(DB_PATH));
            nativeDb.exec('PRAGMA journal_mode = WAL;');
            nativeDb.exec('PRAGMA synchronous = NORMAL;');
            nativeDb.exec('PRAGMA foreign_keys = ON;');
            dbInstance = {
                all(sql, ...params) {
                    const stmt = nativeDb.prepare(sql);
                    return stmt.all(...params);
                },
                get(sql, ...params) {
                    const stmt = nativeDb.prepare(sql);
                    return stmt.get(...params);
                },
                run(sql, ...params) {
                    const stmt = nativeDb.prepare(sql);
                    return stmt.run(...params);
                },
                exec(sql) {
                    nativeDb.exec(sql);
                },
                prepare(sql) {
                    return nativeDb.prepare(sql);
                },
                transaction(fn) {
                    nativeDb.exec('BEGIN TRANSACTION;');
                    try {
                        const res = fn();
                        nativeDb.exec('COMMIT;');
                        return res;
                    }
                    catch (e) {
                        nativeDb.exec('ROLLBACK;');
                        throw e;
                    }
                }
            };
            console.log('[Database] Connected via native node:sqlite engine.');
            return true;
        }
    }
    catch {
        // Native node:sqlite not supported in this runtime
    }
    return false;
}
async function initDatabase() {
    if (dbInstance)
        return dbInstance;
    if (initPromise)
        return initPromise;
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
        let fileBuffer = null;
        if (node_fs_1.default.existsSync(node_path_1.default.resolve(DB_PATH))) {
            try {
                fileBuffer = node_fs_1.default.readFileSync(node_path_1.default.resolve(DB_PATH));
            }
            catch {
                // ignore
            }
        }
        const sqlDb = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
        dbInstance = createSqlJsWrapper(sqlDb);
        console.log('[Database] Connected via portable sql.js engine.');
        ensureSchema(dbInstance);
        return dbInstance;
    })();
    return initPromise;
}
function getDatabase() {
    if (!dbInstance) {
        if (tryLoadNativeSqlite() && dbInstance) {
            ensureSchema(dbInstance);
            return dbInstance;
        }
        throw new Error('Database is initializing. Ensure initDatabase() is awaited before queries.');
    }
    return dbInstance;
}
exports.db = {
    all(sql, ...params) {
        return getDatabase().all(sql, ...params);
    },
    get(sql, ...params) {
        return getDatabase().get(sql, ...params);
    },
    run(sql, ...params) {
        return getDatabase().run(sql, ...params);
    },
    exec(sql) {
        getDatabase().exec(sql);
    },
    prepare(sql) {
        return getDatabase().prepare(sql);
    },
    transaction(fn) {
        return getDatabase().transaction(fn);
    }
};
