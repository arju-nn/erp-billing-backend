import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';

const router = Router();

router.get('/', customerController.listCustomers);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomer);

export default router;