import * as ledgerService from '../services/ledger.service';
import * as reportService from '../services/report.service';
import { asyncHandler } from '../utils/asyncHandler';
import { asOfQuerySchema } from '../validation/ledger.schema';
import { outstandingQuerySchema } from '../validation/report.schema';

export const getOutstanding = asyncHandler(async (req, res) => {
  const { asOf } = outstandingQuerySchema.parse(req.query);
  res.json(await reportService.getOutstandingReport(asOf));
});

export const getTrialBalance = asyncHandler(async (req, res) => {
  const { asOf } = asOfQuerySchema.parse(req.query);
  res.json(await ledgerService.getTrialBalance(asOf));
});