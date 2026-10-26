import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';
import { AppError } from '../utils/errors';
import {
  AccountBalance,
  AccountTotalsRow,
  buildAccountBalances,
  buildTrialBalance,
  groupJournalEntries,
  JournalEntryDto,
  JournalEntryRow,
  JournalLineRow,
  TrialBalance,
} from './ledgerMath';

/** Used when no asOf date is given, so every posted entry is included. */
const ALL_DATES = '9999-12-31';

const ACCOUNT_TOTALS_SQL = `
  SELECT a.id, a.code, a.name, a.type,
         COALESCE(t.total_debit, 0)  AS total_debit,
         COALESCE(t.total_credit, 0) AS total_credit,
         COALESCE(t.line_count, 0)   AS line_count
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id,
           SUM(jl.debit)  AS total_debit,
           SUM(jl.credit) AS total_credit,
           COUNT(*)       AS line_count
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    WHERE je.date <= :asOf
    GROUP BY jl.account_id
  ) t ON t.account_id = a.id
  ORDER BY a.code
`;

async function fetchAccountTotals(asOf?: string): Promise<AccountTotalsRow[]> {
  return (await sequelize.query(ACCOUNT_TOTALS_SQL, {
    replacements: { asOf: asOf ?? ALL_DATES },
    type: QueryTypes.SELECT,
  })) as AccountTotalsRow[];
}

// ---------- accounts ----------

export async function listAccountsWithBalances(asOf?: string): Promise<AccountBalance[]> {
  return buildAccountBalances(await fetchAccountTotals(asOf));
}

// ---------- trial balance ----------

export async function getTrialBalance(asOf?: string): Promise<TrialBalance> {
  return buildTrialBalance(await fetchAccountTotals(asOf), asOf ?? null);
}

// ---------- journal entries ----------

export interface JournalListFilters {
  from?: string;
  to?: string;
  invoiceId?: number;
  paymentId?: number;
  accountId?: number;
  limit: number;
  offset: number;
}

export interface JournalListResult {
  total: number;
  limit: number;
  offset: number;
  entries: JournalEntryDto[];
}

const ENTRY_SELECT = `
  SELECT je.id, je.date, je.description, je.invoice_id, je.payment_id, i.invoice_number
  FROM journal_entries je
  LEFT JOIN invoices i ON i.id = je.invoice_id
`;

async function fetchLines(entryIds: number[]): Promise<JournalLineRow[]> {
  if (entryIds.length === 0) return [];
  return (await sequelize.query(
    `SELECT jl.id, jl.entry_id, jl.debit, jl.credit,
            a.id AS account_id, a.code AS account_code, a.name AS account_name, a.type AS account_type
     FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     WHERE jl.entry_id IN (:entryIds)
     ORDER BY jl.entry_id, jl.id`,
    { replacements: { entryIds }, type: QueryTypes.SELECT },
  )) as JournalLineRow[];
}

export async function listJournalEntries(filters: JournalListFilters): Promise<JournalListResult> {
  const conditions: string[] = [];
  const replacements: Record<string, unknown> = { limit: filters.limit, offset: filters.offset };

  if (filters.from) {
    conditions.push('je.date >= :from');
    replacements.from = filters.from;
  }
  if (filters.to) {
    conditions.push('je.date <= :to');
    replacements.to = filters.to;
  }
  if (filters.invoiceId) {
    conditions.push('je.invoice_id = :invoiceId');
    replacements.invoiceId = filters.invoiceId;
  }
  if (filters.paymentId) {
    conditions.push('je.payment_id = :paymentId');
    replacements.paymentId = filters.paymentId;
  }
  if (filters.accountId) {
    conditions.push('je.id IN (SELECT jl2.entry_id FROM journal_lines jl2 WHERE jl2.account_id = :accountId)');
    replacements.accountId = filters.accountId;
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRows = (await sequelize.query(`SELECT COUNT(*) AS n FROM journal_entries je ${whereSql}`, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Array<{ n: number | string }>;

  const entryRows = (await sequelize.query(
    `${ENTRY_SELECT} ${whereSql} ORDER BY je.date DESC, je.id DESC LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT },
  )) as JournalEntryRow[];

  const lineRows = await fetchLines(entryRows.map((e) => Number(e.id)));

  return {
    total: Number(countRows[0]?.n ?? 0),
    limit: filters.limit,
    offset: filters.offset,
    entries: groupJournalEntries(entryRows, lineRows),
  };
}

export async function getJournalEntry(id: number): Promise<JournalEntryDto> {
  const entryRows = (await sequelize.query(`${ENTRY_SELECT} WHERE je.id = :id`, {
    replacements: { id },
    type: QueryTypes.SELECT,
  })) as JournalEntryRow[];
  if (entryRows.length === 0) throw new AppError(404, `Journal entry ${id} not found`);

  const [entry] = groupJournalEntries(entryRows, await fetchLines([id]));
  return entry;
}