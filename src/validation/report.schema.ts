import { z } from 'zod';
import { emptyToUndefined, isoDateSchema } from './common';

export const outstandingQuerySchema = z.object({
  asOf: z.preprocess(emptyToUndefined, isoDateSchema('asOf').optional()),
});

export type OutstandingQuery = z.infer<typeof outstandingQuerySchema>;