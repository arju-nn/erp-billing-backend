import { Router } from 'express';
import * as journalController from '../controllers/journal.controller';

const router = Router();

router.get('/', journalController.listJournalEntries);
router.get('/:id', journalController.getJournalEntry);
router.put('/:id', journalController.rejectMutation);
router.patch('/:id', journalController.rejectMutation);
router.delete('/:id', journalController.rejectMutation);

export default router;