import * as invoiceService from '../services/invoice.service';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validation/common';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  updateInvoiceSchema,
} from '../validation/invoice.schema';

export const listInvoices = asyncHandler(async (req, res) => {
  const filters = invoiceListQuerySchema.parse(req.query);
  res.json(await invoiceService.listInvoices(filters));
});

export const getInvoice = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await invoiceService.getInvoiceDetail(id));
});

export const createInvoice = asyncHandler(async (req, res) => {
  const input = createInvoiceSchema.parse(req.body ?? {});
  res.status(201).json(await invoiceService.createInvoice(input));
});

export const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateInvoiceSchema.parse(req.body ?? {});
  res.json(await invoiceService.updateDraftInvoice(id, input));
});

export const deleteInvoice = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await invoiceService.deleteDraftInvoice(id);
  res.status(204).end();
});

export const issueInvoice = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await invoiceService.issueInvoice(id));
});