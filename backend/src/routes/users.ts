import { Router, Request, Response } from 'express';
import db from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/users/providers — list all providers (both roles can call this)
router.get('/providers', authenticate, (req: Request, res: Response): void => {
  const providers = db.prepare("SELECT id, name, email FROM users WHERE role = 'provider' ORDER BY name").all();
  res.json(providers);
});

// GET /api/users — front-desk only: list all users
router.get('/', authenticate, requireRole('front_desk'), (req: Request, res: Response): void => {
  const users = db.prepare("SELECT id, name, email, role FROM users ORDER BY name").all();
  res.json(users);
});

export default router;
