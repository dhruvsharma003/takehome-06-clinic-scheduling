import express from 'express';
import cors from 'cors';
import './db/database'; // initialize DB

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import slotsRouter from './routes/slots';
import appointmentsRouter from './routes/appointments';
import visitNotesRouter from './routes/visitNotes';
import alertsRouter from './routes/alerts';
import dashboardRouter from './routes/dashboard';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/visit-notes', visitNotesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Root catch-all — tells browsers / curl they hit the wrong path
app.use((_req, res) => res.status(404).json({ error: 'Not found. API is at /api/*' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Clinic scheduling API running on port ${PORT}`);
});

export default app;
