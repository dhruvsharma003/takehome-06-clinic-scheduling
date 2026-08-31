import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/visit-notes/:appointmentId — list notes for an appointment
router.get('/:appointmentId', authenticate, (req: Request, res: Response): void => {
  const appt = db.prepare(`
    SELECT a.id, s.provider_id FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.appointmentId) as any;
  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const user = req.user!;
  if (user.role === 'provider') {
    const onCareTeam = db.prepare('SELECT 1 FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL').get(appt.id, user.id);
    if (appt.provider_id !== user.id && !onCareTeam) {
      res.status(403).json({ error: 'Access denied' }); return;
    }
  }

  const notes = db.prepare(`
    SELECT vn.*, u.name as author_name
    FROM visit_notes vn JOIN users u ON vn.provider_id = u.id
    WHERE vn.appointment_id = ? ORDER BY vn.created_at ASC
  `).all(req.params.appointmentId);
  res.json(notes);
});

// POST /api/visit-notes/:appointmentId — add a note
router.post('/:appointmentId', authenticate, (req: Request, res: Response): void => {
  const appt = db.prepare(`
    SELECT a.id, a.status, s.provider_id FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.appointmentId) as any;
  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const user = req.user!;
  // Only providers can add notes, and only on their own appointments / care team
  if (user.role !== 'provider') {
    res.status(403).json({ error: 'Only providers can add visit notes' }); return;
  }

  const onCareTeam = db.prepare('SELECT 1 FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL').get(appt.id, user.id);
  if (appt.provider_id !== user.id && !onCareTeam) {
    res.status(403).json({ error: 'You are not on the care team for this appointment' }); return;
  }

  const { content } = req.body as { content?: string };
  if (!content) { res.status(400).json({ error: 'content is required' }); return; }

  const id = uuidv4();
  db.prepare(`INSERT INTO visit_notes (id, appointment_id, provider_id, content) VALUES (?, ?, ?, ?)`).run(id, appt.id, user.id, content);

  // Audit
  db.prepare(`
    INSERT INTO audit_log (id, appointment_id, event_type, actor_id, new_value)
    VALUES (?, ?, 'visit_note_added', ?, ?)
  `).run(uuidv4(), appt.id, user.id, content.slice(0, 100));

  const note = db.prepare(`
    SELECT vn.*, u.name as author_name FROM visit_notes vn JOIN users u ON vn.provider_id = u.id WHERE vn.id = ?
  `).get(id);
  res.status(201).json(note);
});

// PATCH /api/visit-notes/:appointmentId/:noteId — edit a note
router.patch('/:appointmentId/:noteId', authenticate, (req: Request, res: Response): void => {
  const note = db.prepare('SELECT * FROM visit_notes WHERE id = ? AND appointment_id = ?').get(req.params.noteId, req.params.appointmentId) as any;
  if (!note) { res.status(404).json({ error: 'Note not found' }); return; }

  const user = req.user!;
  if (user.role !== 'provider' || note.provider_id !== user.id) {
    res.status(403).json({ error: 'Only the author can edit a visit note' }); return;
  }

  const { content } = req.body as { content?: string };
  if (!content) { res.status(400).json({ error: 'content is required' }); return; }

  db.prepare("UPDATE visit_notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, note.id);

  // Audit
  db.prepare(`
    INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value)
    VALUES (?, ?, 'visit_note_edited', ?, ?, ?)
  `).run(uuidv4(), req.params.appointmentId, user.id, note.content.slice(0, 100), content.slice(0, 100));

  res.json(db.prepare(`
    SELECT vn.*, u.name as author_name FROM visit_notes vn JOIN users u ON vn.provider_id = u.id WHERE vn.id = ?
  `).get(note.id));
});

export default router;
