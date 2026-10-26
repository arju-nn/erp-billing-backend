import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants/enums';
import { emptyToUndefined, hasAtMostTwoDecimals, isoDateSchema } from './common';

export const createPaymentSchema = z.object({
  invoiceId: z.coerce
    .number({ invalid_type_error: 'invoiceId must be a number' })
    .int('invoiceId must be an integer')
    .positive('invoiceId is required'),
  // Optional: if sent, it must match the invoice's customer.
  customerId: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: 'customerId must be a number' })
      .int('customerId must be an integer')
      .positive('customerId must be positive')
      .optional(),
  ),
  date: isoDateSchema('date'),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(9_999_999_999.99, 'Amount is too large')
    .refine(hasAtMostTwoDecimals, 'Amount can have at most 2 decimal places'),
  method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: `method must be one of: ${PAYMENT_METHODS.join(', ')}` }),
  }),
  referenceNumber: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z
      .string({ invalid_type_error: 'referenceNumber must be a string' })
      .trim()
      .max(100, 'referenceNumber must be at most 100 characters')
      .nullable(),
  ),
});

export const paymentListQuerySchema = z.object({
  invoiceId: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ invalid_type_error: 'invoiceId must be a number' }).int().positive().optional(),
  ),
  customerId: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ invalid_type_error: 'customerId must be a number' }).int().positive().optional(),
  ),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;