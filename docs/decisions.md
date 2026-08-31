# Decisions

## Decision 1: Node's built-in `node:sqlite` over `better-sqlite3`

- **Chose:** `node:sqlite` (Node v24+ built-in), no external dependency
- **Rejected:** `better-sqlite3` (synchronous, fast, battle-tested)
- **Why:** `better-sqlite3` is a native C++ addon that requires Python and Visual Studio build tools to compile. On this development environment, `node-gyp` failed because Python was not available. Node v24 ships with a built-in SQLite module that has no native dependencies. The API is nearly identical — synchronous prepared statements, parameterized queries, WAL mode. A thin wrapper matches the calling convention. A small risk: `node:sqlite` is still flagged experimental in some Node 24 builds, but it worked without the flag in practice.

## Decision 2: Raw SQL with prepared statements over an ORM

- **Chose:** Hand-written SQL with prepared statements
- **Rejected:** Prisma, Drizzle, or Sequelize
- **Why:** The schema is small and stable. ORMs add a build step and an abstraction layer that makes complex joins (e.g. the appointment search query with dynamic filters) harder to read and debug. For this size, knowing exactly what SQL is running is more valuable than ORM-generated type safety. Every query is parameterized, so there is no SQL injection risk.

## Decision 3: JWT in localStorage over httpOnly cookies

- **Chose:** JWT stored in `localStorage`, sent as `Authorization: Bearer` header
- **Rejected:** httpOnly cookies
- **Why:** The SPA and the API run on different origins in development (port 5173 vs 3001). Setting up `SameSite=None; Secure` cookies correctly across origins adds configuration overhead. For a clinic intranet scenario the XSS risk is acceptable, and the token is short-lived (12 hours).
- **Later reversed (partially):** For a production deploy on the same origin, switching to httpOnly cookies would be straightforward and is the better security posture. I added `credentials: true` to CORS as a first step.

## Decision 4: SQLite file instead of a hosted database

- **Chose:** SQLite file persisted alongside the process
- **Rejected:** Supabase (PostgreSQL managed service, as suggested in the README)
- **Why:** For local development and evaluation, zero-setup is a significant advantage. The seed script runs with one command; the full application runs with two `npm` commands and no external accounts. The trade-off is that a cloud deployment needs a persistent disk volume. If this were production software handling real patient data, I would use PostgreSQL with encrypted backups.

## Decision 5: Status machine enforced in application code (not DB triggers)

- **Chose:** State transition logic in the Express route handler
- **Rejected:** SQLite triggers or a CHECK constraint per transition
- **Why:** The transition rules include runtime conditions — "no-show only after the slot's scheduled time" — which require `new Date()` and cannot be expressed in a SQLite CHECK constraint. Putting all rules in one place in application code is easier to read, test, and extend. Triggers would be invisible to anyone reading the route code and would produce cryptic constraint errors.

## Decision 6 (Later reversed): Single table with embedded slot data

- **Chose originally:** Embed slot date/time/provider directly on the appointment row
- **Reversed to:** A separate `slots` table where an appointment references a slot via FK
- **Why the reversal:** The original design made reassignment hard — changing provider would mean mutating the appointment row in a way that destroyed the original booking context. With a separate `slots` table, reassigning creates a new slot record for the new provider and updates `slot_id` on the appointment. The original slot is preserved, and `audit_log` records the old and new provider IDs. The separate table also enables the "unbooked slot" concept cleanly — a slot can exist without an appointment.
