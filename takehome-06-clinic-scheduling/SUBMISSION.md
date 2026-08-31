# Submission

Clinic Scheduling System — a full-stack appointment management platform.

## Links

- **GitHub repository:** https://github.com/dhruvsharma003/takehome-06-clinic-scheduling/tree/master
- **Live application:** (https://takehome-06-clinic-scheduling-6iyq.vercel.app)


## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Front Desk | frontdesk@clinic.com | frontdesk123 |
| Front Desk | frontdesk2@clinic.com | frontdesk123 |
| Provider | dr.chen@clinic.com | provider123 |
| Provider | dr.patel@clinic.com | provider123 |
| Provider | dr.morgan@clinic.com | provider123 |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 19 + TypeScript + Vite + React Router v6 + TailwindCSS v4 + Recharts | React is industry standard for SPAs; TypeScript catches bugs early; Vite is fast; TailwindCSS for styling; Recharts for charts |
| Backend | Express 4 + TypeScript + Node.js v24 | Express is lightweight and proven; TypeScript for type safety; Node.js v24 has built-in sqlite3 (no native compilation required) |
| Database | SQLite via `node:sqlite` (built-in to Node v24) | No external DB server needed; built-in to Node; perfect for this scale; immutable audit logs via append-only table |
| Hosting | Node.js (development); Render + Vercel (production ready) | Can run anywhere Node.js runs; deployment instructions provided for Render + Vercel |

## Goal checklist

All 10 required goals fully implemented:

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | JWT auth with `front_desk` and `provider` roles, enforced server-side on every route |
| 2 | Appointment slots | Done | Create, edit (unbooked only), archive/restore, bulk-generate with collision detection |
| 3 | Visit notes | Done | Per-appointment, provider-authored, editable only by author; all changes audit-logged |
| 4 | Appointment status machine | Done | `requested→confirmed→checked_in→completed/no_show/cancelled` with full constraint enforcement |
| 5 | Care team | Done | Add/remove supporting providers; every provider sees appointments they're assigned to |
| 6 | Server-side search | Done | Text search, filters (status, provider, date range), sorting, pagination with total count |
| 7 | Bulk availability generation | Done | Collision detection + report; CSV export of single day's schedule |
| 8 | Dashboard | Done | Stat cards, by-provider table, by-status bar chart, 8-week no-show rate line chart |
| 9 | Immutable history | Done | `audit_log` table append-only; no UPDATE/DELETE endpoint exists for it |
| 10 | Unconfirmed alerts | Done | 24h pre-appointment alerts with dismiss + mandatory re-alert within 1h |

## How much time did you actually spend?

**~10.5 hours** across 5 sessions:
- Session 1 (~2h): Schema design, monorepo setup, database initialization, auth, JWT middleware
- Session 2 (~2h): Slots CRUD, appointments engine, status machine, server-side search
- Session 3 (~2h): Visit notes, care team, dashboard aggregations, alerts, CSV export
- Session 4 (~3h): Complete React frontend with all pages, forms, and charts
- Session 5 (~1h): Documentation and final verification

## What would you do next, with another 12 hours?

1. **Automated test suite** (3h) — Jest + Supertest for backend routes; React Testing Library for frontend components
2. **Recurring appointments** (2.5h) — Template system with exception handling
3. **Patient-facing booking** (2.5h) — Public slot availability view + self-booking (with staff approval)
4. **Email digest** (2h) — Aggregate alerts into a daily summary email
5. **Pagination on slots page** (1.5h) — Currently filters by date only, but could paginate across multiple dates
6. **Performance optimizations** (0.5h) — Query indexing, client-side caching, lazy loading

## What are you least happy with in this codebase, and why?

1. **Frontend API client** — Currently uses a simple `axios` instance with hardcoded error handling. Would benefit from a proper error boundary component and retry logic for failed requests.

2. **No input validation library** — The backend validates manually in each route. Would use a schema validator like `zod` or `joi` to centralize and reduce duplication.

3. **Care team UI complexity** — The appointment detail page is feature-rich but could be split into smaller components for better maintainability.

4. **Hardcoded business logic in routes** — Status transitions and alert re-alert logic are inline in route handlers. Would extract into service layer for reusability and testability.

5. **No database migrations system** — The schema is initialized from scratch on seed. A real app would need Liquibase or similar for schema versioning.

Overall, the codebase is solid for a takehome project but would benefit from:
- Automated tests (biggest gap)
- Schema validation library
- Service/repository layer abstraction
- Error handling strategy

The core functionality is robust and all requirements are met.
