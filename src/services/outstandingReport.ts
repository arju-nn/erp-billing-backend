import { fromPaise, toPaise } from '../utils/money';

/** One row per open invoice, as returned by the SQL in report.service.ts. */
export interface OutstandingRow {
  id: number | string;
  invoice_number: string;
  invoice_date: unknown;
  due_date: unknown;
  status: string;
  total: string | number;
  paid: string | number;
  customer_id: number | string;
  customer_name: string;
  customer_email: string;
}

export interface OutstandingInvoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  daysOverdue: number;
}

export interface OutstandingCustomer {
  customerId: number;
  customerName: string;
  customerEmail: string;
  invoiceCount: number;
  totalInvoiced: string;
  totalPaid: string;
  outstanding: string;
  overdue: string;
  oldestDueDate: string | null;
  invoices: OutstandingInvoice[];
}

export interface OutstandingReport {
  asOf: string;
  customerCount: number;
  totalOutstanding: string;
  totalOverdue: string;
  customers: OutstandingCustomer[];
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const toDateString = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

interface Accumulator {
  customerId: number;
  customerName: string;
  customerEmail: string;
  invoicedPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  overduePaise: number;
  oldestDueDate: string | null;
  invoices: OutstandingInvoice[];
}

/** Pure aggregation: per customer, largest outstanding first. All math in paise. */
export function buildOutstandingReport(rows: OutstandingRow[], asOf: string): OutstandingReport {
  const byCustomer = new Map<number, Accumulator>();

  for (const row of rows) {
    const totalPaise = toPaise(row.total);
    const paidPaise = toPaise(row.paid);
    const balancePaise = totalPaise - paidPaise;
    if (balancePaise <= 0) continue;

    const customerId = Number(row.customer_id);
    const dueDate = toDateString(row.due_date);
    const daysOverdue = dueDate < asOf ? daysBetween(dueDate, asOf) : 0;

    let acc = byCustomer.get(customerId);
    if (!acc) {
      acc = {
        customerId,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        invoicedPaise: 0,
        paidPaise: 0,
        outstandingPaise: 0,
        overduePaise: 0,
        oldestDueDate: null,
        invoices: [],
      };
      byCustomer.set(customerId, acc);
    }

    acc.invoicedPaise += totalPaise;
    acc.paidPaise += paidPaise;
    acc.outstandingPaise += balancePaise;
    if (daysOverdue > 0) acc.overduePaise += balancePaise;
    if (acc.oldestDueDate === null || dueDate < acc.oldestDueDate) acc.oldestDueDate = dueDate;

    acc.invoices.push({
      id: Number(row.id),
      invoiceNumber: row.invoice_number,
      invoiceDate: toDateString(row.invoice_date),
      dueDate,
      status: row.status,
      total: fromPaise(totalPaise),
      amountPaid: fromPaise(paidPaise),
      balanceDue: fromPaise(balancePaise),
      daysOverdue,
    });
  }

  const sorted = [...byCustomer.values()].sort(
    (a, b) => b.outstandingPaise - a.outstandingPaise || a.customerName.localeCompare(b.customerName),
  );

  const totalOutstanding = sorted.reduce((s, c) => s + c.outstandingPaise, 0);
  const totalOverdue = sorted.reduce((s, c) => s + c.overduePaise, 0);

  return {
    asOf,
    customerCount: sorted.length,
    totalOutstanding: fromPaise(totalOutstanding),
    totalOverdue: fromPaise(totalOverdue),
    customers: sorted.map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      customerEmail: c.customerEmail,
      invoiceCount: c.invoices.length,
      totalInvoiced: fromPaise(c.invoicedPaise),
      totalPaid: fromPaise(c.paidPaise),
      outstanding: fromPaise(c.outstandingPaise),
      overdue: fromPaise(c.overduePaise),
      oldestDueDate: c.oldestDueDate,
      invoices: c.invoices.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.id - b.id)),
    })),
  };
}