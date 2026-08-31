// @ts-ignore — node:sqlite is built into Node v22.5+
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/clinic.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('front_desk', 'provider')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    slot_id TEXT NOT NULL REFERENCES slots(id),
    patient_name TEXT NOT NULL,
    patient_email TEXT,
    patient_phone TEXT,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK(status IN ('requested','confirmed','checked_in','completed','no_show','cancelled')),
    cancellation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS care_team (
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    provider_id TEXT NOT NULL REFERENCES users(id),
    added_by TEXT NOT NULL REFERENCES users(id),
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    removed_at TEXT,
    removed_by TEXT REFERENCES users(id),
    PRIMARY KEY (appointment_id, provider_id)
  );

  CREATE TABLE IF NOT EXISTS visit_notes (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    provider_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES users(id),
    old_value TEXT,
    new_value TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    dismissed_by TEXT REFERENCES users(id),
    dismissed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_slots_provider_date ON slots(provider_id, date);
  CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
  CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments(slot_id);
  CREATE INDEX IF NOT EXISTS idx_audit_appointment ON audit_log(appointment_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_care_team_provider ON care_team(provider_id);
`);

// Wrap node:sqlite to provide a compatible synchronous API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLValue = null | string | number | bigint | Uint8Array;

type Row = Record<string, SQLValue>;

interface PreparedStatement {
  all: (...params: SQLValue[]) => Row[];
  get: (...params: SQLValue[]) => Row | undefined;
  run: (...params: SQLValue[]) => { changes: number; lastInsertRowid: number | bigint };
}

interface DBWrapper {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => void;
}

const dbWrapper: DBWrapper = {
  prepare(sql: string): PreparedStatement {
    const stmt = db.prepare(sql);
    return {
      all(...params: SQLValue[]): Row[] {
        // node:sqlite DatabaseSync uses positional array, not spread
        return (params.length ? stmt.all(...(params as any)) : stmt.all()) as Row[];
      },
      get(...params: SQLValue[]): Row | undefined {
        return (params.length ? stmt.get(...(params as any)) : stmt.get()) as Row | undefined;
      },
      run(...params: SQLValue[]): { changes: number; lastInsertRowid: number | bigint } {
        return (params.length ? stmt.run(...(params as any)) : stmt.run()) as { changes: number; lastInsertRowid: number | bigint };
      },
    };
  },
  exec(sql: string): void {
    db.exec(sql);
  },
};

export default dbWrapper;
