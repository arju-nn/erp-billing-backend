import { ACCOUNT_CODES } from '../constants/accounts';
import { PaymentMethod } from '../constants/enums';
import { AppError } from '../utils/errors';
import { fromPaise } from '../utils/money';

/** Amounts in integer paise; exactly one of debit/credit must be > 0. */
export interface JournalLineInput {
  accountCode: string;
  debit: number;
  credit: number;
}

export function assertBalanced(lines: JournalLineInput[]): void {
  if (!lines || lines.length < 2) {
    throw new AppError(422, 'A journal entry needs at least two lines');
  }
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.debit) || !Number.isInteger(line.credit)) {
      throw new AppError(422, 'Journal amounts must be whole paise');
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new AppError(422, 'Journal amounts cannot be negative');
    }
    if ((line.debit > 0) === (line.credit > 0)) {
      throw new AppError(422, 'Each journal line must have either a debit or a credit, not both or neither');
    }
    debits += line.debit;
    credits += line.credit;
  }
  if (debits !== credits) {
    throw new AppError(
      422,
      `Journal entry is unbalanced: debits ${fromPaise(debits)} != credits ${fromPaise(credits)}`,
    );
  }
}

/** Dr Accounts Receivable (total) / Cr Sales (subtotal) / Cr GST Payable (tax). */
export function invoiceIssueLines(totals: {
  subtotal: number;
  tax: number;
  total: number;
}): JournalLineInput[] {
  if (totals.subtotal + totals.tax !== totals.total) {
    throw new AppError(422, 'Invoice total does not equal subtotal + tax');
  }
  const lines: JournalLineInput[] = [
    { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: totals.total, credit: 0 },
    { accountCode: ACCOUNT_CODES.SALES, debit: 0, credit: totals.subtotal },
  ];
  if (totals.tax > 0) {
    lines.push({ accountCode: ACCOUNT_CODES.GST_PAYABLE, debit: 0, credit: totals.tax });
  }
  return lines;
}

export function paymentDebitAccount(method: PaymentMethod): string {
  return method === 'cash' ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
}

/** Cash: Dr Cash / Cr AR. Bank transfer & UPI: Dr Bank / Cr AR. */
export function paymentLines(method: PaymentMethod, amountPaise: number): JournalLineInput[] {
  return [
    { accountCode: paymentDebitAccount(method), debit: amountPaise, credit: 0 },
    { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: 0, credit: amountPaise },
  ];
}