import { Transaction } from 'sequelize';
import { sequelize, Customer, Invoice, Payment } from '../models';
import { AppError } from '../utils/errors';
import { fromPaise, toPaise } from '../utils/money';
import { CreatePaymentInput, PaymentListQuery } from '../validation/payment.schema';
import { paidByInvoice } from './invoice.service';
import { createJournalEntry } from './journal.service';
import { paymentDebitAccount, paymentLines } from './journalRules';
import { evaluatePayment } from './paymentRules';

/**
 * Records a payment all-or-nothing:
 *   lock invoice row (SELECT ... FOR UPDATE) -> check status + balance -> insert payment
 *   -> post Dr Cash/Bank, Cr AR -> update invoice status -> COMMIT.
 * Any failure rolls back everything.
 *
 * READ COMMITTED + the row lock means a second concurrent payment on the same invoice waits
 * for the first to commit and then sees its payment when summing, so overpayment is impossible.
 */
export async function recordPayment(input: CreatePaymentInput) {
  const amountPaise = toPaise(input.amount);

  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const invoice = await Invoice.findByPk(input.invoiceId, {
        transaction: t,
        lock: Transaction.LOCK.UPDATE,
      });
      if (!invoice) throw new AppError(404, `Invoice ${input.invoiceId} not found`);

      if (input.customerId !== undefined && input.customerId !== invoice.customerId) {
        throw new AppError(
          422,
          `Invoice ${invoice.invoiceNumber} does not belong to customer ${input.customerId}`,
        );
      }
      if (input.date < invoice.invoiceDate) {
        throw new AppError(
          422,
          `Payment date cannot be before the invoice date (${invoice.invoiceDate})`,
        );
      }

      const totalPaise = toPaise(invoice.total);
      const paidPaise = (await paidByInvoice([invoice.id], t)).get(invoice.id) ?? 0;

      const check = evaluatePayment({
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalPaise,
        paidPaise,
        amountPaise,
      });

      const payment = await Payment.create(
        {
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          date: input.date,
          amount: fromPaise(amountPaise),
          method: input.method,
          referenceNumber: input.referenceNumber,
        },
        { transaction: t },
      );

      const entry = await createJournalEntry(
        {
          date: input.date,
          description: `Payment received for invoice ${invoice.invoiceNumber} (${input.method})`,
          invoiceId: invoice.id,
          paymentId: payment.id,
          lines: paymentLines(input.method, amountPaise),
        },
        t,
      );

      await invoice.update({ status: check.newStatus }, { transaction: t });

      return {
        payment: {
          id: payment.id,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          date: payment.date,
          amount: fromPaise(amountPaise),
          method: payment.method,
          referenceNumber: payment.referenceNumber ?? null,
        },
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: check.newStatus,
          total: fromPaise(totalPaise),
          amountPaid: fromPaise(check.newPaidPaise),
          balanceDue: fromPaise(check.balanceAfterPaise),
        },
        journalEntry: {
          id: entry.id,
          debitAccount: paymentDebitAccount(input.method),
          amount: fromPaise(amountPaise),
        },
      };
    },
  );
}

export async function listPayments(filters: PaymentListQuery) {
  const where: { invoiceId?: number; customerId?: number } = {};
  if (filters.invoiceId) where.invoiceId = filters.invoiceId;
  if (filters.customerId) where.customerId = filters.customerId;

  const payments = await Payment.findAll({
    where,
    include: [
      { model: Invoice, as: 'invoice', attributes: ['id', 'invoiceNumber'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name'] },
    ],
    order: [
      ['date', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  return payments.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    customerId: p.customerId,
    customerName: p.customer?.name ?? null,
    date: p.date,
    amount: p.amount,
    method: p.method,
    referenceNumber: p.referenceNumber ?? null,
  }));
}