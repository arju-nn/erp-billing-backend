import app from './app';
import { env } from './config/env';
import { sequelize } from './models';

async function start(): Promise<void> {
  await sequelize.authenticate();
  console.log('Database connected');
  app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});