import { evaluatePayment } from '../src/services/paymentRules';
import { calculateInvoice } from '../src/services/invoiceCalc';

describe('evaluatePayment (spec example: 2 x 5000 @ 18%)', () => {
  const { total } = calculateInvoice([{ description: 'Consulting', quantity: 2, unitPrice: 5000, taxRate: 18 }]);
  const base = { invoiceNumber: 'INV-0099', totalPaise: total };

  it('total is 11800.00', () => {
    expect(total).toBe(1_180_000);
  });

  it('5000 on an issued invoice -> partly_paid with 6800 due', () => {
    const r = evaluatePayment({ ...base, status: 'issued', paidPaise: 0, amountPaise: 500_000 });
    expect(r.newStatus).toBe('partly_paid');
    expect(r.newPaidPaise).toBe(500_000);
    expect(r.balanceAfterPaise).toBe(680_000);
  });

  it('a further 7000 is rejected with 400 and a clear message', () => {
    expect(() =>
      evaluatePayment({ ...base, status: 'partly_paid', paidPaise: 500_000, amountPaise: 700_000 }),
    ).toThrow('Payment of 7000.00 exceeds the remaining balance of 6800.00 on invoice INV-0099');
    try {
      evaluatePayment({ ...base, status: 'partly_paid', paidPaise: 500_000, amountPaise: 700_000 });
    } catch (e) {
      expect((e as { status: number }).status).toBe(400);
    }
  });

  it('paying the exact remaining 6800 -> paid with 0 due', () => {
    const r = evaluatePayment({ ...base, status: 'partly_paid', paidPaise: 500_000, amountPaise: 680_000 });
    expect(r.newStatus).toBe('paid');
    expect(r.balanceAfterPaise).toBe(0);
  });

  it('rejects payments on draft and paid invoices with 409', () => {
    expect(() => evaluatePayment({ ...base, status: 'draft', paidPaise: 0, amountPaise: 100 })).toThrow(
      'is a draft',
    );
    expect(() => evaluatePayment({ ...base, status: 'paid', paidPaise: total, amountPaise: 100 })).toThrow(
      'already fully paid',
    );
  });

  it('rejects zero or negative amounts', () => {
    expect(() => evaluatePayment({ ...base, status: 'issued', paidPaise: 0, amountPaise: 0 })).toThrow(
      'greater than 0',
    );
  });
});