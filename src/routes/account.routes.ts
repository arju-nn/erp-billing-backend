import { Router } from 'express';
import * as accountController from '../controllers/account.controller';

const router = Router();

router.get('/', accountController.listAccounts);

export default router;