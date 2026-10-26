import cors from 'cors';
import express from 'express';
import { isOriginAllowed, parseAllowedOrigins } from './config/cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sequelize } from './models';
import apiRouter from './routes';
import { asyncHandler } from './utils/asyncHandler';

const allowedOrigins = parseAllowedOrigins(env.frontendUrl);

const app = express();

// Render terminates TLS at its proxy; trust it so req.protocol / req.ip are correct.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin: (origin, callback) => callback(null, isOriginAllowed(origin, allowedOrigins)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ name: 'erp-billing-api', health: '/api/health' });
});

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected' });
  }),
);

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;