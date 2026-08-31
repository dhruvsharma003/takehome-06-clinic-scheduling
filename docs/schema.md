# Schema

## Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| email | TEXT UNIQUE NOT NULL | Login identifier |
| password_hash | TEXT NOT NULL | bcrypt, cost factor 10 |
| name | TEXT NOT NULL | Display name |
| role | TEXT NOT NULL | CHECK: `front_desk` or `provider` |
| created_at | TEXT | `datetime('now')` default |

### `slots`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| provider_id | TEXT FK users.id | Which provider owns this slot |
| date | TEXT NOT NULL | ISO date string `YYYY-MM-DD` |
| start_time | TEXT NOT NULL | `HH:MM` 24-hour |
| duration_minutes | INTEGER NOT NULL | Length of the slot |
| archived | INTEGER NOT NULL DEFAULT 0 | Soft-delete flag (0/1) |
| created_by | TEXT FK users.id | Who created the slot |
| created_at | TEXT | Timestamp |
| updated_at | TEXT | Updated on every edit |

### `appointments`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| slot_id | TEXT FK slots.id | The slot this appointment occupies |
| patient_name | TEXT NOT NULL | |
| patient_email | TEXT | Optional |
| patient_phone | TEXT | Optional |
| status | TEXT NOT NULL DEFAULT 'requested' | CHECK enum (see below) |
| cancellation_reason | TEXT | Populated only when status = cancelled |
| created_at | TEXT | |
| updated_at | TEXT | |

Status CHECK: `requested`, `confirmed`, `checked_in`, `completed`, `no_show`, `cancelled`

### `care_team`
| Column | Type | Notes |
|--------|------|-------|
| appointment_id | TEXT FK appointments.id | PK part 1 |
| provider_id | TEXT FK users.id | PK part 2 |
| added_by | TEXT FK users.id | |
| added_at | TEXT | |
| removed_at | TEXT | NULL means currently active |
| removed_by | TEXT FK users.id | |

Primary key is `(appointment_id, provider_id)`, so the same provider can only be on a care team once per appointment. Soft-removal via `removed_at` preserves history.

### `visit_notes`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| appointment_id | TEXT FK appointments.id | |
| provider_id | TEXT FK users.id | Author — only this provider may edit |
| content | TEXT NOT NULL | Free text |
| created_at | TEXT | |
| updated_at | TEXT | |

### `audit_log`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| appointment_id | TEXT FK appointments.id | |
| event_type | TEXT NOT NULL | See event types below |
| actor_id | TEXT FK users.id | Who performed the action |
| old_value | TEXT | Status before, or provider ID removed |
| new_value | TEXT | Status after, or provider ID added |
| metadata | TEXT | JSON blob (e.g. cancellation reason) |
| created_at | TEXT | Immutable timestamp |

Event types: `status_change`, `care_team_added`, `care_team_removed`, `reassigned`, `visit_note_added`, `visit_note_edited`

No UPDATE or DELETE is ever run on this table. The application layer never issues such queries, and there is no endpoint for it.

### `alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| appointment_id | TEXT FK appointments.id | |
| dismissed_by | TEXT FK users.id | NULL if not dismissed |
| dismissed_at | TEXT | NULL if not dismissed |
| created_at | TEXT | |

## Relationships

| Relationship | Type |
|---|---|
| users → slots (provider) | one-to-many |
| slots → appointments | one-to-one (a slot can have at most one active appointment) |
| appointments → visit_notes | one-to-many |
| appointments ↔ providers (via care_team) | many-to-many |
| appointments → audit_log | one-to-many |

## Constraints: Database vs Application

**In the database:**
- FK constraints on all references (enforced via `PRAGMA foreign_keys = ON`)
- `role` CHECK constraint on users
- `status` CHECK constraint on appointments
- Unique index on `users.email`

**In application code:**
- Status transition logic — a CHECK constraint can't express "valid from" logic
- Role-based permission checks (providers vs front-desk) — no SQL-level row security
- "No-show only after slot time" — requires `new Date()` comparison, not expressible in SQLite CHECK
- "Cannot cancel after check-in" — covered by the state machine

## What Was Deliberately Denormalised

When an appointment is reassigned, a new slot record is created so the original slot's `provider_id` is preserved in history. This means `slots.provider_id` at the time of booking is effectively an immutable snapshot — intentional redundancy to support the audit trail.

## What Would Break First at 100x

1. The appointment search runs a full-table scan with dynamic filters — composite indexes would help but the query is already reasonably covered.
2. Dashboard aggregations run multiple COUNT queries on every page load — these could be cached at scale.
3. The "is this slot taken?" check-then-insert is not atomic. Under high concurrency, a race condition could allow double-bookings. A `BEGIN IMMEDIATE` transaction or a UNIQUE partial index on `(slot_id) WHERE status NOT IN ('cancelled')` would fix this.
