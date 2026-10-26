import { Router } from 'express';
import * as reportController from '../controllers/report.controller';

const router = Router();

router.get('/outstanding', reportController.getOutstanding);
router.get('/trial-balance', reportController.getTrialBalance);

export default router;