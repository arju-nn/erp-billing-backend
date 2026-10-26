import { fromPaise, toPaise } from '../utils/money';
import { toDateString } from './outstandingReport';

export type NormalSide = 'debit' | 'credit';

/** Assets and expenses increase with debits; liabilities, equity and income with credits. */
export const normalSide = (type: string): NormalSide =>
  type === 'asset' || type === 'expense' ? 'debit' : 'credit';

const byCode = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);

// ---------- account balances ----------

/** One row per account with summed journal lines (see ledger.service.ts SQL). */
export interface AccountTotalsRow {
  id: number | string;
  code: string;
  name: string;
  type: string;
  total_debit: string | number | null;
  total_credit: string | number | null;
  line_count?: string | number | null;
}

export interface AccountBalance {
  id: number;
  code: string;
  name: string;
  type: string;
  normalBalance: NormalSide;
  totalDebit: string;
  totalCredit: string;
  /** Signed in the account's normal direction (negative = contra balance). */
  balance: string;
  lineCount: number;
}

export function buildAccountBalances(rows: AccountTotalsRow[]): AccountBalance[] {
  return rows
    .map((r) => {
      const debit = toPaise(r.total_debit ?? 0);
      const credit = toPaise(r.total_credit ?? 0);
      const side = normalSide(r.type);
      return {
        id: Number(r.id),
        code: r.code,
        name: r.name,
        type: r.type,
        normalBalance: side,
        totalDebit: fromPaise(debit),
        totalCredit: fromPaise(credit),
        balance: fromPaise(side === 'debit' ? debit - credit : credit - debit),
        lineCount: Number(r.line_count ?? 0),
      };
    })
    .sort(byCode);
}

// ---------- trial balance ----------

export interface TrialBalanceRow {
  accountId: number;
  code: string;
  name: string;
  type: string;
  totalDebit: string;
  totalCredit: string;
  /** Net balance shown in the debit column (0.00 if the account nets to credit). */
  debit: string;
  /** Net balance shown in the credit column (0.00 if the account nets to debit). */
  credit: string;
  /** Signed net balance in the account's normal direction. */
  balance: string;
}

export interface TrialBalance {
  asOf: string | null;
  rows: TrialBalanceRow[];
  totals: { debit: string; credit: string; difference: string; balanced: boolean };
  grossTotals: { debit: string; credit: string; balanced: boolean };
  summary: {
    assets: string;
    liabilities: string;
    equity: string;
    income: string;
    expenses: string;
    netIncome: string;
    /** Assets = Liabilities + Equity + (Income - Expenses) */
    equationBalanced: boolean;
  };
}

export function buildTrialBalance(rows: AccountTotalsRow[], asOf: string | null): TrialBalance {
  let netDebitTotal = 0;
  let netCreditTotal = 0;
  let grossDebit = 0;
  let grossCredit = 0;
  const byType: Record<string, number> = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 };

  const out = [...rows].sort(byCode).map((r) => {
    const debit = toPaise(r.total_debit ?? 0);
    const credit = toPaise(r.total_credit ?? 0);
    grossDebit += debit;
    grossCredit += credit;

    const net = debit - credit;
    const debitColumn = net > 0 ? net : 0;
    const creditColumn = net < 0 ? -net : 0;
    netDebitTotal += debitColumn;
    netCreditTotal += creditColumn;

    const normal = normalSide(r.type) === 'debit' ? net : -net;
    byType[r.type] = (byType[r.type] ?? 0) + normal;

    return {
      accountId: Number(r.id),
      code: r.code,
      name: r.name,
      type: r.type,
      totalDebit: fromPaise(debit),
      totalCredit: fromPaise(credit),
      debit: fromPaise(debitColumn),
      credit: fromPaise(creditColumn),
      balance: fromPaise(normal),
    };
  });

  const assets = byType.asset ?? 0;
  const liabilities = byType.liability ?? 0;
  const equity = byType.equity ?? 0;
  const income = byType.income ?? 0;
  const expenses = byType.expense ?? 0;
  const netIncome = income - expenses;

  return {
    asOf,
    rows: out,
    totals: {
      debit: fromPaise(netDebitTotal),
      credit: fromPaise(netCreditTotal),
      difference: fromPaise(netDebitTotal - netCreditTotal),
      balanced: netDebitTotal === netCreditTotal,
    },
    grossTotals: {
      debit: fromPaise(grossDebit),
      credit: fromPaise(grossCredit),
      balanced: grossDebit === grossCredit,
    },
    summary: {
      assets: fromPaise(assets),
      liabilities: fromPaise(liabilities),
      equity: fromPaise(equity),
      income: fromPaise(income),
      expenses: fromPaise(expenses),
      netIncome: fromPaise(netIncome),
      equationBalanced: assets === liabilities + equity + netIncome,
    },
  };
}

// ---------- journal entries ----------

export interface JournalEntryRow {
  id: number | string;
  date: unknown;
  description: string;
  invoice_id: number | string | null;
  payment_id: number | string | null;
  invoice_number: string | null;
}

export interface JournalLineRow {
  id: number | string;
  entry_id: number | string;
  account_id: number | string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: string | number;
  credit: string | number;
}

export interface JournalEntryDto {
  id: number;
  date: string;
  description: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  paymentId: number | null;
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  lines: {
    id: number;
    accountId: number;
    accountCode: string;
    accountName: string;
    accountType: string;
    debit: string;
    credit: string;
  }[];
}

const toNullableId = (v: number | string | null): number | null => (v === null || v === undefined ? null : Number(v));

/** Attaches lines to their entries, keeping the entries' order. */
export function groupJournalEntries(entries: JournalEntryRow[], lines: JournalLineRow[]): JournalEntryDto[] {
  const linesByEntry = new Map<number, JournalLineRow[]>();
  for (const line of lines) {
    const key = Number(line.entry_id);
    const list = linesByEntry.get(key) ?? [];
    list.push(line);
    linesByEntry.set(key, list);
  }

  return entries.map((e) => {
    const entryLines = (linesByEntry.get(Number(e.id)) ?? []).sort((a, b) => Number(a.id) - Number(b.id));
    const debit = entryLines.reduce((s, l) => s + toPaise(l.debit), 0);
    const credit = entryLines.reduce((s, l) => s + toPaise(l.credit), 0);
    return {
      id: Number(e.id),
      date: toDateString(e.date),
      description: e.description,
      invoiceId: toNullableId(e.invoice_id),
      invoiceNumber: e.invoice_number ?? null,
      paymentId: toNullableId(e.payment_id),
      totalDebit: fromPaise(debit),
      totalCredit: fromPaise(credit),
      balanced: debit === credit,
      lines: entryLines.map((l) => ({
        id: Number(l.id),
        accountId: Number(l.account_id),
        accountCode: l.account_code,
        accountName: l.account_name,
        accountType: l.account_type,
        debit: fromPaise(toPaise(l.debit)),
        credit: fromPaise(toPaise(l.credit)),
      })),
    };
  });
}