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
import type { Account } from './Account';
import type { JournalEntry } from './JournalEntry';

const immutable = (): never => {
  throw new AppError(409, 'Posted journal lines are immutable');
};

export class JournalLine extends Model<
  InferAttributes<JournalLine>,
  InferCreationAttributes<JournalLine>
> {
  declare id: CreationOptional<number>;
  declare entryId: number;
  declare accountId: number;
  declare debit: CreationOptional<string>;
  declare credit: CreationOptional<string>;

  declare account?: NonAttribute<Account>;
  declare entry?: NonAttribute<JournalEntry>;
}

JournalLine.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    entryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    accountId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    debit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: '0.00' },
    credit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: '0.00' },
  },
  {
    sequelize,
    tableName: 'journal_lines',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeUpdate: immutable,
      beforeDestroy: immutable,
      beforeBulkUpdate: immutable,
      beforeBulkDestroy: immutable,
    },
  },
);