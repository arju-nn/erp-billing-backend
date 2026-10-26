import { z } from 'zod';
import { emptyToUndefined, isoDateSchema } from './common';

export const asOfQuerySchema = z.object({
  asOf: z.preprocess(emptyToUndefined, isoDateSchema('asOf').optional()),
});

const optionalId = (label: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: `${label} must be a number` })
      .int(`${label} must be an integer`)
      .positive(`${label} must be positive`)
      .optional(),
  );

export const journalListQuerySchema = z
  .object({
    from: z.preprocess(emptyToUndefined, isoDateSchema('from').optional()),
    to: z.preprocess(emptyToUndefined, isoDateSchema('to').optional()),
    invoiceId: optionalId('invoiceId'),
    paymentId: optionalId('paymentId'),
    accountId: optionalId('accountId'),
    limit: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'limit must be a number' })
        .int('limit must be an integer')
        .min(1, 'limit must be at least 1')
        .max(200, 'limit cannot exceed 200')
        .default(50),
    ),
    offset: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'offset must be a number' })
        .int('offset must be an integer')
        .min(0, 'offset cannot be negative')
        .default(0),
    ),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type AsOfQuery = z.infer<typeof asOfQuerySchema>;
export type JournalListQuery = z.infer<typeof journalListQuerySchema>;