import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

type AppointmentStatus = 'requested' | 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';

// Valid status transitions
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed'],
  completed: [],
  no_show: [],
  cancelled: [],
};

function logAudit(
  appointmentId: string,
  eventType: string,
  actorId: string,
  oldValue: string | null,
  newValue: string | null,
  metadata?: Record<string, any>
) {
  db.prepare(`
    INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), appointmentId, eventType, actorId, oldValue, newValue, metadata ? JSON.stringify(metadata) : null);
}

// GET /api/appointments/export/day-csv — MUST be before /:id
router.get('/export/day-csv', authenticate, requireRole('front_desk'), (req: Request, res: Response): void => {
  const { date, provider_id } = req.query as Record<string, string>;
  if (!date) { res.status(400).json({ error: 'date is required' }); return; }

  let query = `
    SELECT a.patient_name, a.patient_email, a.patient_phone, a.status,
           s.date, s.start_time, s.duration_minutes,
           u.name as provider_name
    FROM appointments a
    JOIN slots s ON a.slot_id = s.id
    JOIN users u ON s.provider_id = u.id
    WHERE s.date = ?
  `;
  const params: any[] = [date];
  if (provider_id) { query += ' AND s.provider_id = ?'; params.push(provider_id); }
  query += ' ORDER BY s.start_time';

  const rows = db.prepare(query).all(...params) as any[];

  const header = 'Provider,Date,Start Time,Duration (min),Patient Name,Email,Phone,Status\n';
  const csv = header + rows.map(r =>
    [r.provider_name, r.date, r.start_time, r.duration_minutes, r.patient_name, r.patient_email || '', r.patient_phone || '', r.status]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="schedule-${date}.csv"`);
  res.send(csv);
});

// GET /api/appointments — server-side search, filter, sort, paginate
router.get('/', authenticate, (req: Request, res: Response): void => {
  const user = req.user!;
  const {
    q, provider_id, status, date_from, date_to,
    sort = 'date_asc', page = '1', limit = '20'
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Base join
  let where = 'WHERE 1=1';
  const params: any[] = [];

  // Providers see only their own appointments (scheduling OR supporting)
  if (user.role === 'provider') {
    where += ` AND (s.provider_id = ? OR EXISTS (
      SELECT 1 FROM care_team ct WHERE ct.appointment_id = a.id AND ct.provider_id = ? AND ct.removed_at IS NULL
    ))`;
    params.push(user.id, user.id);
  }

  if (q) {
    where += ' AND LOWER(a.patient_name) LIKE ?';
    params.push(`%${q.toLowerCase()}%`);
  }

  let effectiveProviderId = provider_id;
  if (user.role === 'provider') effectiveProviderId = user.id;
  if (effectiveProviderId) {
    where += ' AND s.provider_id = ?';
    params.push(effectiveProviderId);
  }

  if (status) {
    where += ' AND a.status = ?';
    params.push(status);
  }
  if (date_from) {
    where += ' AND s.date >= ?';
    params.push(date_from);
  }
  if (date_to) {
    where += ' AND s.date <= ?';
    params.push(date_to);
  }

  const sortMap: Record<string, string> = {
    date_asc: 's.date ASC, s.start_time ASC',
    date_desc: 's.date DESC, s.start_time DESC',
    status_asc: 'a.status ASC',
    status_desc: 'a.status DESC',
    provider_asc: 'u.name ASC',
    provider_desc: 'u.name DESC',
  };
  const orderBy = sortMap[sort] || sortMap['date_asc'];

  const baseQuery = `
    FROM appointments a
    JOIN slots s ON a.slot_id = s.id
    JOIN users u ON s.provider_id = u.id
    ${where}
  `;

  const total = (db.prepare(`SELECT COUNT(*) as cnt ${baseQuery}`).get(...params) as any).cnt;

  const rows = db.prepare(`
    SELECT a.id, a.patient_name, a.patient_email, a.patient_phone, a.status,
           a.cancellation_reason, a.created_at, a.updated_at,
           s.id as slot_id, s.date, s.start_time, s.duration_minutes,
           u.id as provider_id, u.name as provider_name
    ${baseQuery}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  res.json({
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
    appointments: rows,
  });
});

// GET /api/appointments/:id
router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const appt = db.prepare(`
    SELECT a.*, s.date, s.start_time, s.duration_minutes, s.provider_id,
           u.name as provider_name
    FROM appointments a
    JOIN slots s ON a.slot_id = s.id
    JOIN users u ON s.provider_id = u.id
    WHERE a.id = ?
  `).get(req.params.id) as any;

  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const user = req.user!;
  if (user.role === 'provider') {
    const onCareTeam = db.prepare(`
      SELECT 1 FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL
    `).get(appt.id, user.id);
    if (appt.provider_id !== user.id && !onCareTeam) {
      res.status(403).json({ error: 'Access denied' }); return;
    }
  }

  // Care team
  const careTeam = db.prepare(`
    SELECT ct.provider_id, ct.added_at, ct.removed_at, u.name as provider_name
    FROM care_team ct JOIN users u ON ct.provider_id = u.id
    WHERE ct.appointment_id = ? AND ct.removed_at IS NULL
  `).all(appt.id);

  // Visit notes
  const notes = db.prepare(`
    SELECT vn.*, u.name as author_name
    FROM visit_notes vn JOIN users u ON vn.provider_id = u.id
    WHERE vn.appointment_id = ? ORDER BY vn.created_at ASC
  `).all(appt.id);

  // Audit timeline
  const timeline = db.prepare(`
    SELECT al.*, u.name as actor_name
    FROM audit_log al JOIN users u ON al.actor_id = u.id
    WHERE al.appointment_id = ? ORDER BY al.created_at ASC
  `).all(appt.id);

  res.json({ ...appt, care_team: careTeam, visit_notes: notes, timeline });
});

// POST /api/appointments — book a slot
router.post('/', authenticate, (req: Request, res: Response): void => {
  const { slot_id, patient_name, patient_email, patient_phone } = req.body as Record<string, any>;
  const user = req.user!;

  if (!slot_id || !patient_name) {
    res.status(400).json({ error: 'slot_id and patient_name are required' }); return;
  }

  const slot = db.prepare('SELECT * FROM slots WHERE id = ? AND archived = 0').get(slot_id) as any;
  if (!slot) { res.status(404).json({ error: 'Slot not found or archived' }); return; }

  if (user.role === 'provider' && slot.provider_id !== user.id) {
    res.status(403).json({ error: 'Providers can only book slots on their own schedule' }); return;
  }

  const existing = db.prepare("SELECT id FROM appointments WHERE slot_id = ? AND status NOT IN ('cancelled')").get(slot_id);
  if (existing) { res.status(409).json({ error: 'This slot is already booked' }); return; }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO appointments (id, slot_id, patient_name, patient_email, patient_phone, status)
    VALUES (?, ?, ?, ?, ?, 'requested')
  `).run(id, slot_id, patient_name, patient_email || null, patient_phone || null);

  logAudit(id, 'status_change', user.id, null, 'requested', { patient_name });

  res.status(201).json(db.prepare(`
    SELECT a.*, s.date, s.start_time, s.duration_minutes, s.provider_id
    FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(id));
});

// PATCH /api/appointments/:id/status — status transitions
router.patch('/:id/status', authenticate, (req: Request, res: Response): void => {
  const appt = db.prepare(`
    SELECT a.*, s.provider_id, s.date, s.start_time
    FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.id) as any;

  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const user = req.user!;
  const { status, cancellation_reason } = req.body as Record<string, any>;

  // Role enforcement: providers can only act on their own appointments
  if (user.role === 'provider') {
    const onCareTeam = db.prepare(`SELECT 1 FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL`).get(appt.id, user.id);
    if (appt.provider_id !== user.id && !onCareTeam) {
      res.status(403).json({ error: 'Access denied' }); return;
    }
    // providers cannot confirm/cancel
    if (['confirmed', 'cancelled'].includes(status) && appt.provider_id !== user.id) {
      res.status(403).json({ error: 'Only front-desk can confirm or cancel appointments' }); return;
    }
  }

  const current = appt.status as AppointmentStatus;
  const next = status as AppointmentStatus;

  if (!VALID_TRANSITIONS[current] || !VALID_TRANSITIONS[current].includes(next)) {
    res.status(422).json({
      error: `Cannot transition from '${current}' to '${next}'. Valid next states: ${VALID_TRANSITIONS[current].join(', ') || 'none'}`
    });
    return;
  }

  // No-show: only from Confirmed and only after scheduled time
  if (next === 'no_show') {
    const slotDateTime = new Date(`${appt.date}T${appt.start_time}`);
    if (new Date() < slotDateTime) {
      res.status(422).json({ error: 'Cannot mark no-show before the appointment time has passed' });
      return;
    }
  }

  // Cancellation requires reason
  if (next === 'cancelled' && !cancellation_reason) {
    res.status(400).json({ error: 'A cancellation reason is required' });
    return;
  }

  db.prepare(`
    UPDATE appointments SET status = ?, cancellation_reason = ?, updated_at = datetime('now') WHERE id = ?
  `).run(next, next === 'cancelled' ? cancellation_reason : null, appt.id);

  logAudit(appt.id, 'status_change', user.id, current, next,
    next === 'cancelled' ? { reason: cancellation_reason } : undefined);

  res.json(db.prepare(`
    SELECT a.*, s.date, s.start_time, s.duration_minutes, s.provider_id
    FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(appt.id));
});

// PATCH /api/appointments/:id/reassign — front-desk only: move to different provider
router.patch('/:id/reassign', authenticate, requireRole('front_desk'), (req: Request, res: Response): void => {
  const appt = db.prepare(`
    SELECT a.*, s.id as slot_id, s.date, s.start_time, s.duration_minutes, s.provider_id
    FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.id) as any;

  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }
  if (['completed', 'cancelled', 'no_show'].includes(appt.status)) {
    res.status(422).json({ error: 'Cannot reassign a completed, cancelled or no-show appointment' }); return;
  }

  const { new_provider_id } = req.body as Record<string, any>;
  if (!new_provider_id) { res.status(400).json({ error: 'new_provider_id is required' }); return; }

  const newProvider = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'provider'").get(new_provider_id);
  if (!newProvider) { res.status(404).json({ error: 'Provider not found' }); return; }

  // Create a new slot for the new provider with same date/time
  const newSlotId = uuidv4();
  db.prepare(`
    INSERT INTO slots (id, provider_id, date, start_time, duration_minutes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(newSlotId, new_provider_id, appt.date, appt.start_time, appt.duration_minutes, req.user!.id);

  const oldProviderId = appt.provider_id;
  db.prepare('UPDATE appointments SET slot_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newSlotId, appt.id);

  logAudit(appt.id, 'reassigned', req.user!.id, oldProviderId, new_provider_id);

  res.json(db.prepare(`
    SELECT a.*, s.date, s.start_time, s.duration_minutes, s.provider_id, u.name as provider_name
    FROM appointments a JOIN slots s ON a.slot_id = s.id JOIN users u ON s.provider_id = u.id WHERE a.id = ?
  `).get(appt.id));
});

// POST /api/appointments/:id/care-team — add supporting provider
router.post('/:id/care-team', authenticate, (req: Request, res: Response): void => {
  const appt = db.prepare(`
    SELECT a.*, s.provider_id FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?
  `).get(req.params.id) as any;

  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const user = req.user!;
  if (user.role === 'provider' && appt.provider_id !== user.id) {
    res.status(403).json({ error: 'Only the scheduling provider or front-desk can manage care team' }); return;
  }

  const { provider_id } = req.body as Record<string, any>;
  if (!provider_id) { res.status(400).json({ error: 'provider_id is required' }); return; }

  const provider = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'provider'").get(provider_id);
  if (!provider) { res.status(404).json({ error: 'Provider not found' }); return; }

  // Check if already on team (and not removed)
  const existing = db.prepare('SELECT * FROM care_team WHERE appointment_id = ? AND provider_id = ?').get(appt.id, provider_id) as any;
  if (existing && !existing.removed_at) {
    res.status(409).json({ error: 'Provider already on care team' }); return;
  }

  if (existing) {
    // Restore removed member
    db.prepare("UPDATE care_team SET removed_at = NULL, removed_by = NULL WHERE appointment_id = ? AND provider_id = ?").run(appt.id, provider_id);
  } else {
    db.prepare(`INSERT INTO care_team (appointment_id, provider_id, added_by) VALUES (?, ?, ?)`).run(appt.id, provider_id, user.id);
  }

  logAudit(appt.id, 'care_team_added', user.id, null, provider_id);
  res.status(201).json({ message: 'Provider added to care team' });
});

// DELETE /api/appointments/:id/care-team/:providerId — remove supporting provider
router.delete('/:id/care-team/:providerId', authenticate, (req: Request, res: Response): void => {
  const appt = db.prepare(`SELECT a.*, s.provider_id FROM appointments a JOIN slots s ON a.slot_id = s.id WHERE a.id = ?`).get(req.params.id) as any;
  if (!appt) { res.status(404).json({ error: 'Appointment not found' }); return; }

  const user = req.user!;
  if (user.role === 'provider' && appt.provider_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const entry = db.prepare('SELECT * FROM care_team WHERE appointment_id = ? AND provider_id = ? AND removed_at IS NULL').get(appt.id, req.params.providerId) as any;
  if (!entry) { res.status(404).json({ error: 'Provider not on care team' }); return; }

  db.prepare("UPDATE care_team SET removed_at = datetime('now'), removed_by = ? WHERE appointment_id = ? AND provider_id = ?").run(user.id, appt.id, req.params.providerId);
  logAudit(appt.id, 'care_team_removed', user.id, req.params.providerId, null);
  res.json({ message: 'Provider removed from care team' });
});

export default router;
