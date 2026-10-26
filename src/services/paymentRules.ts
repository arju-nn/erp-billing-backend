import { InvoiceStatus } from '../constants/enums';
import { AppError } from '../utils/errors';
import { fromPaise } from '../utils/money';

export interface PaymentCheckInput {
  invoiceNumber: string;
  status: InvoiceStatus;
  totalPaise: number;
  paidPaise: number;
  amountPaise: number;
}

export interface PaymentCheckResult {
  newPaidPaise: number;
  balanceAfterPaise: number;
  newStatus: 'partly_paid' | 'paid';
}

/**
 * Pure payment rules (no DB), so they can be unit tested:
 * - only issued / partly_paid invoices accept payments (409 otherwise)
 * - amount must be > 0 (400)
 * - amount cannot exceed the remaining balance (400)
 * - resulting status is partly_paid or paid
 */
export function evaluatePayment(input: PaymentCheckInput): PaymentCheckResult {
  const { invoiceNumber, status, totalPaise, paidPaise, amountPaise } = input;

  if (status === 'draft') {
    throw new AppError(409, `Invoice ${invoiceNumber} is a draft; issue it before recording payments`);
  }
  if (status === 'paid') {
    throw new AppError(409, `Invoice ${invoiceNumber} is already fully paid`);
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new AppError(400, 'Payment amount must be greater than 0');
  }

  const balancePaise = totalPaise - paidPaise;
  if (amountPaise > balancePaise) {
    throw new AppError(
      400,
      `Payment of ${fromPaise(amountPaise)} exceeds the remaining balance of ${fromPaise(balancePaise)} on invoice ${invoiceNumber}`,
    );
  }

  const newPaidPaise = paidPaise + amountPaise;
  return {
    newPaidPaise,
    balanceAfterPaise: totalPaise - newPaidPaise,
    newStatus: newPaidPaise >= totalPaise ? 'paid' : 'partly_paid',
  };
}