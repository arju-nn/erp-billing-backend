import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { AppError } from '../utils/errors';
import type { JournalLine } from './JournalLine';

const immutable = (): never => {
  throw new AppError(409, 'Posted journal entries are immutable');
};

export class JournalEntry extends Model<
  InferAttributes<JournalEntry>,
  InferCreationAttributes<JournalEntry>
> {
  declare id: CreationOptional<number>;
  declare date: string;
  declare description: string;
  declare invoiceId: CreationOptional<number | null>;
  declare paymentId: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare lines?: NonAttribute<JournalLine[]>;
}

JournalEntry.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: false },
    invoiceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    paymentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'journal_entries',
    underscored: true,
    hooks: {
      beforeUpdate: immutable,
      beforeDestroy: immutable,
      beforeBulkUpdate: immutable,
      beforeBulkDestroy: immutable,
    },
  },
);