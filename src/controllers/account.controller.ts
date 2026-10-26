import * as ledgerService from '../services/ledger.service';
import { asyncHandler } from '../utils/asyncHandler';
import { asOfQuerySchema } from '../validation/ledger.schema';

export const listAccounts = asyncHandler(async (req, res) => {
  const { asOf } = asOfQuerySchema.parse(req.query);
  res.json(await ledgerService.listAccountsWithBalances(asOf));
});