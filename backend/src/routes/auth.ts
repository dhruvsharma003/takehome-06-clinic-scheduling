import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { signToken } from '../middleware/auth';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

router.post('/register', (req: Request, res: Response): void => {
  const { email, password, name, role } = req.body as { email?: string; password?: string; name?: string; role?: string };
  if (!email || !password || !name || !role) {
    res.status(400).json({ error: 'email, password, name, role are required' });
    return;
  }
  if (!['front_desk', 'provider'].includes(role)) {
    res.status(400).json({ error: 'Role must be front_desk or provider' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(id, email, hash, name, role);
  const token = signToken({ id, email, role: role as 'front_desk' | 'provider', name });
  res.status(201).json({ token, user: { id, email, role, name } });
});

export default router;
