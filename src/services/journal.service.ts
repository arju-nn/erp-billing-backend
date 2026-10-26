import { Transaction } from 'sequelize';
import { Account, JournalEntry, JournalLine } from '../models';
import { AppError } from '../utils/errors';
import { fromPaise } from '../utils/money';
import { assertBalanced, JournalLineInput } from './journalRules';

export interface JournalEntryInput {
  date: string;
  description: string;
  invoiceId?: number | null;
  paymentId?: number | null;
  lines: JournalLineInput[];
}

/**
 * The ONLY way journal entries are written.
 * - Rejects entries with < 2 lines, negative/two-sided lines, or debits != credits (422).
 * - Requires a transaction, so the entry always commits or rolls back together with the
 *   business event (invoice issue / payment) that caused it.
 * - Posted entries are immutable: JournalEntry/JournalLine model hooks block update/destroy.
 */
export async function createJournalEntry(
  input: JournalEntryInput,
  transaction: Transaction,
): Promise<JournalEntry> {
  if (!transaction) {
    throw new AppError(500, 'Journal entries must be created inside a database transaction');
  }
  assertBalanced(input.lines);

  const codes = [...new Set(input.lines.map((l) => l.accountCode))];
  const accounts = await Account.findAll({ where: { code: codes }, transaction });
  const idByCode = new Map<string, number>(accounts.map((a) => [a.code, a.id]));
  for (const code of codes) {
    if (!idByCode.has(code)) {
      throw new AppError(422, `Unknown account code: ${code}`);
    }
  }

  const entry = await JournalEntry.create(
    {
      date: input.date,
      description: input.description,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
    },
    { transaction },
  );

  await JournalLine.bulkCreate(
    input.lines.map((l) => ({
      entryId: entry.id,
      accountId: idByCode.get(l.accountCode) as number,
      debit: fromPaise(l.debit),
      credit: fromPaise(l.credit),
    })),
    { transaction },
  );

  return entry;
}

/** Backwards-compatible alias used by the Stage 1 seed script. */
export const postJournalEntry = createJournalEntry;