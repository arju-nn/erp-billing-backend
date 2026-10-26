import {
  AccountTotalsRow,
  buildAccountBalances,
  buildTrialBalance,
  groupJournalEntries,
  normalSide,
} from '../src/services/ledgerMath';

// Account totals produced by `npm run seed`.
const seedTotals: AccountTotalsRow[] = [
  { id: 1, code: '1000', name: 'Cash', type: 'asset', total_debit: '4725.00', total_credit: '0.00' },
  { id: 2, code: '1010', name: 'Bank', type: 'asset', total_debit: '522000.00', total_credit: '0.00' },
  { id: 3, code: '1100', name: 'Accounts Receivable', type: 'asset', total_debit: '88505.00', total_credit: '26725.00' },
  { id: 4, code: '2100', name: 'GST Payable', type: 'liability', total_debit: '0.00', total_credit: '13005.00' },
  { id: 5, code: '3000', name: "Owner's Capital", type: 'equity', total_debit: '0.00', total_credit: '500000.00' },
  { id: 6, code: '4000', name: 'Sales', type: 'income', total_debit: '0.00', total_credit: '75500.00' },
  { id: 7, code: '5000', name: 'General Expenses', type: 'expense', total_debit: null, total_credit: null },
];

describe('normalSide', () => {
  it('assets and expenses are debit-normal; others credit-normal', () => {
    expect(normalSide('asset')).toBe('debit');
    expect(normalSide('expense')).toBe('debit');
    expect(normalSide('liability')).toBe('credit');
    expect(normalSide('equity')).toBe('credit');
    expect(normalSide('income')).toBe('credit');
  });
});

describe('buildAccountBalances', () => {
  const balances = buildAccountBalances(seedTotals);

  it('signs balances in each account\'s normal direction', () => {
    const ar = balances.find((a) => a.code === '1100');
    const sales = balances.find((a) => a.code === '4000');
    expect(ar?.balance).toBe('61780.00');
    expect(ar?.normalBalance).toBe('debit');
    expect(sales?.balance).toBe('75500.00');
    expect(sales?.normalBalance).toBe('credit');
  });

  it('treats accounts with no lines as zero', () => {
    const exp = balances.find((a) => a.code === '5000');
    expect(exp?.balance).toBe('0.00');
    expect(exp?.totalDebit).toBe('0.00');
  });
});

describe('buildTrialBalance', () => {
  const tb = buildTrialBalance(seedTotals, null);

  it('grand totals match (588505.00 each)', () => {
    expect(tb.totals.debit).toBe('588505.00');
    expect(tb.totals.credit).toBe('588505.00');
    expect(tb.totals.difference).toBe('0.00');
    expect(tb.totals.balanced).toBe(true);
  });

  it('gross line totals match too (615230.00 each)', () => {
    expect(tb.grossTotals.debit).toBe('615230.00');
    expect(tb.grossTotals.credit).toBe('615230.00');
    expect(tb.grossTotals.balanced).toBe(true);
  });

  it('puts each account in the column of its net balance', () => {
    const ar = tb.rows.find((r) => r.code === '1100');
    const gst = tb.rows.find((r) => r.code === '2100');
    expect(ar?.debit).toBe('61780.00');
    expect(ar?.credit).toBe('0.00');
    expect(gst?.debit).toBe('0.00');
    expect(gst?.credit).toBe('13005.00');
  });

  it('satisfies Assets = Liabilities + Equity + Net income', () => {
    expect(tb.summary.assets).toBe('588505.00');
    expect(tb.summary.netIncome).toBe('75500.00');
    expect(tb.summary.equationBalanced).toBe(true);
  });

  it('flags an unbalanced ledger', () => {
    const broken = seedTotals.map((r) => (r.code === '4000' ? { ...r, total_credit: '75400.00' } : r));
    const bad = buildTrialBalance(broken, '2026-10-26');
    expect(bad.totals.balanced).toBe(false);
    expect(bad.totals.difference).toBe('100.00');
    expect(bad.asOf).toBe('2026-10-26');
  });
});

describe('groupJournalEntries', () => {
  it('attaches lines to entries and checks each entry balances', () => {
    const entries = groupJournalEntries(
      [
        { id: 3, date: '2026-09-15', description: 'Invoice INV-0002 issued', invoice_id: 2, payment_id: null, invoice_number: 'INV-0002' },
        { id: 1, date: '2026-09-01', description: "Owner's capital introduced", invoice_id: null, payment_id: null, invoice_number: null },
      ],
      [
        { id: 6, entry_id: 3, account_id: 6, account_code: '4000', account_name: 'Sales', account_type: 'income', debit: '0.00', credit: '10000.00' },
        { id: 5, entry_id: 3, account_id: 3, account_code: '1100', account_name: 'Accounts Receivable', account_type: 'asset', debit: '11800.00', credit: '0.00' },
        { id: 7, entry_id: 3, account_id: 4, account_code: '2100', account_name: 'GST Payable', account_type: 'liability', debit: '0.00', credit: '1800.00' },
        { id: 1, entry_id: 1, account_id: 2, account_code: '1010', account_name: 'Bank', account_type: 'asset', debit: '500000.00', credit: '0.00' },
        { id: 2, entry_id: 1, account_id: 5, account_code: '3000', account_name: "Owner's Capital", account_type: 'equity', debit: '0.00', credit: '500000.00' },
      ],
    );
    expect(entries.map((e) => e.id)).toEqual([3, 1]);
    expect(entries[0].lines.map((l) => l.accountCode)).toEqual(['1100', '4000', '2100']);
    expect(entries[0].totalDebit).toBe('11800.00');
    expect(entries[0].balanced).toBe(true);
    expect(entries[0].paymentId).toBe(null);
    expect(entries[1].invoiceId).toBe(null);
  });
});