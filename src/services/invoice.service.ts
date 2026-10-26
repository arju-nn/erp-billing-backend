import { QueryTypes, Transaction, UniqueConstraintError } from 'sequelize';
import {
  sequelize,
  Account,
  Customer,
  Invoice,
  InvoiceItem,
  JournalEntry,
  JournalLine,
  Payment,
} from '../models';
import { InvoiceStatus } from '../constants/enums';
import { AppError } from '../utils/errors';
import { fromPaise, toPaise } from '../utils/money';
import { calculateInvoice, InvoiceCalculation, LineInput, toItemAttributes } from './invoiceCalc';
import { invoiceIssueLines } from './journalRules';
import { createJournalEntry } from './journal.service';

/** DECIMAL(12,2) upper bound, in paise. */
const MAX_AMOUNT_PAISE = 999_999_999_999;
const INVOICE_NUMBER_RETRIES = 3;

export interface InvoiceListFilters {
  status?: InvoiceStatus;
  customerId?: number;
}

export interface InvoiceInput {
  customerId: number;
  invoiceDate: string;
  dueDate: string;
  items: LineInput[];
}

export interface CreateInvoiceServiceInput extends InvoiceInput {
  issue?: boolean;
}

export interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customer: { id: number; name: string; email: string } | null;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
}

export interface InvoiceDetail extends Omit<InvoiceSummary, 'customer'> {
  customer: { id: number; name: string; email: string; phone: string; gstNumber: string | null } | null;
  items: {
    id: number;
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    lineTotal: string;
  }[];
  payments: {
    id: number;
    date: string;
    amount: string;
    method: string;
    referenceNumber: string | null;
  }[];
  journalEntries: {
    id: number;
    date: string;
    description: string;
    paymentId: number | null;
    lines: { accountCode: string | null; accountName: string | null; debit: string; credit: string }[];
  }[];
}

// ---------- helpers ----------

/** Sum of payments per invoice, in paise. */
export async function paidByInvoice(ids: number[], transaction?: Transaction): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (ids.length === 0) return map;
  const rows = (await sequelize.query(
    'SELECT invoice_id, SUM(amount) AS paid FROM payments WHERE invoice_id IN (:ids) GROUP BY invoice_id',
    { replacements: { ids }, type: QueryTypes.SELECT, transaction },
  )) as Array<{ invoice_id: number | string; paid: string | number }>;
  for (const row of rows) map.set(Number(row.invoice_id), toPaise(row.paid));
  return map;
}

function calculateChecked(items: LineInput[]): InvoiceCalculation {
  const calc = calculateInvoice(items);
  if (calc.total > MAX_AMOUNT_PAISE) {
    throw new AppError(422, 'Invoice total exceeds the maximum allowed amount (9,999,999,999.99)');
  }
  return calc;
}

function totalsAttributes(calc: InvoiceCalculation) {
  return {
    subtotal: fromPaise(calc.subtotal),
    taxAmount: fromPaise(calc.tax),
    total: fromPaise(calc.total),
  };
}

async function ensureCustomerExists(customerId: number, transaction: Transaction): Promise<void> {
  const customer = await Customer.findByPk(customerId, { transaction });
  if (!customer) throw new AppError(422, `Customer ${customerId} does not exist`);
}

async function nextInvoiceNumber(transaction: Transaction): Promise<string> {
  const rows = (await sequelize.query(
    "SELECT MAX(CAST(SUBSTRING(invoice_number, 5) AS UNSIGNED)) AS maxNo FROM invoices WHERE invoice_number LIKE 'INV-%'",
    { type: QueryTypes.SELECT, transaction },
  )) as Array<{ maxNo: number | string | null }>;
  const next = Number(rows[0]?.maxNo ?? 0) + 1;
  return `INV-${String(next).padStart(4, '0')}`;
}

async function lockInvoice(id: number, transaction: Transaction): Promise<Invoice> {
  const invoice = await Invoice.findByPk(id, { transaction, lock: Transaction.LOCK.UPDATE });
  if (!invoice) throw new AppError(404, `Invoice ${id} not found`);
  return invoice;
}

function assertDraft(invoice: Invoice, action: string): void {
  if (invoice.status !== 'draft') {
    throw new AppError(
      409,
      `Only draft invoices can be ${action}; invoice ${invoice.invoiceNumber} is ${invoice.status}`,
    );
  }
}

function toSummary(invoice: Invoice, paidPaise: number): InvoiceSummary {
  const totalPaise = toPaise(invoice.total);
  const customer = invoice.customer;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customer: customer ? { id: customer.id, name: customer.name, email: customer.email } : null,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    amountPaid: fromPaise(paidPaise),
    balanceDue: fromPaise(totalPaise - paidPaise),
  };
}

/**
 * Issues an invoice already loaded inside `transaction` (locked, or freshly created).
 * Recalculates from stored items, posts Dr AR / Cr Sales / Cr GST, and sets status = issued,
 * all in the caller's transaction.
 */
async function issueWithinTransaction(invoice: Invoice, transaction: Transaction): Promise<void> {
  assertDraft(invoice, 'issued');

  const items = await InvoiceItem.findAll({ where: { invoiceId: invoice.id }, transaction });
  const calc = calculateChecked(
    items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      taxRate: Number(i.taxRate),
    })),
  );

  await createJournalEntry(
    {
      date: invoice.invoiceDate,
      description: `Invoice ${invoice.invoiceNumber} issued`,
      invoiceId: invoice.id,
      lines: invoiceIssueLines(calc),
    },
    transaction,
  );

  await invoice.update({ status: 'issued', ...totalsAttributes(calc) }, { transaction });
}

// ---------- queries ----------

export async function listInvoices(filters: InvoiceListFilters): Promise<InvoiceSummary[]> {
  const where: { status?: InvoiceStatus; customerId?: number } = {};
  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.customerId = filters.customerId;

  const invoices = await Invoice.findAll({
    where,
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email'] }],
    order: [
      ['invoiceDate', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  const paid = await paidByInvoice(invoices.map((i) => i.id));
  return invoices.map((i) => toSummary(i, paid.get(i.id) ?? 0));
}

export async function getInvoiceDetail(id: number): Promise<InvoiceDetail> {
  const invoice = await Invoice.findByPk(id, {
    include: [
      { model: Customer, as: 'customer' },
      { model: InvoiceItem, as: 'items' },
      { model: Payment, as: 'payments' },
    ],
  });
  if (!invoice) throw new AppError(404, `Invoice ${id} not found`);

  const entries = await JournalEntry.findAll({
    where: { invoiceId: id },
    include: [
      {
        model: JournalLine,
        as: 'lines',
        include: [{ model: Account, as: 'account', attributes: ['id', 'code', 'name'] }],
      },
    ],
    order: [['id', 'ASC']],
  });

  const items = [...(invoice.items ?? [])].sort((a, b) => a.id - b.id);
  const payments = [...(invoice.payments ?? [])].sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
  );
  const paidPaise = payments.reduce((sum, p) => sum + toPaise(p.amount), 0);
  const customer = invoice.customer;

  return {
    ...toSummary(invoice, paidPaise),
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          gstNumber: customer.gstNumber ?? null,
        }
      : null,
    items: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      lineTotal: i.lineTotal,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      referenceNumber: p.referenceNumber ?? null,
    })),
    journalEntries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      paymentId: e.paymentId ?? null,
      lines: [...(e.lines ?? [])]
        .sort((a, b) => a.id - b.id)
        .map((l) => ({
          accountCode: l.account ? l.account.code : null,
          accountName: l.account ? l.account.name : null,
          debit: l.debit,
          credit: l.credit,
        })),
    })),
  };
}

// ---------- commands ----------

export async function createInvoice(input: CreateInvoiceServiceInput): Promise<InvoiceDetail> {
  const calc = calculateChecked(input.items);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= INVOICE_NUMBER_RETRIES; attempt++) {
    try {
      const id = await sequelize.transaction(async (t) => {
        await ensureCustomerExists(input.customerId, t);

        const invoiceNumber = await nextInvoiceNumber(t);
        const invoice = await Invoice.create(
          {
            invoiceNumber,
            customerId: input.customerId,
            invoiceDate: input.invoiceDate,
            dueDate: input.dueDate,
            status: 'draft',
            ...totalsAttributes(calc),
          },
          { transaction: t },
        );

        await InvoiceItem.bulkCreate(
          calc.lines.map((l) => ({ invoiceId: invoice.id, ...toItemAttributes(l) })),
          { transaction: t },
        );

        if (input.issue) {
          await issueWithinTransaction(invoice, t);
        }
        return invoice.id;
      });
      return getInvoiceDetail(id);
    } catch (err) {
      // Two concurrent creates can compute the same next number; the unique key rejects one -> retry.
      if (err instanceof UniqueConstraintError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new AppError(409, 'Could not allocate an invoice number, please retry');
}

export async function updateDraftInvoice(id: number, input: InvoiceInput): Promise<InvoiceDetail> {
  const calc = calculateChecked(input.items);

  await sequelize.transaction(async (t) => {
    const invoice = await lockInvoice(id, t);
    assertDraft(invoice, 'edited');
    await ensureCustomerExists(input.customerId, t);

    await invoice.update(
      {
        customerId: input.customerId,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        ...totalsAttributes(calc),
      },
      { transaction: t },
    );

    await InvoiceItem.destroy({ where: { invoiceId: id }, transaction: t });
    await InvoiceItem.bulkCreate(
      calc.lines.map((l) => ({ invoiceId: id, ...toItemAttributes(l) })),
      { transaction: t },
    );
  });

  return getInvoiceDetail(id);
}

export async function deleteDraftInvoice(id: number): Promise<void> {
  await sequelize.transaction(async (t) => {
    const invoice = await lockInvoice(id, t);
    assertDraft(invoice, 'deleted');
    await InvoiceItem.destroy({ where: { invoiceId: id }, transaction: t });
    await invoice.destroy({ transaction: t });
  });
}

export async function issueInvoice(id: number): Promise<InvoiceDetail> {
  await sequelize.transaction(async (t) => {
    const invoice = await lockInvoice(id, t);
    await issueWithinTransaction(invoice, t);
  });
  return getInvoiceDetail(id);
}