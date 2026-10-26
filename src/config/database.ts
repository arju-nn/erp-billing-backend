import { Sequelize } from 'sequelize';
import { env } from './env';
import { buildSslOptions } from './ssl';

const ssl = buildSslOptions();

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  dialectOptions: ssl ? { ssl } : {},
  timezone: '+00:00',
  logging: env.db.logging ? console.log : false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  define: { underscored: true },
});