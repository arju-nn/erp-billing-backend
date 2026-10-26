import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';
import { buildOutstandingReport, OutstandingReport, OutstandingRow, todayIso } from './outstandingReport';

const OUTSTANDING_SQL = `
  SELECT i.id,
         i.invoice_number,
         i.invoice_date,
         i.due_date,
         i.status,
         i.total,
         COALESCE(p.paid, 0) AS paid,
         c.id    AS customer_id,
         c.name  AS customer_name,
         c.email AS customer_email
  FROM invoices i
  JOIN customers c ON c.id = i.customer_id
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) AS paid
    FROM payments
    GROUP BY invoice_id
  ) p ON p.invoice_id = i.id
  WHERE i.status IN ('issued', 'partly_paid')
`;

/** Outstanding (issued + partly paid) per customer, largest balance first. Drafts are excluded. */
export async function getOutstandingReport(asOf?: string): Promise<OutstandingReport> {
  const rows = (await sequelize.query(OUTSTANDING_SQL, { type: QueryTypes.SELECT })) as OutstandingRow[];
  return buildOutstandingReport(rows, asOf ?? todayIso());
}