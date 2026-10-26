import * as customerService from '../services/customer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validation/common';
import { createCustomerSchema } from '../validation/customer.schema';

export const listCustomers = asyncHandler(async (_req, res) => {
  res.json(await customerService.listCustomers());
});

export const getCustomer = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await customerService.getCustomer(id));
});

export const createCustomer = asyncHandler(async (req, res) => {
  const input = createCustomerSchema.parse(req.body ?? {});
  res.status(201).json(await customerService.createCustomer(input));
});