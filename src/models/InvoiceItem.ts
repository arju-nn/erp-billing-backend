import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export class InvoiceItem extends Model<
  InferAttributes<InvoiceItem>,
  InferCreationAttributes<InvoiceItem>
> {
  declare id: CreationOptional<number>;
  declare invoiceId: number;
  declare description: string;
  declare quantity: string;
  declare unitPrice: string;
  declare taxRate: string;
  declare lineTotal: string;
}

InvoiceItem.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    invoiceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    taxRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  { sequelize, tableName: 'invoice_items', underscored: true, timestamps: false },
);