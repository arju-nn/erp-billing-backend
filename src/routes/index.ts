import { Router } from 'express';
import accountRoutes from './account.routes';
import customerRoutes from './customer.routes';
import invoiceRoutes from './invoice.routes';
import journalRoutes from './journal.routes';
import paymentRoutes from './payment.routes';
import reportRoutes from './report.routes';

const apiRouter = Router();

apiRouter.use('/customers', customerRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/accounts', accountRoutes);
apiRouter.use('/journal-entries', journalRoutes);
apiRouter.use('/reports', reportRoutes);

export default apiRouter;