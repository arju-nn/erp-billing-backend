import app from './app';
import { env } from './config/env';
import { sequelize } from './models';

async function start(): Promise<void> {
  await sequelize.authenticate();
  console.log(`Database connected (${env.db.host}/${env.db.name})`);
  console.log(`CORS allowed origins: ${env.frontendUrl || '(none)'}`);

  const server = app.listen(env.port, () => {
    console.log(`API listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      sequelize
        .close()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});