import 'express-async-errors';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import { apiRouter } from './routes/api.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
const corsOrigin = allowedOrigins.length ? allowedOrigins : '*';
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: corsOrigin, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.get('/', (_req, res) => res.json({ service: 'SkillHub API', health: '/api/health' }));
app.use('/api', apiRouter);

async function start() {
  await connectDatabase();
  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`[SkillHub API] Ready at http://0.0.0.0:${port}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('[SkillHub API] Could not start.', error);
  process.exitCode = 1;
});
