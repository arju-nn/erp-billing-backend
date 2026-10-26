import { sequelize } from '../config/database';
import { Account } from './Account';
import { Customer } from './Customer';
import { Invoice } from './Invoice';
import { InvoiceItem } from './InvoiceItem';
import { JournalEntry } from './JournalEntry';
import { JournalLine } from './JournalLine';
import { Payment } from './Payment';

Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });

Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });

Customer.hasMany(Payment, { foreignKey: 'customerId', as: 'payments' });
Payment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

JournalEntry.hasMany(JournalLine, { foreignKey: 'entryId', as: 'lines' });
JournalLine.belongsTo(JournalEntry, { foreignKey: 'entryId', as: 'entry' });

Account.hasMany(JournalLine, { foreignKey: 'accountId', as: 'lines' });
JournalLine.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

Invoice.hasMany(JournalEntry, { foreignKey: 'invoiceId', as: 'journalEntries' });
JournalEntry.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
JournalEntry.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

export { sequelize, Account, Customer, Invoice, InvoiceItem, JournalEntry, JournalLine, Payment };