import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sequelize } from './models';
import apiRouter from './routes';
import { asyncHandler } from './utils/asyncHandler';

const allowedOrigins = env.frontendUrl
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl, Postman) which send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(null, false);
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

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