import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/alerts — front-desk only: list active unconfirmed alerts
router.get('/', authenticate, requireRole('front_desk'), (req: Request, res: Response): void => {
  // Alert condition: appointment is 'requested' AND within 24h of slot time
  // An alert is dismissed if: dismissed_at is set AND it was dismissed more than 1 hour before the slot
  // (i.e., if dismissed but now within 1h of slot, alert re-appears)
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const appointments = db.prepare(`
    SELECT a.id, a.patient_name, a.status,
           s.date, s.start_time, s.duration_minutes,
           u.name as provider_name, u.id as provider_id
    FROM appointments a
    JOIN slots s ON a.slot_id = s.id
    JOIN users u ON s.provider_id = u.id
    WHERE a.status = 'requested'
    ORDER BY s.date, s.start_time
  `).all() as any[];

  const alerts: any[] = [];

  for (const appt of appointments) {
    const slotDateTime = new Date(`${appt.date}T${appt.start_time}`);

    // Must be within next 24 hours
    if (slotDateTime > new Date(in24h) || slotDateTime < now) continue;

    // Check dismissal
    const dismissal = db.prepare('SELECT * FROM alerts WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1').get(appt.id) as any;

    const oneHourBefore = new Date(slotDateTime.getTime() - 60 * 60 * 1000);
    const withinOneHour = now >= oneHourBefore;

    if (dismissal && dismissal.dismissed_at && !withinOneHour) {
      // Dismissed and not yet in the 1h re-alert window — skip
      continue;
    }

    // Ensure an alert record exists
    if (!dismissal) {
      db.prepare('INSERT INTO alerts (id, appointment_id) VALUES (?, ?)').run(uuidv4(), appt.id);
    } else if (dismissal.dismissed_at && withinOneHour) {
      // Re-alert: clear dismissal so it shows again
      db.prepare("UPDATE alerts SET dismissed_at = NULL, dismissed_by = NULL WHERE id = ?").run(dismissal.id);
    }

    alerts.push({
      ...appt,
      slot_datetime: slotDateTime.toISOString(),
      within_one_hour: withinOneHour,
    });
  }

  res.json({ count: alerts.length, alerts });
});

// POST /api/alerts/:appointmentId/dismiss — dismiss an alert
router.post('/:appointmentId/dismiss', authenticate, requireRole('front_desk'), (req: Request, res: Response): void => {
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.appointmentId);
  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const alert = db.prepare('SELECT * FROM alerts WHERE appointment_id = ?').get(req.params.appointmentId) as any;
  if (!alert) {
    // Create and immediately dismiss
    db.prepare("INSERT INTO alerts (id, appointment_id, dismissed_by, dismissed_at) VALUES (?, ?, ?, datetime('now'))").run(uuidv4(), req.params.appointmentId, req.user!.id);
  } else {
    db.prepare("UPDATE alerts SET dismissed_by = ?, dismissed_at = datetime('now') WHERE appointment_id = ?").run(req.user!.id, req.params.appointmentId);
  }

  res.json({ message: 'Alert dismissed' });
});

export default router;
