import { z } from 'zod';
import { INVOICE_STATUSES } from '../constants/enums';
import { emptyToUndefined, hasAtMostTwoDecimals, isoDateSchema } from './common';

export const lineItemSchema = z.object({
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(1, 'Description is required')
    .max(255, 'Description must be at most 255 characters'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0')
    .max(1_000_000, 'Quantity is too large')
    .refine(hasAtMostTwoDecimals, 'Quantity can have at most 2 decimal places'),
  unitPrice: z.coerce
    .number({ invalid_type_error: 'Unit price must be a number' })
    .positive('Unit price must be greater than 0')
    .max(9_999_999_999.99, 'Unit price is too large')
    .refine(hasAtMostTwoDecimals, 'Unit price can have at most 2 decimal places'),
  taxRate: z.coerce
    .number({ invalid_type_error: 'Tax rate must be a number' })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100')
    .refine(hasAtMostTwoDecimals, 'Tax rate can have at most 2 decimal places')
    .default(0),
});

const invoiceBaseSchema = z.object({
  customerId: z.coerce
    .number({ invalid_type_error: 'customerId must be a number' })
    .int('customerId must be an integer')
    .positive('customerId is required'),
  invoiceDate: isoDateSchema('invoiceDate'),
  dueDate: isoDateSchema('dueDate'),
  items: z
    .array(lineItemSchema, { required_error: 'items is required', invalid_type_error: 'items must be an array' })
    .min(1, 'At least one line item is required')
    .max(100, 'An invoice can have at most 100 line items'),
});

const dueOnOrAfterInvoiceDate = (d: { invoiceDate: string; dueDate: string }) => d.dueDate >= d.invoiceDate;
const dueDateError = { message: 'Due date cannot be before invoice date', path: ['dueDate'] };

/** `issue: true` creates and issues atomically (used by the "Issue" button on the create screen). */
export const createInvoiceSchema = invoiceBaseSchema
  .extend({ issue: z.boolean({ invalid_type_error: 'issue must be a boolean' }).optional().default(false) })
  .refine(dueOnOrAfterInvoiceDate, dueDateError);

/** Full replacement of a draft (header + all items). */
export const updateInvoiceSchema = invoiceBaseSchema.refine(dueOnOrAfterInvoiceDate, dueDateError);

export const invoiceListQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(INVOICE_STATUSES, {
        errorMap: () => ({ message: `status must be one of: ${INVOICE_STATUSES.join(', ')}` }),
      })
      .optional(),
  ),
  customerId: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: 'customerId must be a number' })
      .int('customerId must be an integer')
      .positive('customerId must be positive')
      .optional(),
  ),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;