import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { INVOICE_STATUSES, InvoiceStatus } from '../constants/enums';
import type { Customer } from './Customer';
import type { InvoiceItem } from './InvoiceItem';
import type { Payment } from './Payment';

export class Invoice extends Model<InferAttributes<Invoice>, InferCreationAttributes<Invoice>> {
  declare id: CreationOptional<number>;
  declare invoiceNumber: string;
  declare customerId: number;
  declare invoiceDate: string;
  declare dueDate: string;
  declare status: CreationOptional<InvoiceStatus>;
  declare subtotal: CreationOptional<string>;
  declare taxAmount: CreationOptional<string>;
  declare total: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare customer?: NonAttribute<Customer>;
  declare items?: NonAttribute<InvoiceItem[]>;
  declare payments?: NonAttribute<Payment[]>;
}

Invoice.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    invoiceNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    invoiceDate: { type: DataTypes.DATEONLY, allowNull: false },
    dueDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM(...INVOICE_STATUSES), allowNull: false, defaultValue: 'draft' },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: '0.00' },
    taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: '0.00' },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: '0.00' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'invoices', underscored: true },
);