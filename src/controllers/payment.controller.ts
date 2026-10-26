import * as paymentService from '../services/payment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { createPaymentSchema, paymentListQuerySchema } from '../validation/payment.schema';

export const createPayment = asyncHandler(async (req, res) => {
  const input = createPaymentSchema.parse(req.body ?? {});
  res.status(201).json(await paymentService.recordPayment(input));
});

export const listPayments = asyncHandler(async (req, res) => {
  const filters = paymentListQuerySchema.parse(req.query);
  res.json(await paymentService.listPayments(filters));
});