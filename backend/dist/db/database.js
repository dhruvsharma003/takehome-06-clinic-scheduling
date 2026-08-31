"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore — node:sqlite is built into Node v22.5+
const node_sqlite_1 = require("node:sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_PATH = process.env.DB_PATH || path_1.default.join(__dirname, '../../data/clinic.db');
// Ensure data directory exists
const dataDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const db = new node_sqlite_1.DatabaseSync(DB_PATH);
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
const dbWrapper = {
    prepare(sql) {
        const stmt = db.prepare(sql);
        return {
            all(...params) {
                // node:sqlite DatabaseSync uses positional array, not spread
                return (params.length ? stmt.all(...params) : stmt.all());
            },
            get(...params) {
                return (params.length ? stmt.get(...params) : stmt.get());
            },
            run(...params) {
                return (params.length ? stmt.run(...params) : stmt.run());
            },
        };
    },
    exec(sql) {
        db.exec(sql);
    },
};
// Auto-seed database if empty (for Render free tier without Shell access)
const userCount = dbWrapper.prepare('SELECT COUNT(*) as count FROM users').get();
if (!userCount || userCount.count === 0) {
    console.log('Database is empty, auto-seeding...');
    seedDatabase(dbWrapper);
}
// Auto-seeding function
function seedDatabase(db) {
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcryptjs');
    // Clear existing data
    db.exec(`
    DELETE FROM audit_log;
    DELETE FROM alerts;
    DELETE FROM visit_notes;
    DELETE FROM care_team;
    DELETE FROM appointments;
    DELETE FROM slots;
    DELETE FROM users;
  `);
    // Users
    const frontDeskId = uuidv4();
    const fd2Id = uuidv4();
    const provider1Id = uuidv4();
    const provider2Id = uuidv4();
    const provider3Id = uuidv4();
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(frontDeskId, 'frontdesk@clinic.com', hash('frontdesk123'), 'Alex Johnson', 'front_desk');
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(fd2Id, 'frontdesk2@clinic.com', hash('frontdesk123'), 'Sam Rivera', 'front_desk');
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(provider1Id, 'dr.chen@clinic.com', hash('provider123'), 'Dr. Lisa Chen', 'provider');
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(provider2Id, 'dr.patel@clinic.com', hash('provider123'), 'Dr. Raj Patel', 'provider');
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(provider3Id, 'dr.morgan@clinic.com', hash('provider123'), 'Dr. Taylor Morgan', 'provider');
    // Helper to get date offset from today
    function dateOffset(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    }
    // Create slots across multiple days
    const slotData = [
        // Today
        { providerId: provider1Id, date: dateOffset(0), time: '09:00', duration: 30 },
        { providerId: provider1Id, date: dateOffset(0), time: '09:30', duration: 30 },
        { providerId: provider1Id, date: dateOffset(0), time: '10:00', duration: 45 },
        { providerId: provider1Id, date: dateOffset(0), time: '11:00', duration: 30 },
        { providerId: provider1Id, date: dateOffset(0), time: '14:00', duration: 60 },
        { providerId: provider2Id, date: dateOffset(0), time: '08:30', duration: 30 },
        { providerId: provider2Id, date: dateOffset(0), time: '09:00', duration: 30 },
        { providerId: provider2Id, date: dateOffset(0), time: '10:00', duration: 45 },
        // Tomorrow
        { providerId: provider1Id, date: dateOffset(1), time: '09:00', duration: 45 },
        { providerId: provider3Id, date: dateOffset(1), time: '13:00', duration: 30 },
        { providerId: provider2Id, date: dateOffset(1), time: '10:00', duration: 60 },
        // Day after
        { providerId: provider1Id, date: dateOffset(2), time: '14:00', duration: 30 },
        { providerId: provider3Id, date: dateOffset(2), time: '09:00', duration: 45 },
    ];
    slotData.forEach(({ providerId, date, time, duration }) => {
        db.prepare(`
      INSERT INTO slots (id, provider_id, date, start_time, duration_minutes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), providerId, date, time, duration, frontDeskId);
    });
    console.log('✅ Database seeded successfully!');
    console.log('\nDemo credentials:');
    console.log('  Front-desk: frontdesk@clinic.com / frontdesk123');
    console.log('  Front-desk: frontdesk2@clinic.com / frontdesk123');
    console.log('  Provider:   dr.chen@clinic.com / provider123');
    console.log('  Provider:   dr.patel@clinic.com / provider123');
    console.log('  Provider:   dr.morgan@clinic.com / provider123');
}
exports.default = dbWrapper;
