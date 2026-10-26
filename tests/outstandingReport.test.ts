import { buildOutstandingReport, OutstandingRow } from '../src/services/outstandingReport';

const row = (o: Partial<OutstandingRow>): OutstandingRow => ({
  id: 1,
  invoice_number: 'INV-0001',
  invoice_date: '2026-09-01',
  due_date: '2026-10-01',
  status: 'issued',
  total: '0.00',
  paid: '0.00',
  customer_id: 1,
  customer_name: 'A',
  customer_email: 'a@x.in',
  ...o,
});

describe('buildOutstandingReport (seed data as of 2026-10-26)', () => {
  const rows: OutstandingRow[] = [
    row({ id: 2, invoice_number: 'INV-0002', due_date: '2026-10-15', total: '11800.00', paid: '0', customer_id: 2, customer_name: 'Bluewave Technologies' }),
    row({ id: 3, invoice_number: 'INV-0003', due_date: '2026-10-20', status: 'partly_paid', total: '29500.00', paid: '10000.00', customer_id: 1, customer_name: 'Acme Traders Pvt Ltd' }),
    row({ id: 5, invoice_number: 'INV-0005', due_date: '2026-11-09', status: 'partly_paid', total: '42480.00', paid: '12000.00', customer_id: 2, customer_name: 'Bluewave Technologies' }),
  ];
  const report = buildOutstandingReport(rows, '2026-10-26');

  it('orders customers by outstanding, largest first', () => {
    expect(report.customers.map((c) => c.customerName)).toEqual(['Bluewave Technologies', 'Acme Traders Pvt Ltd']);
    expect(report.customers[0].outstanding).toBe('42280.00');
    expect(report.customers[1].outstanding).toBe('19500.00');
  });

  it('totals match Accounts Receivable (61780.00)', () => {
    expect(report.totalOutstanding).toBe('61780.00');
  });

  it('computes overdue amounts and days', () => {
    expect(report.customers[0].overdue).toBe('11800.00');
    expect(report.customers[0].invoices[0].daysOverdue).toBe(11);
    expect(report.customers[0].invoices[1].daysOverdue).toBe(0);
    expect(report.totalOverdue).toBe('31300.00');
  });

  it('skips fully paid rows', () => {
    const r = buildOutstandingReport([row({ total: '100.00', paid: '100.00' })], '2026-10-26');
    expect(r.customerCount).toBe(0);
    expect(r.totalOutstanding).toBe('0.00');
  });
});