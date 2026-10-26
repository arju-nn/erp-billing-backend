import { RequestHandler } from 'express';
import * as ledgerService from '../services/ledger.service';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validation/common';
import { journalListQuerySchema } from '../validation/ledger.schema';

export const listJournalEntries = asyncHandler(async (req, res) => {
  const filters = journalListQuerySchema.parse(req.query);
  res.json(await ledgerService.listJournalEntries(filters));
});

export const getJournalEntry = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await ledgerService.getJournalEntry(id));
});

/** Posted entries are immutable: there is no edit or delete, only reversing entries. */
export const rejectMutation: RequestHandler = (_req, res) => {
  res.status(405).json({ error: 'Posted journal entries are immutable; post a reversing entry instead' });
};