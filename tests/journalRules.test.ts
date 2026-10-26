import { ACCOUNT_CODES } from '../src/constants/accounts';
import { assertBalanced, invoiceIssueLines, paymentLines } from '../src/services/journalRules';

describe('journal rules', () => {
  it('builds a balanced invoice issue entry', () => {
    const lines = invoiceIssueLines({ subtotal: 1_000_000, tax: 180_000, total: 1_180_000 });
    expect(lines).toEqual([
      { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: 1_180_000, credit: 0 },
      { accountCode: ACCOUNT_CODES.SALES, debit: 0, credit: 1_000_000 },
      { accountCode: ACCOUNT_CODES.GST_PAYABLE, debit: 0, credit: 180_000 },
    ]);
    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it('omits the GST line when tax is zero', () => {
    const lines = invoiceIssueLines({ subtotal: 5000, tax: 0, total: 5000 });
    expect(lines).toHaveLength(2);
    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it('debits Cash for cash and Bank for bank transfer / UPI', () => {
    expect(paymentLines('cash', 500)[0].accountCode).toBe(ACCOUNT_CODES.CASH);
    expect(paymentLines('bank_transfer', 500)[0].accountCode).toBe(ACCOUNT_CODES.BANK);
    expect(paymentLines('upi', 500)[0].accountCode).toBe(ACCOUNT_CODES.BANK);
    expect(paymentLines('upi', 500)[1]).toEqual({
      accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debit: 0,
      credit: 500,
    });
  });

  it('rejects unbalanced and malformed entries', () => {
    expect(() =>
      assertBalanced([
        { accountCode: '1000', debit: 100, credit: 0 },
        { accountCode: '1100', debit: 0, credit: 99 },
      ]),
    ).toThrow('unbalanced');
    expect(() =>
      assertBalanced([
        { accountCode: '1000', debit: 100, credit: 100 },
        { accountCode: '1100', debit: 0, credit: 0 },
      ]),
    ).toThrow('either a debit or a credit');
    expect(() => assertBalanced([{ accountCode: '1000', debit: 100, credit: 0 }])).toThrow('at least two lines');
  });
});