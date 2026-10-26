import { z } from 'zod';

/** Treat '' and null (e.g. empty query params / form fields) as "not provided". */
export const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const hasAtMostTwoDecimals = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'id must be a number' })
    .int('id must be an integer')
    .positive('id must be positive'),
});

export const isoDateSchema = (label: string) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be a string` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, `${label} is not a valid date`);