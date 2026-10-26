import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { ACCOUNT_TYPES, AccountType } from '../constants/enums';
import type { JournalLine } from './JournalLine';

export class Account extends Model<InferAttributes<Account>, InferCreationAttributes<Account>> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare name: string;
  declare type: AccountType;

  declare lines?: NonAttribute<JournalLine[]>;
}

Account.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    type: { type: DataTypes.ENUM(...ACCOUNT_TYPES), allowNull: false },
  },
  { sequelize, tableName: 'accounts', underscored: true, timestamps: false },
);