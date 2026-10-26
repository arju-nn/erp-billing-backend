import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const createCustomerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(150, 'Name must be at most 150 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Email is invalid')
    .max(190, 'Email must be at most 190 characters'),
  phone: z
    .string({ required_error: 'Phone is required' })
    .trim()
    .min(7, 'Phone is too short')
    .max(30, 'Phone must be at most 30 characters')
    .regex(/^[0-9+()\-\s]+$/, 'Phone may contain only digits, spaces, +, -, ( and )'),
  gstNumber: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z
      .string({ invalid_type_error: 'GST number must be a string' })
      .trim()
      .toUpperCase()
      .regex(GSTIN_REGEX, 'GST number must be a valid 15-character GSTIN')
      .nullable(),
  ),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;