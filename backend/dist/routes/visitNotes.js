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
// GET /api/visit-notes/:appointmentId — list notes for an appointment
router.get('/:appointmentId', auth_1.authenticate, (req, res) => {
    const appt = database_1.default.prepare(`
    SELECT a.id, s.provider_id FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.appointmentId);
    if (!appt) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
    }
    const user = req.user;
    if (user.role === 'provider') {
        const onCareTeam = database_1.default.prepare('SELECT 1 FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL').get(appt.id, user.id);
        if (appt.provider_id !== user.id && !onCareTeam) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }
    const notes = database_1.default.prepare(`
    SELECT vn.*, u.name as author_name
    FROM visit_notes vn JOIN users u ON vn.provider_id = u.id
    WHERE vn.appointment_id = ? ORDER BY vn.created_at ASC
  `).all(req.params.appointmentId);
    res.json(notes);
});
// POST /api/visit-notes/:appointmentId — add a note
router.post('/:appointmentId', auth_1.authenticate, (req, res) => {
    const appt = database_1.default.prepare(`
    SELECT a.id, a.status, s.provider_id FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.appointmentId);
    if (!appt) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
    }
    const user = req.user;
    // Only providers can add notes, and only on their own appointments / care team
    if (user.role !== 'provider') {
        res.status(403).json({ error: 'Only providers can add visit notes' });
        return;
    }
    const onCareTeam = database_1.default.prepare('SELECT 1 FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL').get(appt.id, user.id);
    if (appt.provider_id !== user.id && !onCareTeam) {
        res.status(403).json({ error: 'You are not on the care team for this appointment' });
        return;
    }
    const { content } = req.body;
    if (!content) {
        res.status(400).json({ error: 'content is required' });
        return;
    }
    const id = (0, uuid_1.v4)();
    database_1.default.prepare(`INSERT INTO visit_notes (id, appointment_id, provider_id, content) VALUES (?, ?, ?, ?)`).run(id, appt.id, user.id, content);
    // Audit
    database_1.default.prepare(`
    INSERT INTO audit_log (id, appointment_id, event_type, actor_id, new_value)
    VALUES (?, ?, 'visit_note_added', ?, ?)
  `).run((0, uuid_1.v4)(), appt.id, user.id, content.slice(0, 100));
    const note = database_1.default.prepare(`
    SELECT vn.*, u.name as author_name FROM visit_notes vn JOIN users u ON vn.provider_id = u.id WHERE vn.id = ?
  `).get(id);
    res.status(201).json(note);
});
// PATCH /api/visit-notes/:appointmentId/:noteId — edit a note
router.patch('/:appointmentId/:noteId', auth_1.authenticate, (req, res) => {
    const note = database_1.default.prepare('SELECT * FROM visit_notes WHERE id = ? AND appointment_id = ?').get(req.params.noteId, req.params.appointmentId);
    if (!note) {
        res.status(404).json({ error: 'Note not found' });
        return;
    }
    const user = req.user;
    if (user.role !== 'provider' || note.provider_id !== user.id) {
        res.status(403).json({ error: 'Only the author can edit a visit note' });
        return;
    }
    const { content } = req.body;
    if (!content) {
        res.status(400).json({ error: 'content is required' });
        return;
    }
    database_1.default.prepare("UPDATE visit_notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, note.id);
    // Audit
    database_1.default.prepare(`
    INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value)
    VALUES (?, ?, 'visit_note_edited', ?, ?, ?)
  `).run((0, uuid_1.v4)(), req.params.appointmentId, user.id, note.content.slice(0, 100), content.slice(0, 100));
    res.json(database_1.default.prepare(`
    SELECT vn.*, u.name as author_name FROM visit_notes vn JOIN users u ON vn.provider_id = u.id WHERE vn.id = ?
  `).get(note.id));
});
exports.default = router;
