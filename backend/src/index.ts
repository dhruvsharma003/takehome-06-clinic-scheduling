import express from 'express';
import cors from 'cors';
import './db/database';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import slotsRouter from './routes/slots';
import appointmentsRouter from './routes/appointments';
import visitNotesRouter from './routes/visitNotes';
import alertsRouter from './routes/alerts';
import dashboardRouter from './routes/dashboard';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://takehome-06-clinic-scheduling-6iyq.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found. API is at /api/*'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Clinic scheduling API running on port ${PORT}`);
});

export default app;