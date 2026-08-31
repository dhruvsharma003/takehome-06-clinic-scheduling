# AI Prompts

This project was built with significant AI assistance (IBM Bob). The following documents the key prompts used, in the order they were used, grouped by goal.

---

## Project scaffolding and tech stack selection

### Prompt
"Complete the project" — starting from a blank repo with only the README and stub docs.

### What I got
Bob began by reading the README and all stub docs, then proposed a monorepo structure with Node.js + Express + TypeScript for the backend and Vite + React + TypeScript + Tailwind for the frontend, with SQLite for the database. It laid out a full todo list of 16 tasks covering all 10 requirements.

### What I corrected
The initial plan used `better-sqlite3`. When the install failed (node-gyp couldn't find Python), Bob switched to Node v24's built-in `node:sqlite` module — a correct autonomous decision.

---

## Database schema design

### Prompt
(Implicit in the "complete the project" prompt — Bob inferred the full schema from the requirements.)

### What I got
A SQLite schema with 7 tables: `users`, `slots`, `appointments`, `care_team`, `visit_notes`, `audit_log`, `alerts`. Foreign key constraints, CHECK constraints on role and status, WAL mode, and appropriate indexes.

### What I corrected
The initial `node:sqlite` wrapper used `unknown` TypeScript types, causing build errors. Bob fixed these by defining a `SQLValue` union type matching `node:sqlite`'s expected input types.

---

## Status machine and business rules

### Prompt
(Implicit — requirement 4 in the README specifies exact transitions and conditions.)

### What I got
A `VALID_TRANSITIONS` map and a route handler that checks current status, validates the requested transition, and rejects illegal moves with descriptive error messages. "No-show only after scheduled time" implemented with a `new Date()` comparison. "Cancellation requires a reason" enforced in the request body.

### What I corrected
Nothing — the state machine was correct on first pass. Verified against the requirements spec, all cases matched.

---

## Alerts: dismiss-and-re-alert logic

### Prompt
(Implicit — requirement 10 specifies the exact re-alert rule.)

### What I got
An alerts endpoint that iterates all unconfirmed appointments within 24h of their slot, checks for dismissal records, and re-alerts if within 1h of the slot regardless of prior dismissal.

### What I corrected
The initial implementation created a new `alerts` record every call, creating duplicates. Bob fixed this by checking for an existing record first, only inserting if none existed, then updating `dismissed_at` to NULL for re-alerting instead of inserting a new row.

---

## Frontend Tailwind CSS setup (produced something wrong)

### Prompt
(Implicit — setting up Tailwind CSS v4 in the Vite project.)

### What I got
The first attempt ran `tailwindcss init -p` which is the Tailwind v3 CLI approach — but npm installed Tailwind v4, which has no CLI and uses a completely different config model (CSS-based imports and a Vite plugin).

### What I corrected
Bob corrected this by:
1. Installing `@tailwindcss/vite` and adding it as a Vite plugin
2. Replacing the old `tailwind.config.js` approach with `@import "tailwindcss"` in `index.css`
3. Removing the PostCSS config entirely (not needed with the Vite plugin)

This is the clearest example of output that was wrong and needed correction.

---

## TypeScript build errors

### Prompt
(Implicit — running `npm run build` and iterating on errors.)

### What I got
Three TypeScript errors that Bob fixed in targeted patches:
- `Argument of type 'unknown' is not assignable to 'SQLInputValue'` — fixed with `SQLValue` union type
- `'res' is declared but its value is never read` — removed the unused variable
- Missing `provider_id` property on the dashboard `by_provider` interface — added to the type definition
