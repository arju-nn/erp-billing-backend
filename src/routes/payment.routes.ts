import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';

const router = Router();

router.get('/', paymentController.listPayments);
router.post('/', paymentController.createPayment);

export default router;