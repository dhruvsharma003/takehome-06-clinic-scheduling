# Architecture

## Moving Pieces

The system has three main pieces:

1. **SQLite database** — a single `clinic.db` file managed by Node's built-in `node:sqlite` module. No external database server required; the file lives on disk alongside the API process.

2. **Express API (Node.js / TypeScript)** — a REST API that runs on port 3001. It handles authentication, all business logic, role enforcement, and direct SQL queries via prepared statements. There is no ORM.

3. **React SPA (Vite + TypeScript + Tailwind CSS)** — a browser-side single-page application that runs on port 5173 (dev) or is served as static files in production. It talks exclusively to the API using axios, with JWT tokens stored in `localStorage`.

```
Browser (React SPA)
     │  HTTP/JSON (JWT Bearer)
     ▼
Express API (Node 24, port 3001)
     │  node:sqlite
     ▼
SQLite file (data/clinic.db)
```

## Where Each Piece Runs

| Piece | Dev | Production target |
|-------|-----|-------------------|
| API | `backend/` on port 3001 | Render.com (free tier) |
| SPA | `frontend/` on port 5173 (Vite HMR) | Vercel / Render static |
| DB | `data/clinic.db` file | Persisted volume on Render |

## Request Path: Front-desk confirms an appointment

1. Front-desk staff clicks "→ confirmed" on the appointment detail page.
2. The React component calls `PATCH /api/appointments/:id/status` with `{ status: 'confirmed' }`, including a `Bearer <jwt>` header.
3. Express routes the request to the `appointments` router's `/:id/status` handler.
4. The `authenticate` middleware verifies the JWT, decodes the payload, and attaches `req.user`.
5. The handler loads the appointment from SQLite (join with slots to get provider_id and date).
6. It checks the current status (`requested`) is in `VALID_TRANSITIONS['confirmed']` — it is.
7. It runs `UPDATE appointments SET status = 'confirmed' ...`.
8. It inserts a row into `audit_log` with `event_type = 'status_change'`, `old_value = 'requested'`, `new_value = 'confirmed'`, and the actor's user ID.
9. It returns the updated appointment as JSON.
10. The React component re-fetches the appointment and re-renders the status badge.

## What Was Decided Not to Build

- **Recurring appointments** — each appointment is a standalone record. Recurrence would require a separate scheduling engine and complicates cancellation semantics. Not needed for core goals.
- **Patient accounts** — patients are stored as name/email/phone on the appointment record, not as first-class users who can log in. A patient-facing portal was listed as a stretch goal and was deliberately skipped.
- **Email/SMS reminders** — no outbound messaging is wired. The alert system surfaces unconfirmed appointments in the UI; actual messaging would require an email service and is a stretch goal.
- **Room/equipment assignment** — slots have a provider and a time, but no room column. Adding a rooms table would be a small schema change that wasn't required.
- **WebSocket real-time updates** — the UI polls by re-fetching when the user navigates. Push updates would improve the experience but are not required.
