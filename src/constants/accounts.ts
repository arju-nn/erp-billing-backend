import { AccountType } from './enums';

export const ACCOUNT_CODES = {
  CASH: '1000',
  BANK: '1010',
  ACCOUNTS_RECEIVABLE: '1100',
  GST_PAYABLE: '2100',
  OWNERS_CAPITAL: '3000',
  SALES: '4000',
  GENERAL_EXPENSES: '5000',
} as const;

export const CHART_OF_ACCOUNTS: { code: string; name: string; type: AccountType }[] = [
  { code: ACCOUNT_CODES.CASH, name: 'Cash', type: 'asset' },
  { code: ACCOUNT_CODES.BANK, name: 'Bank', type: 'asset' },
  { code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, name: 'Accounts Receivable', type: 'asset' },
  { code: ACCOUNT_CODES.GST_PAYABLE, name: 'GST Payable', type: 'liability' },
  { code: ACCOUNT_CODES.OWNERS_CAPITAL, name: "Owner's Capital", type: 'equity' },
  { code: ACCOUNT_CODES.SALES, name: 'Sales', type: 'income' },
  { code: ACCOUNT_CODES.GENERAL_EXPENSES, name: 'General Expenses', type: 'expense' },
];