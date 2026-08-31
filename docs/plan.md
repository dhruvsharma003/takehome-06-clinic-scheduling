# Plan

## How I Split the Work

I worked in roughly 2-hour sessions, in this order:

### Session 1 (~2h): Foundation
- Defined the full schema, mapping every requirement to tables and columns
- Set up the monorepo structure: `backend/` (Node + Express + TypeScript) and `frontend/` (Vite + React)
- Chose `node:sqlite` (Node v24 built-in) after discovering `better-sqlite3` couldn't compile without Python/node-gyp on this environment
- Built the database initialization, bcrypt-based auth, JWT middleware, and `/auth/login` endpoint
- Wrote the seed script with a realistic set of users, slots, appointments, and history

### Session 2 (~2h): Backend core
- Slots CRUD: create, edit (unbooked only), archive/restore, bulk-generate
- Appointments: book, status machine, server-side search with all filters, pagination, sorting
- Reassignment (front-desk only)
- All role enforcement on the server

### Session 3 (~2h): Backend extras
- Visit notes: add, edit by author only; every action appended to audit_log
- Care team: add/remove supporting providers
- Dashboard aggregations: today's counts, no-show trend, by-provider breakdown
- Alerts: dynamic re-alert logic
- CSV export for a single day's schedule

### Session 4 (~3h): Frontend
- React SPA with react-router-dom v6, axios, date-fns, recharts, TailwindCSS v4
- Login page with quick-fill demo credentials
- Dashboard with stat cards, status bar chart, no-show line chart, provider table
- Appointments list: server-side search/filter/sort/paginate
- Appointment detail: status machine buttons, visit notes, care team, reassign, timeline
- Slots page: day-view cards, edit modal, archive/restore, CSV export
- New slot form, bulk generate form, alerts page

### Session 5 (~1h): Docs and cleanup
- Filled in all five documentation files
- SUBMISSION.md with demo credentials and run instructions
- Final build verification

## Estimated vs Actual

| Task | Estimate | Actual |
|------|----------|--------|
| Schema + DB setup | 30 min | 45 min (node:sqlite discovery) |
| Auth + middleware | 30 min | 25 min |
| Slots + appointments backend | 90 min | 100 min |
| Dashboard + alerts + CSV | 45 min | 50 min |
| React frontend (all pages) | 3h | 3h 30 min |
| Seed data + docs | 45 min | 45 min |

Total: ~10.5 hours

## What I Cut When Running Short

- **Recurring appointments** — stretch goal, not required
- **Patient-facing booking view** — stretch goal
- **Email digest** — stretch goal; the alerts page covers the use case in-UI
- **Pagination on slots page** — slots are filtered by date so the result set is always small
- **Automated test suite** — validated manually via the seed data and the running frontend; automated tests would be next
