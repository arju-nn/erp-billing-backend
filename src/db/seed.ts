import { applySchema } from './applySchema';
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
import { ACCOUNT_CODES, CHART_OF_ACCOUNTS } from '../constants/accounts';
import { PaymentMethod } from '../constants/enums';
import { calculateInvoice, deriveStatus, LineInput, toItemAttributes } from '../services/invoiceCalc';
import { postJournalEntry } from '../services/journal.service';
import { invoiceIssueLines, paymentLines } from '../services/journalRules';
import { fromPaise, toPaise } from '../utils/money';

interface SeedPayment {
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
}

interface SeedInvoice {
  invoiceNumber: string;
  customerEmail: string;
  invoiceDate: string;
  dueDate: string;
  issue: boolean;
  lines: LineInput[];
  payments: SeedPayment[];
}

const CUSTOMERS = [
  {
    name: 'Acme Traders Pvt Ltd',
    email: 'accounts@acmetraders.in',
    phone: '+91 98470 11111',
    gstNumber: '32AABCA1234F1Z5',
  },
  {
    name: 'Bluewave Technologies',
    email: 'billing@bluewave.io',
    phone: '+91 98950 22222',
    gstNumber: '29AACCB5678K1Z2',
  },
  {
    name: 'Coastal Cafe',
    email: 'owner@coastalcafe.in',
    phone: '+91 94470 33333',
    gstNumber: null,
  },
];

const INVOICES: SeedInvoice[] = [
  {
    // draft: no journal entry
    invoiceNumber: 'INV-0001',
    customerEmail: 'accounts@acmetraders.in',
    invoiceDate: '2026-10-01',
    dueDate: '2026-10-31',
    issue: false,
    lines: [
      { description: 'Website maintenance (October)', quantity: 1, unitPrice: 15000, taxRate: 18 },
      { description: 'Domain renewal', quantity: 2, unitPrice: 900, taxRate: 18 },
    ],
    payments: [],
  },
  {
    // issued, unpaid: 10000 + 1800 = 11800 (spec example)
    invoiceNumber: 'INV-0002',
    customerEmail: 'billing@bluewave.io',
    invoiceDate: '2026-09-15',
    dueDate: '2026-10-15',
    issue: true,
    lines: [{ description: 'Consulting (days)', quantity: 2, unitPrice: 5000, taxRate: 18 }],
    payments: [],
  },
  {
    // 25000 + 4500 = 29500; 10000 paid by bank -> partly_paid, 19500 due
    invoiceNumber: 'INV-0003',
    customerEmail: 'accounts@acmetraders.in',
    invoiceDate: '2026-09-20',
    dueDate: '2026-10-20',
    issue: true,
    lines: [
      { description: 'ERP implementation', quantity: 1, unitPrice: 20000, taxRate: 18 },
      { description: 'User training (hours)', quantity: 4, unitPrice: 1250, taxRate: 18 },
    ],
    payments: [{ date: '2026-10-05', amount: 10000, method: 'bank_transfer', reference: 'NEFT-884512' }],
  },
  {
    // 4500 + 225 = 4725; fully paid in cash -> paid
    invoiceNumber: 'INV-0004',
    customerEmail: 'owner@coastalcafe.in',
    invoiceDate: '2026-09-10',
    dueDate: '2026-09-25',
    issue: true,
    lines: [{ description: 'Menu printing (sets)', quantity: 3, unitPrice: 1500, taxRate: 5 }],
    payments: [{ date: '2026-09-24', amount: 4725, method: 'cash', reference: null }],
  },
  {
    // 36000 + 6480 = 42480; 12000 via UPI -> partly_paid, 30480 due
    invoiceNumber: 'INV-0005',
    customerEmail: 'billing@bluewave.io',
    invoiceDate: '2026-10-10',
    dueDate: '2026-11-09',
    issue: true,
    lines: [{ description: 'Cloud hosting (annual)', quantity: 1, unitPrice: 36000, taxRate: 18 }],
    payments: [{ date: '2026-10-15', amount: 12000, method: 'upi', reference: 'UPI-430918227711' }],
  },
  {
    // draft with paise: 7999.50 + 959.94 = 8959.44
    invoiceNumber: 'INV-0006',
    customerEmail: 'owner@coastalcafe.in',
    invoiceDate: '2026-10-20',
    dueDate: '2026-11-19',
    issue: false,
    lines: [{ description: 'POS terminal setup', quantity: 1, unitPrice: 7999.5, taxRate: 12 }],
    payments: [],
  },
];

async function seed(): Promise<void> {
  console.log('Applying schema (drops and recreates all tables)...');
  await applySchema();

  await sequelize.transaction(async (t) => {
    await Account.bulkCreate(CHART_OF_ACCOUNTS, { transaction: t });

    const customerByEmail = new Map<string, Customer>();
    for (const c of CUSTOMERS) {
      const customer = await Customer.create(c, { transaction: t });
      customerByEmail.set(customer.email, customer);
    }

    await postJournalEntry(
      {
        date: '2026-09-01',
        description: "Owner's capital introduced",
        lines: [
          { accountCode: ACCOUNT_CODES.BANK, debit: toPaise(500000), credit: 0 },
          { accountCode: ACCOUNT_CODES.OWNERS_CAPITAL, debit: 0, credit: toPaise(500000) },
        ],
      },
      t,
    );

    for (const inv of INVOICES) {
      const customer = customerByEmail.get(inv.customerEmail);
      if (!customer) throw new Error(`Seed customer not found: ${inv.customerEmail}`);

      const calc = calculateInvoice(inv.lines);
      const invoice = await Invoice.create(
        {
          invoiceNumber: inv.invoiceNumber,
          customerId: customer.id,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          status: 'draft',
          subtotal: fromPaise(calc.subtotal),
          taxAmount: fromPaise(calc.tax),
          total: fromPaise(calc.total),
        },
        { transaction: t },
      );

      await InvoiceItem.bulkCreate(
        calc.lines.map((l) => ({ invoiceId: invoice.id, ...toItemAttributes(l) })),
        { transaction: t },
      );

      if (!inv.issue) continue;

      await postJournalEntry(
        {
          date: inv.invoiceDate,
          description: `Invoice ${inv.invoiceNumber} issued`,
          invoiceId: invoice.id,
          lines: invoiceIssueLines(calc),
        },
        t,
      );

      let paid = 0;
      for (const p of inv.payments) {
        const amount = toPaise(p.amount);
        if (amount <= 0 || paid + amount > calc.total) {
          throw new Error(`Seed payment exceeds balance on ${inv.invoiceNumber}`);
        }
        const payment = await Payment.create(
          {
            customerId: customer.id,
            invoiceId: invoice.id,
            date: p.date,
            amount: fromPaise(amount),
            method: p.method,
            referenceNumber: p.reference,
          },
          { transaction: t },
        );
        await postJournalEntry(
          {
            date: p.date,
            description: `Payment for ${inv.invoiceNumber} (${p.method})`,
            invoiceId: invoice.id,
            paymentId: payment.id,
            lines: paymentLines(p.method, amount),
          },
          t,
        );
        paid += amount;
      }

      await invoice.update({ status: deriveStatus(calc.total, paid) }, { transaction: t });
    }
  });

  const [accounts, customers, invoices, payments, entries] = await Promise.all([
    Account.count(),
    Customer.count(),
    Invoice.count(),
    Payment.count(),
    JournalEntry.count(),
  ]);
  const totalDebit = toPaise(Number((await JournalLine.sum('debit')) ?? 0));
  const totalCredit = toPaise(Number((await JournalLine.sum('credit')) ?? 0));

  console.log(
    `Seeded: ${accounts} accounts, ${customers} customers, ${invoices} invoices, ` +
      `${payments} payments, ${entries} journal entries`,
  );
  console.log(
    `Journal totals: debit ${fromPaise(totalDebit)} / credit ${fromPaise(totalCredit)} -> ` +
      (totalDebit === totalCredit ? 'BALANCED' : 'NOT BALANCED'),
  );
  if (totalDebit !== totalCredit) throw new Error('Seeded journal is not balanced');
}

seed()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await sequelize.close().catch(() => undefined);
    process.exit(1);
  });