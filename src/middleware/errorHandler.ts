import { ErrorRequestHandler, RequestHandler } from 'express';
import {
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

const MYSQL_CHECK_CONSTRAINT_VIOLATED = 3819;

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({ error: 'A record with the same unique value already exists' });
    return;
  }
  if (err instanceof ForeignKeyConstraintError) {
    res.status(409).json({ error: 'Operation conflicts with a related record' });
    return;
  }
  if (err instanceof SequelizeValidationError) {
    res.status(400).json({ error: err.errors.map((e) => e.message).join('; ') || err.message });
    return;
  }
  if (err instanceof DatabaseError) {
    const parent = err.parent as { errno?: number; sqlMessage?: string } | undefined;
    if (parent?.errno === MYSQL_CHECK_CONSTRAINT_VIOLATED) {
      res.status(422).json({ error: `Data violates a database rule: ${parent.sqlMessage ?? err.message}` });
      return;
    }
  }
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};