"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../db/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Helper: check if provider can act on a slot
function canActOnProvider(actorRole, actorId, providerId) {
    if (actorRole === 'front_desk')
        return true;
    return actorId === providerId;
}
// POST /api/slots/bulk-generate — front-desk only  (MUST be before /:id)
router.post('/bulk-generate', auth_1.authenticate, (0, auth_1.requireRole)('front_desk'), (req, res) => {
    const { provider_id, start_date, end_date, days_of_week, start_time, duration_minutes } = req.body;
    const user = req.user;
    if (!provider_id || !start_date || !end_date || !days_of_week || !start_time || !duration_minutes) {
        res.status(400).json({ error: 'provider_id, start_date, end_date, days_of_week, start_time, duration_minutes are required' });
        return;
    }
    const provider = database_1.default.prepare("SELECT id FROM users WHERE id = ? AND role = 'provider'").get(provider_id);
    if (!provider) {
        res.status(404).json({ error: 'Provider not found' });
        return;
    }
    const created = [];
    const skipped = [];
    const current = new Date(start_date + 'T00:00:00Z');
    const end = new Date(end_date + 'T00:00:00Z');
    while (current <= end) {
        const dow = current.getUTCDay();
        const dateStr = current.toISOString().slice(0, 10);
        if (days_of_week.includes(dow)) {
            const collision = database_1.default.prepare(`
        SELECT s.id FROM slots s
        JOIN appointments a ON a.slot_id = s.id
        WHERE s.provider_id = ? AND s.date = ? AND s.start_time = ?
          AND a.status NOT IN ('cancelled')
      `).get(provider_id, dateStr, start_time);
            if (collision) {
                skipped.push(dateStr);
            }
            else {
                const id = (0, uuid_1.v4)();
                database_1.default.prepare(`
          INSERT INTO slots (id, provider_id, date, start_time, duration_minutes, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, provider_id, dateStr, start_time, duration_minutes, user.id);
                created.push(dateStr);
            }
        }
        current.setUTCDate(current.getUTCDate() + 1);
    }
    res.json({ created: created.length, skipped: skipped.length, created_dates: created, skipped_dates: skipped });
});
// GET /api/slots — list slots for a provider/date (both roles)
router.get('/', auth_1.authenticate, (req, res) => {
    const { provider_id, date, include_archived } = req.query;
    const user = req.user;
    let providerId = provider_id;
    if (user.role === 'provider') {
        providerId = user.id; // providers can only see their own
    }
    let query = `
    SELECT s.*, u.name as provider_name,
           a.id as appointment_id, a.patient_name, a.status,
           a.patient_email, a.patient_phone
    FROM slots s
    JOIN users u ON s.provider_id = u.id
    LEFT JOIN appointments a ON a.slot_id = s.id
    WHERE 1=1
  `;
    const params = [];
    if (providerId) {
        query += ' AND s.provider_id = ?';
        params.push(providerId);
    }
    if (date) {
        query += ' AND s.date = ?';
        params.push(date);
    }
    if (!include_archived || include_archived === 'false') {
        query += ' AND s.archived = 0';
    }
    query += ' ORDER BY s.date, s.start_time';
    const slots = database_1.default.prepare(query).all(...params);
    res.json(slots);
});
// POST /api/slots — create a slot
router.post('/', auth_1.authenticate, (req, res) => {
    const { provider_id, date, start_time, duration_minutes } = req.body;
    const user = req.user;
    if (!provider_id || !date || !start_time || !duration_minutes) {
        res.status(400).json({ error: 'provider_id, date, start_time, duration_minutes are required' });
        return;
    }
    if (!canActOnProvider(user.role, user.id, provider_id)) {
        res.status(403).json({ error: 'Providers can only create slots for themselves' });
        return;
    }
    // Check provider exists
    const provider = database_1.default.prepare("SELECT id FROM users WHERE id = ? AND role = 'provider'").get(provider_id);
    if (!provider) {
        res.status(404).json({ error: 'Provider not found' });
        return;
    }
    const id = (0, uuid_1.v4)();
    database_1.default.prepare(`
    INSERT INTO slots (id, provider_id, date, start_time, duration_minutes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, provider_id, date, start_time, duration_minutes, user.id);
    const slot = database_1.default.prepare('SELECT * FROM slots WHERE id = ?').get(id);
    res.status(201).json(slot);
});
// PUT /api/slots/:id — edit a slot (only if unbooked)
router.put('/:id', auth_1.authenticate, (req, res) => {
    const slot = database_1.default.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    if (!slot) {
        res.status(404).json({ error: 'Slot not found' });
        return;
    }
    const user = req.user;
    if (!canActOnProvider(user.role, user.id, slot.provider_id)) {
        res.status(403).json({ error: 'Providers can only edit their own slots' });
        return;
    }
    // Check if booked
    const appt = database_1.default.prepare("SELECT id FROM appointments WHERE slot_id = ? AND status NOT IN ('cancelled')").get(slot.id);
    if (appt) {
        res.status(409).json({ error: 'Cannot edit a slot that has an active appointment' });
        return;
    }
    const { date, start_time, duration_minutes } = req.body;
    database_1.default.prepare(`
    UPDATE slots SET
      date = COALESCE(?, date),
      start_time = COALESCE(?, start_time),
      duration_minutes = COALESCE(?, duration_minutes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(date || null, start_time || null, duration_minutes || null, slot.id);
    res.json(database_1.default.prepare('SELECT * FROM slots WHERE id = ?').get(slot.id));
});
// POST /api/slots/:id/archive
router.post('/:id/archive', auth_1.authenticate, (req, res) => {
    const slot = database_1.default.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    if (!slot) {
        res.status(404).json({ error: 'Slot not found' });
        return;
    }
    const user = req.user;
    if (!canActOnProvider(user.role, user.id, slot.provider_id)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    database_1.default.prepare("UPDATE slots SET archived = 1, updated_at = datetime('now') WHERE id = ?").run(slot.id);
    res.json({ message: 'Slot archived' });
});
// POST /api/slots/:id/restore
router.post('/:id/restore', auth_1.authenticate, (req, res) => {
    const slot = database_1.default.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    if (!slot) {
        res.status(404).json({ error: 'Slot not found' });
        return;
    }
    const user = req.user;
    if (!canActOnProvider(user.role, user.id, slot.provider_id)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    database_1.default.prepare("UPDATE slots SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(slot.id);
    res.json({ message: 'Slot restored' });
});
exports.default = router;
