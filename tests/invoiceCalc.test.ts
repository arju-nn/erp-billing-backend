import { calculateInvoice, deriveStatus } from '../src/services/invoiceCalc';

describe('calculateInvoice', () => {
  it('computes the spec example: 2 x 5000 @ 18%', () => {
    const r = calculateInvoice([{ description: 'Consulting', quantity: 2, unitPrice: 5000, taxRate: 18 }]);
    expect(r.subtotal).toBe(1_000_000);
    expect(r.tax).toBe(180_000);
    expect(r.total).toBe(1_180_000);
  });

  it('avoids floating point drift', () => {
    const r = calculateInvoice([
      { description: 'A', quantity: 1, unitPrice: 0.1, taxRate: 0 },
      { description: 'B', quantity: 1, unitPrice: 0.2, taxRate: 0 },
      { description: 'C', quantity: 3, unitPrice: 0.1, taxRate: 0 },
    ]);
    expect(r.subtotal).toBe(60);
    expect(r.total).toBe(60);
  });

  it('handles paise amounts and rounds tax per line', () => {
    const r = calculateInvoice([{ description: 'POS', quantity: 1, unitPrice: 7999.5, taxRate: 12 }]);
    expect(r.subtotal).toBe(799_950);
    expect(r.tax).toBe(95_994);
    expect(r.total).toBe(895_944);
  });

  it('sums multiple lines', () => {
    const r = calculateInvoice([
      { description: 'ERP', quantity: 1, unitPrice: 20000, taxRate: 18 },
      { description: 'Training', quantity: 4, unitPrice: 1250, taxRate: 18 },
    ]);
    expect(r.subtotal).toBe(2_500_000);
    expect(r.tax).toBe(450_000);
    expect(r.total).toBe(2_950_000);
  });

  it('rejects non-positive quantity and price, and empty invoices', () => {
    expect(() => calculateInvoice([{ description: 'X', quantity: 0, unitPrice: 10, taxRate: 0 }])).toThrow(
      'Quantity must be greater than 0',
    );
    expect(() => calculateInvoice([{ description: 'X', quantity: 1, unitPrice: 0, taxRate: 0 }])).toThrow(
      'Unit price must be greater than 0',
    );
    expect(() => calculateInvoice([])).toThrow('at least one line item');
  });
});

describe('deriveStatus', () => {
  it('maps paid amount to status', () => {
    expect(deriveStatus(1_180_000, 0)).toBe('issued');
    expect(deriveStatus(1_180_000, 500_000)).toBe('partly_paid');
    expect(deriveStatus(1_180_000, 1_180_000)).toBe('paid');
  });
});